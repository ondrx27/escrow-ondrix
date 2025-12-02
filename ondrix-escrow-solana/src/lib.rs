use solana_program::{
    account_info::{next_account_info, AccountInfo},
    clock::Clock,
    entrypoint,
    entrypoint::ProgramResult,
    msg,
    program::{invoke, invoke_signed},
    program_error::ProgramError,
    program_pack::Pack,
    pubkey::Pubkey,
    rent::Rent,
    system_instruction,
    sysvar::Sysvar,
};
use spl_token::instruction as spl_instruction;
use borsh::{BorshDeserialize, BorshSerialize};
use thiserror::Error;
use chainlink_solana::{
    latest_round_data,
};

// Chainlink Oracle Program ID (Solana Devnet) - working addresses from your example
pub const CHAINLINK_PROGRAM_ID: Pubkey = Pubkey::new_from_array([
    241, 75, 246, 90, 213, 107, 210, 186, 113, 94, 69, 116, 44, 35, 31, 39, 214, 54, 33, 207, 91, 119, 143, 55, 193, 162, 72, 149, 29, 23, 86, 2
]);

// SOL/USD Price Feed on Devnet - working addresses from your example
pub const SOL_USD_FEED: Pubkey = Pubkey::new_from_array([
    120, 245, 122, 225, 25, 94, 140, 73, 122, 139, 224, 84, 173, 82, 173, 244, 200, 151, 111, 132, 54, 115, 35, 9, 226, 42, 247, 6, 119, 36, 173, 150
]);

pub const TOKEN_PRICE_USD_CENTS: u64 = 10; // Token price = 0.1 USD = 10 cents
pub const USD_CENTS_SCALE: u64 = 100; // 1 USD = 100 cents
pub const CHAINLINK_USD_DECIMALS: u8 = 8; // Chainlink SOL/USD price has 8 decimals
pub const TOKEN_DECIMALS: u8 = 9; // Our token mint has 9 decimals
pub const SOL_LAMPORTS: u64 = 1_000_000_000; // 1 SOL = 1e9 lamports
pub const PRICE_STALENESS_THRESHOLD: u64 = 300; // 5 minutes in seconds

// Investment limits for security
pub const MIN_SOL_INVESTMENT_LAMPORTS: u64 = 1_000_000; // 0.001 SOL minimum
pub const MAX_SOL_INVESTMENT_LAMPORTS: u64 = 10_000_000_000_000; // 10,000 SOL maximum per address

#[derive(Error, Debug, Copy, Clone)]
pub enum EscrowError {
    #[error("Invalid instruction")]
    InvalidInstruction,
    #[error("Not rent exempt")]
    NotRentExempt,
    #[error("Expected amount mismatch")]
    ExpectedAmountMismatch,
    #[error("Amount overflow")]
    AmountOverflow,
    #[error("Invalid escrow status")]
    InvalidEscrowStatus,
    #[error("Unauthorized")]
    Unauthorized,
    #[error("SOL still locked")]
    SolStillLocked,
    #[error("No SOL to withdraw")]
    NoSolToWithdraw,
    #[error("Invalid price feed")]
    InvalidPriceFeed,
    #[error("Stale price data")]
    StalePriceData,
    #[error("Insufficient SOL deposit")]
    InsufficientSolDeposit,
    #[error("Not enough tokens available")]
    NotEnoughTokens,
    #[error("Invalid PDA")]
    InvalidPDA,
    #[error("Investment amount below minimum")]
    InvestmentBelowMinimum,
    #[error("Investment amount exceeds maximum per address")]
    InvestmentExceedsMaximum,
    #[error("Invalid token account")]
    InvalidTokenAccount,
}

impl From<EscrowError> for ProgramError {
    fn from(e: EscrowError) -> Self {
        ProgramError::Custom(e as u32)
    }
}

// Global escrow account - one per program/token mint combination
#[derive(BorshSerialize, BorshDeserialize, Debug)]
pub struct GlobalEscrow {
    pub is_initialized: bool,
    pub initializer_pubkey: Pubkey,
    pub token_mint_pubkey: Pubkey,
    pub recipient_wallet: Pubkey,     // Receives 50% of all SOL deposits
    pub total_tokens_available: u64,
    pub tokens_sold: u64,
    pub total_sol_deposited: u64,
    pub total_sol_withdrawn: u64,     // SOL withdrawn by initializer after lock periods
    pub lock_duration: i64,           // Lock duration in seconds
    pub bump_seed: u8,
    
    pub oracle_program_id: Pubkey,    // Chainlink oracle program
    pub price_feed_pubkey: Pubkey,    // SOL/USD price feed
    
    pub min_sol_investment: u64,      // Minimum SOL investment
    pub max_sol_investment: u64,      // Maximum SOL per address
    pub price_staleness_threshold: u64, // Price staleness in seconds
    
    // SALE MANAGEMENT
    pub sale_end_timestamp: i64,      // When sale ends (for unsold token reclaim)
    
    // GLOBAL TIMING
    pub initialization_timestamp: i64, // When contract was initialized (for global unlock timing)
}

impl GlobalEscrow {
    // Updated size: original + oracle_program_id + price_feed_pubkey + 3 config values + sale_end_timestamp + initialization_timestamp
    pub const LEN: usize = 1 + 32 + 32 + 32 + 8 + 8 + 8 + 8 + 8 + 1 + 32 + 32 + 8 + 8 + 8 + 8 + 8;
}

// Per-investor account - one per investor per global escrow
#[derive(BorshSerialize, BorshDeserialize, Debug)]
pub struct InvestorAccount {
    pub is_initialized: bool,
    pub investor_pubkey: Pubkey,
    pub global_escrow_pubkey: Pubkey,
    pub sol_deposited: u64,           // Total SOL deposited by this investor
    pub tokens_received: u64,         // All tokens received immediately
    pub deposit_timestamp: i64,       // When the deposit was made
    pub sol_usd_price: u64,          // SOL price at deposit time (8 decimals)
    pub status: InvestorStatus,
    pub bump_seed: u8,
}

impl InvestorAccount {
    pub const LEN: usize = 1 + 32 + 32 + 8 + 8 + 8 + 8 + 1 + 1;
    
    pub fn is_unlock_time(&self, lock_duration: i64) -> Result<bool, ProgramError> {
        let current_timestamp = Clock::get()?.unix_timestamp;
        Ok(current_timestamp >= self.deposit_timestamp + lock_duration)
    }
    
    pub fn get_locked_sol_amount(&self) -> u64 {
        self.sol_deposited / 2  // 50% of deposited SOL is locked
    }
}

#[derive(BorshSerialize, BorshDeserialize, Debug, Clone, Copy, PartialEq)]
#[derive(Default)]
pub enum InvestorStatus {
    #[default]
    Uninitialized,
    Deposited,        // SOL deposited, tokens received, SOL locked
    SolWithdrawn,     // Locked SOL has been withdrawn by initializer
}

// PDA helper functions with proper seeds
pub fn find_global_escrow_pda(
    initializer: &Pubkey,
    token_mint: &Pubkey,
    program_id: &Pubkey,
) -> (Pubkey, u8) {
    Pubkey::find_program_address(
        &[b"global_escrow", initializer.as_ref(), token_mint.as_ref()],
        program_id,
    )
}

pub fn find_investor_pda(
    investor: &Pubkey,
    global_escrow: &Pubkey,
    program_id: &Pubkey,
) -> (Pubkey, u8) {
    Pubkey::find_program_address(
        &[b"investor", investor.as_ref(), global_escrow.as_ref()],
        program_id,
    )
}

pub fn find_token_vault_pda(
    global_escrow: &Pubkey,
    program_id: &Pubkey,
) -> (Pubkey, u8) {
    Pubkey::find_program_address(
        &[b"token_vault", global_escrow.as_ref()],
        program_id,
    )
}

pub fn find_sol_vault_pda(
    investor: &Pubkey,
    global_escrow: &Pubkey,
    program_id: &Pubkey,
) -> (Pubkey, u8) {
    Pubkey::find_program_address(
        &[b"sol_vault", investor.as_ref(), global_escrow.as_ref()],
        program_id,
    )
}

// Instruction data
#[derive(BorshSerialize, BorshDeserialize, Debug)]
pub enum EscrowInstruction {
    /// Initialize global escrow
    /// Accounts expected:
    /// 0. `[signer]` Initializer account
    /// 1. `[writable]` Global escrow account (PDA)
    /// 2. `[]` Token mint
    /// 3. `[writable]` Token vault account (PDA)
    /// 4. `[writable]` Initializer's token account (source)
    /// 5. `[]` Recipient wallet
    /// 6. `[]` Token program
    /// 7. `[]` Associated token program
    /// 8. `[]` System program
    /// 9. `[]` Rent sysvar
    /// 10. `[]` Oracle program
    /// 11. `[]` Price feed
    InitializeEscrow { 
        token_amount: u64, 
        lock_duration: i64,
        sale_end_timestamp: i64,
        min_sol_investment: u64,
        max_sol_investment: u64,
        price_staleness_threshold: u64,
    },
    
    /// Deposit SOL and receive all tokens immediately
    /// Accounts expected:
    /// 0. `[signer]` Investor account
    /// 1. `[]` Global escrow account
    /// 2. `[writable]` Investor account (PDA)
    /// 3. `[writable]` Sol vault account (PDA) - stores locked SOL
    /// 4. `[writable]` Token vault account
    /// 5. `[writable]` Investor's token account (destination)
    /// 6. `[writable]` Recipient wallet (receives 50% SOL)
    /// 7. `[]` Token program
    /// 8. `[]` Chainlink oracle program
    /// 9. `[]` SOL/USD price feed
    /// 10. `[]` System program
    /// 11. `[]` Clock sysvar
    /// 12. `[]` Token mint account
    /// 13. `[]` Associated token program
    /// 14. `[]` Rent sysvar
    DepositSol { sol_amount: u64 },
    
    /// Withdraw locked SOL (only by initializer after lock period)
    /// Accounts expected:
    /// 0. `[signer]` Initializer account
    /// 1. `[]` Global escrow account
    /// 2. `[]` Investor account (for timestamp check)
    /// 3. `[writable]` Sol vault account (PDA) - contains locked SOL
    /// 4. `[]` System program
    /// 5. `[]` Clock sysvar
    WithdrawLockedSol,
    
    /// Get escrow status (read-only)
    /// Accounts expected:
    /// 0. `[]` Global escrow account
    /// 1. `[]` Clock sysvar
    GetEscrowStatus,
    
    /// Close sale and reclaim unsold tokens
    /// Only recipient_wallet can call after sale_end_timestamp
    /// Accounts expected:
    /// 0. `[signer]` Recipient wallet
    /// 1. `[writable]` Global escrow account
    /// 2. `[writable]` Token vault account (PDA)
    /// 3. `[writable]` Recipient's token account (destination)
    /// 4. `[]` Token program
    CloseSale,
}

// Safe math helpers with overflow protection
pub fn checked_mul_div(a: u64, b: u64, c: u64) -> Result<u64, ProgramError> {
    let result = (a as u128)
        .checked_mul(b as u128)
        .ok_or(EscrowError::AmountOverflow)?
        .checked_div(c as u128)
        .ok_or(EscrowError::AmountOverflow)?;
        
    u64::try_from(result).map_err(|_| EscrowError::AmountOverflow.into())
}

// Calculate tokens based on SOL amount and USD price
/// Calculate tokens for SOL amount using clear unit conversion
/// Input: sol_amount_lamports (u64), sol_usd_price (u64 with 8 decimals from Chainlink)  
/// Output: token amount (u64 with TOKEN_DECIMALS)
/// Formula: tokens = (lamports * sol_price_usd * 10^token_decimals) / (token_price_cents * sol_lamports * 10^chainlink_decimals)
pub fn calculate_tokens_for_sol(
    sol_amount_lamports: u64,
    sol_usd_price: u64, // Chainlink SOL/USD price with 8 decimals (e.g., 21700000000 = $217.00)
) -> Result<u64, ProgramError> {
    // Step 1: Calculate USD value of SOL deposit
    // sol_lamports * sol_price_usd / (10^9 lamports per SOL) = USD value with 8 decimals
    let sol_value_usd_8decimals = checked_mul_div(
        sol_amount_lamports,
        sol_usd_price,
        SOL_LAMPORTS,
    )?;
    
    // Step 2: Convert USD value to cents (remove 8 decimals, add 2 for cents)
    // USD_8decimals / 10^6 = USD_cents (since 10^8 / 10^2 = 10^6)
    let sol_value_cents = sol_value_usd_8decimals
        .checked_div(10_u64.pow((CHAINLINK_USD_DECIMALS - 2) as u32))
        .ok_or(EscrowError::AmountOverflow)?;
    
    // Step 3: Calculate tokens: usd_cents / token_price_cents * 10^token_decimals
    let tokens = checked_mul_div(
        sol_value_cents,
        10_u64.pow(TOKEN_DECIMALS as u32),
        TOKEN_PRICE_USD_CENTS,
    )?;
    
    Ok(tokens)
}

// Chainlink price feed parser using official chainlink-solana crate
pub fn get_chainlink_price<'a>(
    price_feed_account: &AccountInfo<'a>,
    oracle_program: &AccountInfo<'a>,
    global_escrow: &GlobalEscrow,
) -> Result<(u64, i64), ProgramError> {
    // Validate Chainlink program ID using immutable oracle config
    if oracle_program.key != &global_escrow.oracle_program_id {
        msg!("Invalid Chainlink program: {}", oracle_program.key);
        return Err(EscrowError::InvalidPriceFeed.into());
    }

    // Validate price feed address using immutable oracle config
    if price_feed_account.key != &global_escrow.price_feed_pubkey {
        msg!("Invalid price feed: {}", price_feed_account.key);
        msg!("Expected: {}", global_escrow.price_feed_pubkey);
        return Err(EscrowError::InvalidPriceFeed.into());
    }

    // Get latest round data from Chainlink
    let round_data = latest_round_data(
        oracle_program.clone(),
        price_feed_account.clone(),
    ).map_err(|_| EscrowError::InvalidPriceFeed)?;
    
    // Check for stale data using immutable config threshold
    let current_timestamp = Clock::get()?.unix_timestamp;
    if current_timestamp - round_data.timestamp as i64 > global_escrow.price_staleness_threshold as i64 {
        msg!("Stale price feed: {} > {}", current_timestamp - round_data.timestamp as i64, global_escrow.price_staleness_threshold);
        return Err(EscrowError::StalePriceData.into());
    }
    
    // Ensure price is positive
    if round_data.answer <= 0 {
        msg!("Invalid price: {}", round_data.answer);
        return Err(EscrowError::InvalidPriceFeed.into());
    }
    
    let price = round_data.answer as u64;
    let timestamp = round_data.timestamp as i64;
    
    Ok((price, timestamp))
}

// Program entrypoint
entrypoint!(process_instruction);

pub fn process_instruction(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    instruction_data: &[u8],
) -> ProgramResult {
    let instruction = EscrowInstruction::try_from_slice(instruction_data)
        .map_err(|_| EscrowError::InvalidInstruction)?;

    match instruction {
        EscrowInstruction::InitializeEscrow { 
            token_amount, 
            lock_duration, 
            sale_end_timestamp,
            min_sol_investment,
            max_sol_investment,
            price_staleness_threshold,
        } => {
            msg!("Instruction: InitializeEscrow");
            process_initialize_escrow(
                program_id, 
                accounts, 
                token_amount, 
                lock_duration,
                sale_end_timestamp,
                min_sol_investment,
                max_sol_investment,
                price_staleness_threshold,
            )
        }
        EscrowInstruction::DepositSol { sol_amount } => {
            msg!("Instruction: DepositSol");
            process_deposit_sol(program_id, accounts, sol_amount)
        }
        EscrowInstruction::WithdrawLockedSol => {
            msg!("Instruction: WithdrawLockedSol");
            process_withdraw_locked_sol(program_id, accounts)
        }
        EscrowInstruction::GetEscrowStatus => {
            msg!("Instruction: GetEscrowStatus");
            process_get_escrow_status(accounts)
        }
        EscrowInstruction::CloseSale => {
            msg!("Instruction: CloseSale");
            process_close_sale(program_id, accounts)
        }
    }
}

pub fn process_initialize_escrow(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    token_amount: u64,
    lock_duration: i64,
    sale_end_timestamp: i64,
    min_sol_investment: u64,
    max_sol_investment: u64,
    price_staleness_threshold: u64,
) -> ProgramResult {
    let account_info_iter = &mut accounts.iter();
    let initializer = next_account_info(account_info_iter)?;
    let global_escrow_account = next_account_info(account_info_iter)?;
    let token_mint = next_account_info(account_info_iter)?;
    let token_vault_account = next_account_info(account_info_iter)?;
    let token_source_account = next_account_info(account_info_iter)?;
    let recipient_wallet = next_account_info(account_info_iter)?;
    let token_program = next_account_info(account_info_iter)?;
    let _associated_token_program = next_account_info(account_info_iter)?;
    let system_program = next_account_info(account_info_iter)?;
    let rent = &Rent::get()?;
    let oracle_program = next_account_info(account_info_iter)?;
    let price_feed = next_account_info(account_info_iter)?;

    if !initializer.is_signer {
        return Err(ProgramError::MissingRequiredSignature);
    }
    
    if token_program.key != &spl_token::id() {
        return Err(ProgramError::IncorrectProgramId);
    }
    
    // ORACLE IMMUTABILITY
    // Validate oracle program and feed match expected values before storing immutably
    if oracle_program.key != &CHAINLINK_PROGRAM_ID {
        return Err(EscrowError::InvalidPriceFeed.into());
    }
    
    if price_feed.key != &SOL_USD_FEED {
        return Err(EscrowError::InvalidPriceFeed.into());
    }
    
    if system_program.key != &solana_program::system_program::id() {
        return Err(ProgramError::IncorrectProgramId);
    }

    // Verify PDA addresses
    let (expected_global_escrow, bump_seed) = find_global_escrow_pda(
        initializer.key,
        token_mint.key,
        program_id,
    );
    
    if global_escrow_account.key != &expected_global_escrow {
        return Err(EscrowError::InvalidPDA.into());
    }

    let (expected_token_vault, vault_bump) = find_token_vault_pda(
        &expected_global_escrow,
        program_id,
    );
    
    if token_vault_account.key != &expected_token_vault {
        return Err(EscrowError::InvalidPDA.into());
    }

    // Check if already initialized
    if global_escrow_account.data_len() > 0 {
        let escrow_data = GlobalEscrow::try_from_slice(&global_escrow_account.data.borrow())?;
        if escrow_data.is_initialized {
            return Err(ProgramError::AccountAlreadyInitialized);
        }
    }

    // Create global escrow account
    let escrow_size = GlobalEscrow::LEN;
    let rent_lamports = rent.minimum_balance(escrow_size);
    
    let create_escrow_ix = system_instruction::create_account(
        initializer.key,
        global_escrow_account.key,
        rent_lamports,
        escrow_size as u64,
        program_id,
    );

    invoke_signed(
        &create_escrow_ix,
        &[
            initializer.clone(),
            global_escrow_account.clone(),
            system_program.clone(),
        ],
        &[&[
            b"global_escrow",
            initializer.key.as_ref(),
            token_mint.key.as_ref(),
            &[bump_seed],
        ]],
    )?;

    // Create token vault if it doesn't exist (owned by global escrow PDA)
    if token_vault_account.owner != &spl_token::id() || token_vault_account.data_len() != 165 {
        let rent = Rent::get()?;
        let token_account_size = 165; // Size of SPL token account (Account::LEN)
        let rent_lamports = rent.minimum_balance(token_account_size);
        
        // Create token account owned by global escrow PDA
        let create_vault_ix = system_instruction::create_account(
            initializer.key,
            token_vault_account.key,
            rent_lamports,
            token_account_size as u64,
            &spl_token::id(),
        );
        
        invoke_signed(
            &create_vault_ix,
            &[
                initializer.clone(),
                token_vault_account.clone(),
                system_program.clone(),
            ],
            &[&[
                b"token_vault",
                expected_global_escrow.as_ref(),
                &[vault_bump],
            ]],
        )?;
        
        // Initialize token account with global escrow as authority
        let init_vault_ix = spl_instruction::initialize_account3(
            token_program.key,
            token_vault_account.key,
            token_mint.key,
            global_escrow_account.key, // Global escrow PDA as authority
        )?;
        
        invoke(
            &init_vault_ix,
            &[
                token_vault_account.clone(),
                token_mint.clone(),
                global_escrow_account.clone(),
                token_program.clone(),
            ],
        )?;
    }

    // Transfer tokens from initializer to token vault using proper system transfer
    let transfer_ix = spl_instruction::transfer(
        token_program.key,
        token_source_account.key,
        token_vault_account.key,
        initializer.key,
        &[],
        token_amount,
    )?;

    invoke(
        &transfer_ix,
        &[
            token_source_account.clone(),
            token_vault_account.clone(),
            initializer.clone(),
            token_program.clone(),
        ],
    )?;

    // SECURITY: Validate lock duration is reasonable (1 minute to 1 year)
    if !(60..=(365 * 24 * 60 * 60)).contains(&lock_duration) {
        return Err(EscrowError::InvalidInstruction.into());
    }

    // Initialize global escrow data
    let global_escrow = GlobalEscrow {
        is_initialized: true,
        initializer_pubkey: *initializer.key,
        token_mint_pubkey: *token_mint.key,
        recipient_wallet: *recipient_wallet.key,
        total_tokens_available: token_amount,
        tokens_sold: 0,
        total_sol_deposited: 0,
        total_sol_withdrawn: 0,
        lock_duration,
        bump_seed,
        
        // IMMUTABLE ORACLE CONFIG
        oracle_program_id: *oracle_program.key,
        price_feed_pubkey: *price_feed.key,
        
        // IMMUTABLE CONFIG VALUES
        min_sol_investment,
        max_sol_investment,
        price_staleness_threshold,
        
        // SALE MANAGEMENT
        sale_end_timestamp,
        
        // GLOBAL TIMING
        initialization_timestamp: Clock::get()?.unix_timestamp,
    };

    global_escrow.serialize(&mut &mut global_escrow_account.data.borrow_mut()[..])?;

    msg!(
        "Global escrow initialized: {} tokens, {}s lock, recipient: {}",
        token_amount,
        lock_duration,
        recipient_wallet.key
    );
    
    Ok(())
}

pub fn process_deposit_sol(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    sol_amount: u64,
) -> ProgramResult {
    let account_info_iter = &mut accounts.iter();
    let investor = next_account_info(account_info_iter)?;
    let global_escrow_account = next_account_info(account_info_iter)?;
    let investor_account = next_account_info(account_info_iter)?;
    let sol_vault_account = next_account_info(account_info_iter)?;
    let token_vault_account = next_account_info(account_info_iter)?;
    let investor_token_account = next_account_info(account_info_iter)?;
    let recipient_wallet = next_account_info(account_info_iter)?;
    let token_program = next_account_info(account_info_iter)?;
    let oracle_program = next_account_info(account_info_iter)?;
    let price_feed = next_account_info(account_info_iter)?;
    let system_program = next_account_info(account_info_iter)?;
    let _clock = next_account_info(account_info_iter)?;
    let token_mint_account = next_account_info(account_info_iter)?;
    let associated_token_program = next_account_info(account_info_iter)?;
    let _rent_sysvar = next_account_info(account_info_iter)?;

    if !investor.is_signer {
        return Err(ProgramError::MissingRequiredSignature);
    }

    // Load global escrow first
    let mut global_escrow = GlobalEscrow::try_from_slice(&global_escrow_account.data.borrow())?;
    if !global_escrow.is_initialized {
        return Err(EscrowError::InvalidEscrowStatus.into());
    }

    if token_program.key != &spl_token::id() {
        return Err(ProgramError::IncorrectProgramId);
    }
    
    // ORACLE IMMUTABILITY: Use stored oracle config instead of hardcoded values
    if oracle_program.key != &global_escrow.oracle_program_id {
        return Err(EscrowError::InvalidPriceFeed.into());
    }
    
    if price_feed.key != &global_escrow.price_feed_pubkey {
        return Err(EscrowError::InvalidPriceFeed.into());
    }
    
    if system_program.key != &solana_program::system_program::id() {
        return Err(ProgramError::IncorrectProgramId);
    }

    // Create investor's ATA if it doesn't exist  
    if investor_token_account.owner != &spl_token::id() || investor_token_account.data_len() != 165 {
        msg!("Creating ATA for investor");
        
        // Verify the expected ATA address
        let expected_ata = spl_associated_token_account::get_associated_token_address(
            investor.key,
            token_mint_account.key,
        );
        
        if investor_token_account.key != &expected_ata {
            return Err(ProgramError::InvalidAccountData);
        }

        let create_ata_ix = spl_associated_token_account::instruction::create_associated_token_account(
            investor.key,      // payer
            investor.key,      // owner 
            token_mint_account.key, // mint
            &spl_token::id(),  // token_program (use constant, not passed key)
        );

        invoke(
            &create_ata_ix,
            &[
                investor.clone(),
                investor_token_account.clone(),
                investor.clone(),
                token_mint_account.clone(),
                system_program.clone(),
                token_program.clone(),
                associated_token_program.clone(),
            ],
        )?;
    }

    // STRICT ATA VALIDATION
    // Now validate the token account (after creation if needed)
    let token_account_data = spl_token::state::Account::unpack(&investor_token_account.data.borrow())?;
    
    // Verify token account owner is the investor
    if token_account_data.owner != *investor.key {
        msg!("Invalid token account owner. Expected: {}, Found: {}", investor.key, token_account_data.owner);
        return Err(EscrowError::InvalidTokenAccount.into());
    }
    
    // Verify token account mint matches the escrow token mint
    if token_account_data.mint != global_escrow.token_mint_pubkey {
        msg!("Invalid token account mint. Expected: {}, Found: {}", global_escrow.token_mint_pubkey, token_account_data.mint);
        return Err(EscrowError::InvalidTokenAccount.into());
    }
    
    // Verify no delegate is set (security requirement)
    if token_account_data.delegate.is_some() {
        msg!("Token account has delegate set, which is not allowed for security");
        return Err(EscrowError::InvalidTokenAccount.into());
    }
    
    // Verify no close_authority is set (security requirement)
    if token_account_data.close_authority.is_some() {
        msg!("Token account has close_authority set, which is not allowed for security");
        return Err(EscrowError::InvalidTokenAccount.into());
    }

    // Verify investor PDA
    let (expected_investor_account, investor_bump) = find_investor_pda(
        investor.key,
        global_escrow_account.key,
        program_id,
    );
    
    if investor_account.key != &expected_investor_account {
        return Err(EscrowError::InvalidPDA.into());
    }
    
    // Verify SOL vault PDA
    let (expected_sol_vault, sol_vault_bump) = find_sol_vault_pda(
        investor.key,
        global_escrow_account.key,
        program_id,
    );
    
    if sol_vault_account.key != &expected_sol_vault {
        return Err(EscrowError::InvalidPDA.into());
    }

    // SECURITY: Validate investment limits using immutable config
    if sol_amount < global_escrow.min_sol_investment {
        return Err(EscrowError::InvestmentBelowMinimum.into());
    }

    // Get SOL price from Chainlink using immutable oracle config
    let (sol_usd_price, _timestamp) = get_chainlink_price(price_feed, oracle_program, &global_escrow)?;
    
    // Calculate tokens for SOL amount
    let tokens_to_receive = calculate_tokens_for_sol(sol_amount, sol_usd_price)?;
    
    // Check if enough tokens available
    let tokens_remaining = global_escrow.total_tokens_available - global_escrow.tokens_sold;
    if tokens_to_receive > tokens_remaining {
        return Err(EscrowError::NotEnoughTokens.into());
    }

    // Create or update investor account
    let investor_data = if investor_account.owner != program_id || investor_account.data_len() != InvestorAccount::LEN {
        // SECURITY: Check maximum investment limit for new investor using immutable config
        if sol_amount > global_escrow.max_sol_investment {
            return Err(EscrowError::InvestmentExceedsMaximum.into());
        }
        // Create new investor account
        let investor_size = InvestorAccount::LEN;
        let rent = Rent::get()?;
        let rent_lamports = rent.minimum_balance(investor_size);
        
        let create_investor_ix = system_instruction::create_account(
            investor.key,
            investor_account.key,
            rent_lamports,
            investor_size as u64,
            program_id,
        );

        invoke_signed(
            &create_investor_ix,
            &[
                investor.clone(),
                investor_account.clone(),
                system_program.clone(),
            ],
            &[&[
                b"investor",
                investor.key.as_ref(),
                global_escrow_account.key.as_ref(),
                &[investor_bump],
            ]],
        )?;

        InvestorAccount {
            is_initialized: true,
            investor_pubkey: *investor.key,
            global_escrow_pubkey: *global_escrow_account.key,
            sol_deposited: sol_amount,
            tokens_received: tokens_to_receive,
            deposit_timestamp: Clock::get()?.unix_timestamp,
            sol_usd_price,
            status: InvestorStatus::Deposited,
            bump_seed: investor_bump,
        }
    } else {
        // Update existing investor account
        let mut existing_data = InvestorAccount::try_from_slice(&investor_account.data.borrow())?;
        
        let total_investment = existing_data.sol_deposited + sol_amount;
        if total_investment > global_escrow.max_sol_investment {
            return Err(EscrowError::InvestmentExceedsMaximum.into());
        }
        
        existing_data.sol_deposited += sol_amount;
        existing_data.tokens_received += tokens_to_receive;
        existing_data.sol_usd_price = sol_usd_price; // Update to latest price for reference
        existing_data
    };

    // Create SOL vault if it doesn't exist
    if sol_vault_account.owner != program_id {
        let rent = Rent::get()?;
        let rent_lamports = rent.minimum_balance(0); // Empty account for storing SOL
        
        let create_sol_vault_ix = system_instruction::create_account(
            investor.key,
            sol_vault_account.key,
            rent_lamports,
            0, // No data, just stores SOL
            program_id,
        );

        invoke_signed(
            &create_sol_vault_ix,
            &[
                investor.clone(),
                sol_vault_account.clone(),
                system_program.clone(),
            ],
            &[&[
                b"sol_vault",
                investor.key.as_ref(),
                global_escrow_account.key.as_ref(),
                &[sol_vault_bump],
            ]],
        )?;
    }

    // Split SOL: 50% to recipient, 50% to SOL vault for locking
    let sol_to_recipient = sol_amount / 2;
    let sol_to_lock = sol_amount - sol_to_recipient; // Remaining SOL goes to vault
    
    // Transfer 50% SOL to recipient
    let transfer_to_recipient_ix = system_instruction::transfer(
        investor.key,
        recipient_wallet.key,
        sol_to_recipient,
    );
    
    invoke(
        &transfer_to_recipient_ix,
        &[
            investor.clone(),
            recipient_wallet.clone(),
            system_program.clone(),
        ],
    )?;
    
    // Transfer 50% SOL to SOL vault for locking
    let transfer_to_vault_ix = system_instruction::transfer(
        investor.key,
        sol_vault_account.key,
        sol_to_lock,
    );
    
    invoke(
        &transfer_to_vault_ix,
        &[
            investor.clone(),
            sol_vault_account.clone(),
            system_program.clone(),
        ],
    )?;

    // SECURITY FIX: CEI Pattern - All external calls BEFORE state updates
    // Transfer all tokens to investor immediately
    let transfer_instruction = spl_instruction::transfer(
        token_program.key,
        token_vault_account.key,
        investor_token_account.key,
        global_escrow_account.key,
        &[],
        tokens_to_receive,
    )?;

    invoke_signed(
        &transfer_instruction,
        &[
            token_vault_account.clone(),
            investor_token_account.clone(),
            global_escrow_account.clone(),
            token_program.clone(),
        ],
        &[&[
            b"global_escrow",
            global_escrow.initializer_pubkey.as_ref(),
            global_escrow.token_mint_pubkey.as_ref(),
            &[global_escrow.bump_seed],
        ]],
    )?;

    // SECURITY FIX: Update state ONLY after all external calls succeed
    global_escrow.tokens_sold += tokens_to_receive;
    global_escrow.total_sol_deposited += sol_amount;
    global_escrow.serialize(&mut &mut global_escrow_account.data.borrow_mut()[..])?;

    // Update investor account state after successful token transfer
    investor_data.serialize(&mut &mut investor_account.data.borrow_mut()[..])?;

    msg!(
        "SOL deposited: {} lamports, tokens received: {}, price: {}",
        sol_amount,
        tokens_to_receive,
        sol_usd_price
    );
    
    Ok(())
}

pub fn process_withdraw_locked_sol(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
) -> ProgramResult {
    let account_info_iter = &mut accounts.iter();
    let withdrawer = next_account_info(account_info_iter)?;
    let global_escrow_account = next_account_info(account_info_iter)?;
    let investor_account = next_account_info(account_info_iter)?;
    let sol_vault_account = next_account_info(account_info_iter)?;
    let recipient_wallet = next_account_info(account_info_iter)?;
    let _system_program = next_account_info(account_info_iter)?;
    let _clock = next_account_info(account_info_iter)?;

    if !withdrawer.is_signer {
        return Err(ProgramError::MissingRequiredSignature);
    }

    // SECURITY: Validate investor account owner before deserializing
    if investor_account.owner != program_id {
        return Err(EscrowError::InvalidPDA.into());
    }

    // Load accounts
    let global_escrow = GlobalEscrow::try_from_slice(&global_escrow_account.data.borrow())?;
    let investor_data = InvestorAccount::try_from_slice(&investor_account.data.borrow())?;

    // SECURITY: Check if SOL has already been withdrawn (prevent double withdrawal)
    if investor_data.status == InvestorStatus::SolWithdrawn {
        return Err(EscrowError::NoSolToWithdraw.into());
    }
    
    // SECURITY: Only recipient_wallet can withdraw locked SOL
    if withdrawer.key != &global_escrow.recipient_wallet {
        return Err(EscrowError::Unauthorized.into());
    }

    // SECURITY: Verify investor account PDA consistency  
    let (expected_investor_pda, _) = find_investor_pda(
        &investor_data.investor_pubkey,
        &investor_data.global_escrow_pubkey,
        program_id,
    );
    if investor_account.key != &expected_investor_pda {
        return Err(EscrowError::InvalidPDA.into());
    }

    // SECURITY: Verify global escrow consistency
    if investor_data.global_escrow_pubkey != *global_escrow_account.key {
        return Err(EscrowError::InvalidPDA.into());
    }

    // Verify SOL vault PDA
    let (expected_sol_vault, _sol_vault_bump) = find_sol_vault_pda(
        &investor_data.investor_pubkey,
        &investor_data.global_escrow_pubkey,
        program_id,
    );
    
    if sol_vault_account.key != &expected_sol_vault {
        return Err(EscrowError::InvalidPDA.into());
    }

    // Check if GLOBAL lock period has passed (not individual investor timing)
    let current_timestamp = Clock::get()?.unix_timestamp;
    let global_unlock_time = global_escrow.initialization_timestamp + global_escrow.lock_duration;
    
    if current_timestamp < global_unlock_time {
        msg!("SOL still locked globally. Current: {}, Unlock at: {}", current_timestamp, global_unlock_time);
        return Err(EscrowError::SolStillLocked.into());
    }

    // Calculate locked SOL amount (50% of deposited)
    let sol_to_withdraw = investor_data.get_locked_sol_amount();
    
    // Check if SOL vault has enough balance
    let vault_balance = sol_vault_account.lamports();
    if vault_balance < sol_to_withdraw {
        return Err(EscrowError::NoSolToWithdraw.into());
    }

    // SAFETY: Ensure SOL vault remains rent-exempt after withdrawal
    let rent = Rent::get()?;
    let min_rent_balance = rent.minimum_balance(0);
    let remaining_balance = vault_balance - sol_to_withdraw;
    if remaining_balance < min_rent_balance {
        return Err(EscrowError::NotRentExempt.into());
    }

    // Verify recipient wallet matches the one stored in global escrow
    if recipient_wallet.key != &global_escrow.recipient_wallet {
        return Err(EscrowError::Unauthorized.into());
    }

    // Transfer locked SOL from SOL vault to recipient wallet
    **sol_vault_account.try_borrow_mut_lamports()? -= sol_to_withdraw;
    **recipient_wallet.try_borrow_mut_lamports()? += sol_to_withdraw;

    let mut updated_global_escrow = global_escrow;
    updated_global_escrow.total_sol_withdrawn += sol_to_withdraw;
    updated_global_escrow.serialize(&mut &mut global_escrow_account.data.borrow_mut()[..])?;

    // Update investor status to withdrawn
    let mut updated_investor_data = investor_data;
    updated_investor_data.status = InvestorStatus::SolWithdrawn;
    updated_investor_data.serialize(&mut &mut investor_account.data.borrow_mut()[..])?;

    msg!(
        "Locked SOL withdrawn: {} lamports to recipient wallet from SOL vault",
        sol_to_withdraw
    );
    
    Ok(())
}

pub fn process_get_escrow_status(accounts: &[AccountInfo]) -> ProgramResult {
    let account_info_iter = &mut accounts.iter();
    let global_escrow_account = next_account_info(account_info_iter)?;
    let _clock = next_account_info(account_info_iter)?;

    let global_escrow = GlobalEscrow::try_from_slice(&global_escrow_account.data.borrow())?;
    
    msg!("Escrow Status:");
    msg!("  Initialized: {}", global_escrow.is_initialized);
    msg!("  Total tokens: {}", global_escrow.total_tokens_available);
    msg!("  Tokens sold: {}", global_escrow.tokens_sold);
    msg!("  Total SOL deposited: {}", global_escrow.total_sol_deposited);
    msg!("  Total SOL withdrawn: {}", global_escrow.total_sol_withdrawn);
    msg!("  Lock duration: {}s", global_escrow.lock_duration);
    
    Ok(())
}

pub fn process_close_sale(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
) -> ProgramResult {
    let account_info_iter = &mut accounts.iter();
    let caller = next_account_info(account_info_iter)?; // recipient_wallet calling this
    let global_escrow_account = next_account_info(account_info_iter)?;
    let token_vault_account = next_account_info(account_info_iter)?;
    let recipient_token_account = next_account_info(account_info_iter)?; // recipient's token account to receive unsold tokens
    let token_program = next_account_info(account_info_iter)?;
    let _clock = next_account_info(account_info_iter)?;

    // Validate caller is signer
    if !caller.is_signer {
        return Err(ProgramError::MissingRequiredSignature);
    }

    // Validate token program
    if token_program.key != &spl_token::id() {
        return Err(ProgramError::IncorrectProgramId);
    }

    // Load global escrow data
    let global_escrow = GlobalEscrow::try_from_slice(&global_escrow_account.data.borrow())?;
    
    if !global_escrow.is_initialized {
        return Err(EscrowError::InvalidEscrowStatus.into());
    }

    // AUTHORIZATION: Only recipient_wallet can close sale and reclaim unsold tokens
    if caller.key != &global_escrow.recipient_wallet {
        msg!("Only recipient wallet can close sale. Expected: {}, Found: {}", global_escrow.recipient_wallet, caller.key);
        return Err(EscrowError::Unauthorized.into());
    }

    // Check if sale has ended (using sale_end_timestamp from immutable config)
    let current_timestamp = Clock::get()?.unix_timestamp;
    if current_timestamp < global_escrow.sale_end_timestamp {
        msg!("Sale has not ended yet. Current: {}, Sale ends: {}", current_timestamp, global_escrow.sale_end_timestamp);
        return Err(EscrowError::InvalidEscrowStatus.into());
    }

    // Calculate unsold tokens
    let unsold_tokens = global_escrow.total_tokens_available - global_escrow.tokens_sold;
    
    if unsold_tokens == 0 {
        msg!("No unsold tokens to reclaim");
        return Err(EscrowError::NotEnoughTokens.into());
    }

    // Validate token vault PDA
    let (expected_token_vault, _bump) = find_token_vault_pda(global_escrow_account.key, program_id);
    if token_vault_account.key != &expected_token_vault {
        return Err(EscrowError::InvalidPDA.into());
    }

    // Transfer unsold tokens from token vault to recipient
    let transfer_instruction = spl_instruction::transfer(
        token_program.key,
        token_vault_account.key,
        recipient_token_account.key,
        global_escrow_account.key,
        &[],
        unsold_tokens,
    )?;

    invoke_signed(
        &transfer_instruction,
        &[
            token_vault_account.clone(),
            recipient_token_account.clone(),
            global_escrow_account.clone(),
            token_program.clone(),
        ],
        &[&[
            b"global_escrow",
            global_escrow.initializer_pubkey.as_ref(),
            global_escrow.token_mint_pubkey.as_ref(),
            &[global_escrow.bump_seed],
        ]],
    )?;

    msg!(
        "Sale closed: {} unsold tokens transferred to recipient wallet",
        unsold_tokens
    );
    
    Ok(())
}
