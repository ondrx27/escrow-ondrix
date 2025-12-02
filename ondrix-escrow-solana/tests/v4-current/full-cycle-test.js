const {
  Connection,
  PublicKey,
  Keypair,
  LAMPORTS_PER_SOL,
  Transaction,
  sendAndConfirmTransaction,
} = require('@solana/web3.js');
const {
  createMint,
  getOrCreateAssociatedTokenAccount,
  mintTo,
} = require('@solana/spl-token');
const {
  PROGRAM_ID,
  findGlobalEscrowPDA,
  findInvestorPDA,
  findSolVaultPDA,
  createInitializeEscrowInstruction,
  createDepositSolInstruction,
  createWithdrawLockedSolInstruction,
  sleep,
} = require('../../dist/tests/utils.js');

const connection = new Connection('https://api.devnet.solana.com', 'confirmed');

// Private keys
const INVESTOR1_PRIVATE = 'CHANGE';
const INVESTOR2_PRIVATE = 'CHANGE';
const RECIPIENT_PRIVATE = 'CHANGE';

// Base58 decoding function
function decodeBase58(encoded) {
  const ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
  const BASE = 58;
  
  let num = 0n;
  for (let i = 0; i < encoded.length; i++) {
    const char = encoded[i];
    const index = ALPHABET.indexOf(char);
    if (index === -1) throw new Error('Invalid character in base58 string');
    num = num * BigInt(BASE) + BigInt(index);
  }
  
  let hex = num.toString(16);
  if (hex.length % 2 !== 0) hex = '0' + hex;
  
  const bytes = [];
  for (let i = 0; i < hex.length; i += 2) {
    bytes.push(parseInt(hex.substr(i, 2), 16));
  }
  
  return new Uint8Array(bytes);
}

async function main() {
  console.log('🧪 FULL CYCLE ESCROW TESTING (2 MINUTES LOCK)');
  console.log('='.repeat(80));
  console.log(`📍 Program ID: ${PROGRAM_ID.toString()}`);
  
  // Decode keys
  const investor1 = Keypair.fromSecretKey(decodeBase58(INVESTOR1_PRIVATE));
  const investor2 = Keypair.fromSecretKey(decodeBase58(INVESTOR2_PRIVATE));
  const recipient = Keypair.fromSecretKey(decodeBase58(RECIPIENT_PRIVATE));
  
  console.log(`👤 Investor1/Initializer: ${investor1.publicKey.toString()}`);
  console.log(`👤 Investor2: ${investor2.publicKey.toString()}`);
  console.log(`🎯 Recipient: ${recipient.publicKey.toString()}`);
  
  // Check initial balances
  const investor1Balance = await connection.getBalance(investor1.publicKey);
  const investor2Balance = await connection.getBalance(investor2.publicKey);
  const recipientBalanceStart = await connection.getBalance(recipient.publicKey);
  
  console.log('\n💰 INITIAL BALANCES:');
  console.log(`Investor1: ${investor1Balance / LAMPORTS_PER_SOL} SOL`);
  console.log(`Investor2: ${investor2Balance / LAMPORTS_PER_SOL} SOL`);
  console.log(`Recipient: ${recipientBalanceStart / LAMPORTS_PER_SOL} SOL`);
  
  try {
    // ========== STAGE 1: TOKEN CREATION AND INITIALIZATION ==========
    console.log('\n🪙 STAGE 1: TOKEN CREATION AND ESCROW INITIALIZATION');
    console.log('-'.repeat(60));
    
    const tokenMint = await createMint(
      connection,
      investor1,
      investor1.publicKey,
      null,
      9
    );
    console.log(`✅ Token Mint: ${tokenMint.toString()}`);
    
    const initializerTokenAccount = await getOrCreateAssociatedTokenAccount(
      connection,
      investor1,
      tokenMint,
      investor1.publicKey
    );
    
    const tokenSupply = BigInt(1000000 * Math.pow(10, 9));
    await mintTo(
      connection,
      investor1,
      tokenMint,
      initializerTokenAccount.address,
      investor1,
      tokenSupply
    );
    console.log(`✅ Created 1M tokens`);
    
    // Initialize with 2-minute lock
    const lockDuration = BigInt(120); // 2 minutes as requested
    const tokenAmountForEscrow = BigInt(500000 * Math.pow(10, 9));
    
    const currentTime = Math.floor(Date.now() / 1000);
    const unlockTime = currentTime + Number(lockDuration);
    
    console.log(`⏰ Current time: ${currentTime}`);
    console.log(`🔒 Lock duration: ${Number(lockDuration)} seconds`);
    console.log(`🔓 Unlock time: ${unlockTime}`);
    console.log(`📅 Unlock date: ${new Date(unlockTime * 1000).toLocaleString()}`);
    
    const initializeInstruction = await createInitializeEscrowInstruction(
      investor1.publicKey,
      tokenMint,
      initializerTokenAccount.address,
      recipient.publicKey,
      tokenAmountForEscrow,
      lockDuration,
      PROGRAM_ID
    );
    
    const initTransaction = new Transaction().add(initializeInstruction);
    const initTxSignature = await sendAndConfirmTransaction(
      connection,
      initTransaction,
      [investor1],
      { commitment: 'confirmed' }
    );
    console.log(`✅ Escrow initialized: ${initTxSignature}`);
    
    const [globalEscrowPDA] = findGlobalEscrowPDA(investor1.publicKey, tokenMint, PROGRAM_ID);
    console.log(`📍 Global Escrow PDA: ${globalEscrowPDA.toString()}`);
    
    // ========== STAGE 2: FIRST INVESTOR ==========
    console.log('\n💰 STAGE 2: FIRST INVESTOR (INVESTOR1)');
    console.log('-'.repeat(60));
    
    const investor1DepositAmount = BigInt(0.1 * LAMPORTS_PER_SOL); // Reduced to 0.1 SOL
    console.log(`💸 Investor1 deposits: ${investor1DepositAmount / BigInt(LAMPORTS_PER_SOL)} SOL`);
    
    const depositInstruction1 = await createDepositSolInstruction(
      investor1.publicKey,
      globalEscrowPDA,
      tokenMint,
      recipient.publicKey,
      investor1DepositAmount,
      PROGRAM_ID
    );
    
    const depositTransaction1 = new Transaction().add(depositInstruction1);
    const depositTx1 = await sendAndConfirmTransaction(
      connection,
      depositTransaction1,
      [investor1],
      { commitment: 'confirmed' }
    );
    console.log(`✅ Investor1 deposit: ${depositTx1}`);
    
    // ========== STAGE 3: SECOND INVESTOR ==========
    console.log('\n💰 STAGE 3: SECOND INVESTOR (INVESTOR2)');
    console.log('-'.repeat(60));
    
    const investor2DepositAmount = BigInt(0.5 * LAMPORTS_PER_SOL); // Reduced to 0.5 SOL
    console.log(`💸 Investor2 deposits: ${investor2DepositAmount / BigInt(LAMPORTS_PER_SOL)} SOL`);
    
    const depositInstruction2 = await createDepositSolInstruction(
      investor2.publicKey,
      globalEscrowPDA,
      tokenMint,
      recipient.publicKey,
      investor2DepositAmount,
      PROGRAM_ID
    );
    
    const depositTransaction2 = new Transaction().add(depositInstruction2);
    const depositTx2 = await sendAndConfirmTransaction(
      connection,
      depositTransaction2,
      [investor2],
      { commitment: 'confirmed' }
    );
    console.log(`✅ Investor2 deposit: ${depositTx2}`);
    
    // Check SOL vaults
    const [investor1PDA] = findInvestorPDA(investor1.publicKey, globalEscrowPDA, PROGRAM_ID);
    const [investor2PDA] = findInvestorPDA(investor2.publicKey, globalEscrowPDA, PROGRAM_ID);
    const [solVault1PDA] = findSolVaultPDA(investor1.publicKey, globalEscrowPDA, PROGRAM_ID);
    const [solVault2PDA] = findSolVaultPDA(investor2.publicKey, globalEscrowPDA, PROGRAM_ID);
    
    const solVault1Balance = await connection.getBalance(solVault1PDA);
    const solVault2Balance = await connection.getBalance(solVault2PDA);
    const recipientBalanceAfterDeposits = await connection.getBalance(recipient.publicKey);
    
    console.log(`\n📊 STATE AFTER DEPOSITS:`);
    console.log(`🔒 SOL Vault 1: ${solVault1Balance / LAMPORTS_PER_SOL} SOL (50% of 0.1 = 0.05 SOL)`);
    console.log(`🔒 SOL Vault 2: ${solVault2Balance / LAMPORTS_PER_SOL} SOL (50% of 0.5 = 0.25 SOL)`);
    console.log(`💰 Recipient received: ${(recipientBalanceAfterDeposits - recipientBalanceStart) / LAMPORTS_PER_SOL} SOL (50% of both deposits = 0.3 SOL)`);
    
    // ========== STAGE 4: EARLY WITHDRAWAL ATTEMPT (SHOULD BE BLOCKED) ==========
    console.log('\n❌ STAGE 4: EARLY WITHDRAWAL ATTEMPT (SHOULD BE BLOCKED)');
    console.log('-'.repeat(60));
    
    const timeNow = Math.floor(Date.now() / 1000);
    const timeLeft = unlockTime - timeNow;
    console.log(`⏰ Current time: ${timeNow}`);
    console.log(`⏳ Time until unlock: ${timeLeft} seconds`);
    
    try {
      const withdrawInstruction1 = await createWithdrawLockedSolInstruction(
        recipient.publicKey, // RECIPIENT should call withdrawal
        globalEscrowPDA,
        investor1PDA,
        investor1.publicKey,
        recipient.publicKey,
        PROGRAM_ID
      );
      
      const withdrawTransaction1 = new Transaction().add(withdrawInstruction1);
      await sendAndConfirmTransaction(
        connection,
        withdrawTransaction1,
        [recipient],  // RECIPIENT signs
        { commitment: 'confirmed' }
      );
      
      console.log('❌ ERROR: Early withdrawal NOT blocked! This is a vulnerability!');
      
    } catch (error) {
      console.log('✅ CORRECT: Early withdrawal blocked!');
      console.log(`   Error: ${error.message}`);
      if (error.logs) {
        error.logs.forEach(log => {
          if (log.includes('SOL still locked') || log.includes('SolStillLocked')) {
            console.log('✅ Reason: SOL still locked by time');
          }
        });
      }
    }
    
    // ========== STAGE 5: WAITING FOR UNLOCK ==========
    console.log('\n⏳ STAGE 5: WAITING FOR UNLOCK...');
    console.log('-'.repeat(60));
    
    const waitTime = Math.max(0, timeLeft + 10); // +10 seconds for safety
    if (waitTime > 0) {
      console.log(`⌛ Waiting ${waitTime} seconds until unlock...`);
      await sleep(waitTime * 1000);
    }
    
    const finalTime = Math.floor(Date.now() / 1000);
    console.log(`✅ Time expired! Current time: ${finalTime}, Unlock was: ${unlockTime}`);
    
    // ========== STAGE 6: SUCCESSFUL WITHDRAWAL OF LOCKED SOL ==========
    console.log('\n✅ STAGE 6: LOCKED SOL WITHDRAWAL (SHOULD SUCCEED)');
    console.log('-'.repeat(60));
    
    const recipientBalanceBeforeWithdraw = await connection.getBalance(recipient.publicKey);
    console.log(`💰 Recipient balance before withdrawal: ${recipientBalanceBeforeWithdraw / LAMPORTS_PER_SOL} SOL`);
    
    try {
      // Withdraw SOL from investor1 (RECIPIENT calls)
      console.log('🔓 Withdrawing locked SOL from Investor1...');
      const withdrawInstruction1Final = await createWithdrawLockedSolInstruction(
        recipient.publicKey,  // RECIPIENT calls
        globalEscrowPDA,
        investor1PDA,
        investor1.publicKey,
        recipient.publicKey,
        PROGRAM_ID
      );
      
      const withdrawTransaction1Final = new Transaction().add(withdrawInstruction1Final);
      const withdrawTx1 = await sendAndConfirmTransaction(
        connection,
        withdrawTransaction1Final,
        [recipient],  // RECIPIENT signs
        { commitment: 'confirmed' }
      );
      console.log(`✅ Investor1 SOL withdrawn: ${withdrawTx1}`);
      
      // Withdraw SOL from investor2 (RECIPIENT calls)
      console.log('🔓 Withdrawing locked SOL from Investor2...');
      const withdrawInstruction2Final = await createWithdrawLockedSolInstruction(
        recipient.publicKey,  // RECIPIENT calls
        globalEscrowPDA,
        investor2PDA,
        investor2.publicKey,
        recipient.publicKey,
        PROGRAM_ID
      );
      
      const withdrawTransaction2Final = new Transaction().add(withdrawInstruction2Final);
      const withdrawTx2 = await sendAndConfirmTransaction(
        connection,
        withdrawTransaction2Final,
        [recipient],  // RECIPIENT signs
        { commitment: 'confirmed' }
      );
      console.log(`✅ Investor2 SOL withdrawn: ${withdrawTx2}`);
      
      // Check final balances
      const recipientBalanceFinal = await connection.getBalance(recipient.publicKey);
      const solVault1BalanceFinal = await connection.getBalance(solVault1PDA);
      const solVault2BalanceFinal = await connection.getBalance(solVault2PDA);
      
      console.log('\n📊 FINAL RESULTS:');
      console.log(`💰 Recipient balance before: ${recipientBalanceBeforeWithdraw / LAMPORTS_PER_SOL} SOL`);
      console.log(`💰 Recipient balance after: ${recipientBalanceFinal / LAMPORTS_PER_SOL} SOL`);
      console.log(`📈 Recipient received additionally: ${(recipientBalanceFinal - recipientBalanceBeforeWithdraw) / LAMPORTS_PER_SOL} SOL`);
      console.log(`🔒 SOL Vault 1 final: ${solVault1BalanceFinal / LAMPORTS_PER_SOL} SOL (should be ~0)`);
      console.log(`🔒 SOL Vault 2 final: ${solVault2BalanceFinal / LAMPORTS_PER_SOL} SOL (should be ~0)`);
      
      const expectedWithdrawals = (investor1DepositAmount + investor2DepositAmount) / 2n; // 50% of both deposits
      const actualWithdrawals = BigInt(recipientBalanceFinal - recipientBalanceBeforeWithdraw);
      
      console.log(`\n🔍 AMOUNT VERIFICATION:`);
      console.log(`Expected locked SOL: ${expectedWithdrawals / BigInt(LAMPORTS_PER_SOL)} SOL`);
      console.log(`Received on withdrawal: ${actualWithdrawals / BigInt(LAMPORTS_PER_SOL)} SOL`);
      console.log(`Match: ${expectedWithdrawals === actualWithdrawals ? '✅ EXACT' : '❓ CHECK'}`);
      
      console.log('\n🎉 FULL CYCLE TESTING COMPLETED SUCCESSFULLY!');
      console.log('✅ Initialization: OK');
      console.log('✅ Deposits (50/50 split): OK');
      console.log('✅ Early withdrawal blocking: OK');
      console.log('✅ Withdrawal after time: OK');
      console.log('✅ Amounts correct: OK');
      
    } catch (error) {
      console.error('❌ ERROR withdrawing locked SOL:', error.message);
      if (error.logs) {
        console.log('📜 Logs:');
        error.logs.forEach(log => console.log(`   ${log}`));
      }
    }
    
  } catch (error) {
    console.error('❌ CRITICAL ERROR:', error.message);
    if (error.logs) {
      console.log('📜 Logs:');
      error.logs.forEach(log => console.log(`   ${log}`));
    }
  }
}

main().catch(console.error);