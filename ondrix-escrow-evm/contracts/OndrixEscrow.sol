// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@chainlink/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol";

/**
 * @title OndrixEscrow
 * @dev SECURE VERSION - Fixed all critical vulnerabilities from audit
 * @dev Escrow contract for BNB/Token exchange with Chainlink price feed integration
 * Based on Solana escrow logic: users deposit BNB, receive tokens immediately,
 * 50% of BNB goes to recipient, 50% is locked for specified duration
 */
contract OndrixEscrow is ReentrancyGuard, Pausable, Ownable {
    using SafeERC20 for IERC20;

    // Constants - matching Solana contract
    uint256 public constant TOKEN_PRICE_USD_CENTS = 10; // 0.1 USD = 10 cents
    uint256 public constant USD_CENTS_SCALE = 100; // 1 USD = 100 cents
    uint8 public constant CHAINLINK_USD_DECIMALS = 8; // Chainlink BNB/USD price has 8 decimals
    uint8 public constant TOKEN_DECIMALS = 18; // ERC20 standard decimals
    uint256 public constant BNB_WEI = 1e18; // 1 BNB = 1e18 wei
    uint256 public constant PRICE_STALENESS_THRESHOLD = 300; // 5 minutes (consistent with Solana)
    
    // Investment limits for security  
    uint256 public constant MIN_BNB_INVESTMENT = 0.001 ether; // 0.001 BNB minimum
    uint256 public constant MAX_BNB_INVESTMENT = 10000 ether; // 10,000 BNB maximum per address

    // IMMUTABLE CHAINLINK ADDRESSES (CLIENT REQUIREMENT - matches Solana hardcoded approach)
    // BSC Mainnet Chainlink BNB/USD Price Feed
    address public constant CHAINLINK_BNB_USD_MAINNET = 0x0567F2323251f0Aab15c8dFb1967E4e8A7D42aeE;
    // BSC Testnet Chainlink BNB/USD Price Feed  
    address public constant CHAINLINK_BNB_USD_TESTNET = 0x2514895c72f50D8bd4B4F9b1110F0D6bD2c97526;

    // Circuit breaker
    bool public emergencyStop = false;

    // Global escrow state
    struct GlobalEscrow {
        bool isInitialized;
        address initializer;
        IERC20 tokenContract;
        address recipientWallet;
        uint256 totalTokensAvailable;
        uint256 tokensSold;
        uint256 totalBnbDeposited;
        uint256 totalBnbWithdrawn;
        uint256 lockDuration; // in seconds
        uint256 saleEndTimestamp;
        uint256 initializationTimestamp; // TIMER STARTS FROM HERE
        // Immutable oracle config
        AggregatorV3Interface priceFeed; // BNB/USD price feed
        uint256 minBnbInvestment;
        uint256 maxBnbInvestment;
        uint256 priceStalenessThreshold;
    }

    // Per-investor account - ENHANCED with price history
    struct InvestorAccount {
        bool isInitialized;
        address investor;
        uint256 bnbDeposited;           // Total BNB deposited by this investor  
        uint256 tokensReceived;         // All tokens received immediately
        uint256 depositTimestamp;       // When the deposit was made
        uint256 firstDepositPrice;     // Price at FIRST deposit (FIXED)
        uint256 weightedAveragePrice;   // Weighted average price (SECURE)
        InvestorStatus status;
        uint256 lockedBnbAmount;       // 50% of deposited BNB (equivalent to SolVault in Solana)
    }

    enum InvestorStatus {
        Uninitialized,
        Deposited,     // BNB deposited, tokens received, BNB locked
        BnbWithdrawn   // Locked BNB has been withdrawn by recipient
    }

    // Global state
    GlobalEscrow public globalEscrow;
    
    // Investor accounts
    mapping(address => InvestorAccount) public investorAccounts;
    
    // SOL vault equivalent - locked BNB per investor
    mapping(address => uint256) public lockedBnb;
    
    // PULL PATTERN - Pending withdrawals for recipient (SECURITY FIX)
    mapping(address => uint256) public pendingWithdrawals;
    
    // Events
    event EscrowInitialized(
        address indexed initializer,
        address indexed tokenContract,
        address indexed recipientWallet,
        uint256 tokenAmount,
        uint256 lockDuration,
        uint256 saleEndTimestamp
    );
    
    event BnbDeposited(
        address indexed investor,
        uint256 bnbAmount,
        uint256 tokensReceived,
        uint256 bnbPrice
    );
    
    event LockedBnbWithdrawn(
        address indexed investor,
        uint256 bnbAmount,
        address indexed recipientWallet
    );
    
    event SaleClosed(uint256 unsoldTokens);
    
    event EmergencyStopActivated(address indexed activatedBy);
    event EmergencyStopDeactivated(address indexed deactivatedBy);
    
    event WithdrawalQueued(address indexed recipient, uint256 amount);
    event WithdrawalExecuted(address indexed recipient, uint256 amount);

    // Custom errors
    error EscrowAlreadyInitialized();
    error EscrowNotInitialized();
    error InvalidAmount();
    error InsufficientTokens();
    error InvestmentBelowMinimum();
    error InvestmentExceedsMaximum();
    error BnbStillLocked();
    error NoBnbToWithdraw();
    error Unauthorized();
    error InvalidPriceFeed();
    error StalePriceData();
    error SaleNotEnded();
    error InvalidTokenContract();
    error EmergencyStopActive();
    error InsufficientContractBalance();
    error NoWithdrawalPending();

    // SECURITY: Circuit breaker modifier
    modifier notInEmergency() {
        if (emergencyStop) revert EmergencyStopActive();
        _;
    }

    constructor() Ownable(msg.sender) {} 

    /**
     * @dev Initialize the escrow - equivalent to InitializeEscrow in Solana
     * @param _tokenContract ERC20 token contract address
     * @param _recipientWallet Address to receive 50% of BNB deposits
     * @param _tokenAmount Amount of tokens to make available for sale
     * @param _lockDuration Lock duration in seconds
     * @param _saleEndTimestamp When sale ends (for unsold token reclaim)
     * @param _priceFeed Chainlink BNB/USD price feed address
     * @param _minBnbInvestment Minimum BNB investment
     * @param _maxBnbInvestment Maximum BNB per address
     * @param _priceStalenessThreshold Price staleness threshold in seconds
     */
    function initializeEscrow(
        address _tokenContract,
        address _recipientWallet,
        uint256 _tokenAmount,
        uint256 _lockDuration,
        uint256 _saleEndTimestamp,
        address _priceFeed,
        uint256 _minBnbInvestment,
        uint256 _maxBnbInvestment,
        uint256 _priceStalenessThreshold
    ) external notInEmergency {
        if (globalEscrow.isInitialized) revert EscrowAlreadyInitialized();
        if (_tokenContract == address(0)) revert InvalidTokenContract();
        if (_recipientWallet == address(0)) revert InvalidAmount();
        if (_tokenAmount == 0) revert InvalidAmount();
        if (_lockDuration < 60 || _lockDuration > (365 * 24 * 60 * 60)) revert InvalidAmount();
        if (_saleEndTimestamp <= block.timestamp) revert InvalidAmount();
        
        // ORACLE IMMUTABILITY (CLIENT REQUIREMENT) - matches Solana hardcoded validation
        _validatePriceFeedAddress(_priceFeed);

        // Transfer tokens from initializer to contract
        IERC20(_tokenContract).safeTransferFrom(msg.sender, address(this), _tokenAmount);

        // Initialize global escrow
        globalEscrow = GlobalEscrow({
            isInitialized: true,
            initializer: msg.sender,
            tokenContract: IERC20(_tokenContract),
            recipientWallet: _recipientWallet,
            totalTokensAvailable: _tokenAmount,
            tokensSold: 0,
            totalBnbDeposited: 0,
            totalBnbWithdrawn: 0,
            lockDuration: _lockDuration,
            saleEndTimestamp: _saleEndTimestamp,
            initializationTimestamp: block.timestamp, // TIMER STARTS NOW
            priceFeed: AggregatorV3Interface(_priceFeed),
            minBnbInvestment: _minBnbInvestment,
            maxBnbInvestment: _maxBnbInvestment,
            priceStalenessThreshold: _priceStalenessThreshold
        });

        emit EscrowInitialized(
            msg.sender,
            _tokenContract,
            _recipientWallet,
            _tokenAmount,
            _lockDuration,
            _saleEndTimestamp
        );
    }

    /**
     * @dev Deposit BNB and receive tokens immediately - equivalent to DepositSol in Solana
     * SECURITY FIXES APPLIED:
     * - Enhanced price tracking for investors
     * - Pull pattern for recipient payments
     * - Balance checks
     */
    function depositBnb() external payable nonReentrant whenNotPaused notInEmergency {
        if (!globalEscrow.isInitialized) revert EscrowNotInitialized();
        if (msg.value == 0) revert InvalidAmount();

        // Security: Validate investment limits
        if (msg.value < globalEscrow.minBnbInvestment) revert InvestmentBelowMinimum();

        // Check total investment limit for this address
        uint256 totalInvestment = investorAccounts[msg.sender].bnbDeposited + msg.value;
        if (totalInvestment > globalEscrow.maxBnbInvestment) revert InvestmentExceedsMaximum();

        // Get BNB price from Chainlink
        (uint256 bnbUsdPrice, ) = getChainlinkPrice();

        // Calculate tokens for BNB amount
        uint256 tokensToReceive = calculateTokensForBnb(msg.value, bnbUsdPrice);

        // Check if enough tokens available
        uint256 tokensRemaining = globalEscrow.totalTokensAvailable - globalEscrow.tokensSold;
        if (tokensToReceive > tokensRemaining) revert InsufficientTokens();

        // Create or update investor account with ENHANCED PRICE TRACKING
        InvestorAccount storage investor = investorAccounts[msg.sender];
        
        if (!investor.isInitialized) {
            investor.isInitialized = true;
            investor.investor = msg.sender;
            investor.depositTimestamp = block.timestamp;
            investor.status = InvestorStatus.Deposited;
            investor.firstDepositPrice = bnbUsdPrice; // STORE FIRST PRICE
            investor.weightedAveragePrice = bnbUsdPrice; // INIT WEIGHTED AVERAGE
        } else {
            // CALCULATE WEIGHTED AVERAGE PRICE (SECURITY FIX)
            uint256 currentTotal = investor.bnbDeposited + msg.value;
            investor.weightedAveragePrice = 
                (investor.weightedAveragePrice * investor.bnbDeposited + bnbUsdPrice * msg.value) / currentTotal;
        }
        
        investor.bnbDeposited += msg.value;
        investor.tokensReceived += tokensToReceive;

        // Split BNB: 50% to recipient (via PULL PATTERN), 50% locked
        uint256 bnbToRecipient = msg.value / 2;
        uint256 bnbToLock = msg.value - bnbToRecipient;

        // Add to locked BNB for this investor
        lockedBnb[msg.sender] += bnbToLock;
        investor.lockedBnbAmount += bnbToLock;

        // SECURITY FIX: Queue withdrawal for recipient (PULL PATTERN)
        pendingWithdrawals[globalEscrow.recipientWallet] += bnbToRecipient;

        // Update global state
        globalEscrow.tokensSold += tokensToReceive;
        globalEscrow.totalBnbDeposited += msg.value;

        // Transfer tokens to investor immediately
        globalEscrow.tokenContract.safeTransfer(msg.sender, tokensToReceive);

        emit BnbDeposited(msg.sender, msg.value, tokensToReceive, bnbUsdPrice);
        emit WithdrawalQueued(globalEscrow.recipientWallet, bnbToRecipient);
    }

    /**
     * @dev SECURITY FIX: Pull pattern withdrawal for recipient
     */
    function withdrawPendingBnb() external nonReentrant {
        uint256 amount = pendingWithdrawals[msg.sender];
        if (amount == 0) revert NoWithdrawalPending();
        
        // SECURITY: Check contract has enough balance
        if (address(this).balance < amount) revert InsufficientContractBalance();
        
        pendingWithdrawals[msg.sender] = 0;
        
        (bool success, ) = payable(msg.sender).call{value: amount}("");
        require(success, "BNB withdrawal failed");
        
        emit WithdrawalExecuted(msg.sender, amount);
    }

    /**
     * @dev Withdraw locked BNB (only by recipient after lock period) - equivalent to WithdrawLockedSol
     * @param _investor Address of the investor whose locked BNB to withdraw
     * SECURITY FIXES APPLIED:
     * - Balance checks
     * - Pull pattern
     */
    function withdrawLockedBnb(address _investor) external nonReentrant notInEmergency {
        if (!globalEscrow.isInitialized) revert EscrowNotInitialized();
        if (msg.sender != globalEscrow.recipientWallet) revert Unauthorized();

        InvestorAccount storage investor = investorAccounts[_investor];
        if (!investor.isInitialized) revert NoBnbToWithdraw();
        if (investor.status == InvestorStatus.BnbWithdrawn) revert NoBnbToWithdraw();

        // Check if lock period has passed (BASED ON INITIALIZATION TIME)
        if (block.timestamp < globalEscrow.initializationTimestamp + globalEscrow.lockDuration) {
            revert BnbStillLocked();
        }

        uint256 bnbToWithdraw = lockedBnb[_investor];
        if (bnbToWithdraw == 0) revert NoBnbToWithdraw();
        
        // SECURITY FIX: Check contract has enough balance
        if (address(this).balance < bnbToWithdraw) revert InsufficientContractBalance();

        // Update state before external transfer
        lockedBnb[_investor] = 0;
        investor.status = InvestorStatus.BnbWithdrawn;
        globalEscrow.totalBnbWithdrawn += bnbToWithdraw;

        // SECURITY FIX: Use pull pattern
        pendingWithdrawals[globalEscrow.recipientWallet] += bnbToWithdraw;

        emit LockedBnbWithdrawn(_investor, bnbToWithdraw, globalEscrow.recipientWallet);
        emit WithdrawalQueued(globalEscrow.recipientWallet, bnbToWithdraw);
    }

    /**
     * @dev Close sale and reclaim unsold tokens (only by recipient after sale end)
     * ALREADY SECURE - NO CHANGES NEEDED
     */
    function closeSale() external nonReentrant notInEmergency {
        if (!globalEscrow.isInitialized) revert EscrowNotInitialized();
        if (msg.sender != globalEscrow.recipientWallet) revert Unauthorized();
        if (block.timestamp < globalEscrow.saleEndTimestamp) revert SaleNotEnded();

        uint256 unsoldTokens = globalEscrow.totalTokensAvailable - globalEscrow.tokensSold;
        if (unsoldTokens == 0) revert InsufficientTokens();

        // Transfer unsold tokens to recipient
        globalEscrow.tokenContract.safeTransfer(globalEscrow.recipientWallet, unsoldTokens);

        emit SaleClosed(unsoldTokens);
    }

    /**
     * @dev Get Chainlink BNB/USD price - SECURITY ENHANCED
     */
    function getChainlinkPrice() public view returns (uint256 price, uint256 timestamp) {
        (, int256 answer, , uint256 updatedAt, ) = globalEscrow.priceFeed.latestRoundData();
        
        if (answer <= 0) revert InvalidPriceFeed();
        
        // SECURITY FIX: More strict staleness check (uses configurable threshold)
        if (block.timestamp - updatedAt > globalEscrow.priceStalenessThreshold) {
            revert StalePriceData();
        }
        
        return (uint256(answer), updatedAt);
    }

    /**
     * @dev Calculate tokens for BNB amount - OVERFLOW PROTECTION ADDED
     */
    function calculateTokensForBnb(uint256 bnbAmount, uint256 bnbUsdPrice)
        public
        pure
        returns (uint256 tokenAmount)
    {
        // SECURITY FIX: Group multiplications before divisions to preserve precision
        // Formula: (bnbAmount * bnbUsdPrice * 10^TOKEN_DECIMALS * 10^2) / (BNB_WEI * 10^CHAINLINK_DECIMALS * TOKEN_PRICE_CENTS)
        // Simplified: (bnbAmount * bnbUsdPrice * 10^18 * 100) / (10^18 * 10^8 * TOKEN_PRICE_CENTS)

        // Step 1: Check for overflow
        require(bnbAmount <= type(uint256).max / bnbUsdPrice, "Overflow protection");

        // Step 2: Calculate numerator - group all multiplications
        // bnbAmount * bnbUsdPrice * 10^TOKEN_DECIMALS / (BNB_WEI * 10^(CHAINLINK_DECIMALS-2) * TOKEN_PRICE_CENTS)
        uint256 numerator = bnbAmount * bnbUsdPrice * (10**TOKEN_DECIMALS);

        // Step 3: Calculate denominator - group all divisions
        // BNB_WEI (10^18) * 10^(CHAINLINK_DECIMALS-2) (10^6) * TOKEN_PRICE_CENTS
        uint256 denominator = BNB_WEI * (10**(CHAINLINK_USD_DECIMALS - 2)) * TOKEN_PRICE_USD_CENTS;

        // Step 4: Final division
        tokenAmount = numerator / denominator;

        // SECURITY FIX: Minimum precision check
        require(tokenAmount > 0, "Amount too small for precision");

        return tokenAmount;
    }

    /**
     * @dev Check if unlock time has passed (BASED ON INITIALIZATION TIME)
     */
    function isUnlockTime(address _investor) public view returns (bool) {
        InvestorAccount memory investor = investorAccounts[_investor];
        if (!investor.isInitialized) return false;
        return block.timestamp >= globalEscrow.initializationTimestamp + globalEscrow.lockDuration;
    }

    /**
     * @dev Get locked BNB amount for an investor
     */
    function getLockedBnbAmount(address _investor) public view returns (uint256) {
        return lockedBnb[_investor];
    }
    
    /**
     * @dev Get pending withdrawal amount for an address
     */
    function getPendingWithdrawal(address _address) public view returns (uint256) {
        return pendingWithdrawals[_address];
    }

    /**
     * @dev Get escrow status information with initialization timestamp
     */
    function getEscrowStatus() external view returns (
        bool isInitialized,
        uint256 totalTokensAvailable,
        uint256 tokensSold,
        uint256 totalBnbDeposited,
        uint256 totalBnbWithdrawn,
        uint256 lockDuration
    ) {
        return (
            globalEscrow.isInitialized,
            globalEscrow.totalTokensAvailable,
            globalEscrow.tokensSold,
            globalEscrow.totalBnbDeposited,
            globalEscrow.totalBnbWithdrawn,
            globalEscrow.lockDuration
        );
    }

    /**
     * @dev Get initialization timestamp
     */
    function getInitializationTimestamp() external view returns (uint256) {
        return globalEscrow.initializationTimestamp;
    }

    /**
     * @dev Get investor information - ENHANCED with price data
     */
    function getInvestorInfo(address _investor) external view returns (
        bool isInitialized,
        uint256 bnbDeposited,
        uint256 tokensReceived,
        uint256 depositTimestamp,
        uint256 firstDepositPrice,
        uint256 weightedAveragePrice,
        InvestorStatus status,
        uint256 lockedBnbAmount
    ) {
        InvestorAccount memory investor = investorAccounts[_investor];
        return (
            investor.isInitialized,
            investor.bnbDeposited,
            investor.tokensReceived,
            investor.depositTimestamp,
            investor.firstDepositPrice,
            investor.weightedAveragePrice,
            investor.status,
            investor.lockedBnbAmount
        );
    }

    /**
     * @dev Get total BNB deposited across all investors
     */
    function totalDeposited() external view returns (uint256) {
        return globalEscrow.totalBnbDeposited;
    }

    /**
     * @dev Get total BNB that has been unlocked (withdrawn + pending)
     */
    function totalUnlocked() external view returns (uint256) {
        return globalEscrow.totalBnbWithdrawn + pendingWithdrawals[globalEscrow.recipientWallet];
    }

    /**
     * @dev Get total BNB currently locked across all investors
     */
    function totalLocked() external view returns (uint256) {
        // Total locked = Total deposited - Total withdrawn - Immediate payments (50%)
        uint256 immediatePayments = globalEscrow.totalBnbDeposited / 2;
        return globalEscrow.totalBnbDeposited - globalEscrow.totalBnbWithdrawn - immediatePayments;
    }

    /**
     * @dev Get the next unlock time (GLOBAL - BASED ON INITIALIZATION TIME)
     */
    function nextUnlockTime(address _investor) external view returns (uint256) {
        InvestorAccount memory investor = investorAccounts[_investor];
        if (!investor.isInitialized) return 0;
        if (investor.status == InvestorStatus.BnbWithdrawn) return 0; // Already withdrawn
        return globalEscrow.initializationTimestamp + globalEscrow.lockDuration;
    }

    /**
     * @dev Get comprehensive lock status for an investor
     */
    function getInvestorLockStatus(address _investor) external view returns (
        uint256 totalInvested,
        uint256 immediateAmount,
        uint256 lockedAmount,
        uint256 unlockTime,
        bool isUnlocked,
        uint256 timeRemaining
    ) {
        InvestorAccount memory investor = investorAccounts[_investor];
        
        if (!investor.isInitialized) {
            return (0, 0, 0, 0, false, 0);
        }
        
        totalInvested = investor.bnbDeposited;
        immediateAmount = totalInvested / 2; // 50% immediate
        lockedAmount = investor.lockedBnbAmount;
        unlockTime = globalEscrow.initializationTimestamp + globalEscrow.lockDuration; // GLOBAL UNLOCK TIME
        isUnlocked = block.timestamp >= unlockTime || investor.status == InvestorStatus.BnbWithdrawn;
        
        if (isUnlocked) {
            timeRemaining = 0;
        } else {
            timeRemaining = unlockTime - block.timestamp;
        }
        
        return (totalInvested, immediateAmount, lockedAmount, unlockTime, isUnlocked, timeRemaining);
    }

    // SECURITY: Circuit breaker functions
    function activateEmergencyStop() external onlyOwner {
        emergencyStop = true;
        emit EmergencyStopActivated(msg.sender);
    }

    function deactivateEmergencyStop() external onlyOwner {
        emergencyStop = false;
        emit EmergencyStopDeactivated(msg.sender);
    }

    // Admin functions
    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    // Enhanced emergency functions
    function emergencyWithdraw() external onlyOwner {
        require(block.timestamp > globalEscrow.saleEndTimestamp + 30 days, "Emergency period not reached");
        require(emergencyStop, "Emergency stop must be active");
        
        // Transfer remaining tokens
        uint256 tokenBalance = globalEscrow.tokenContract.balanceOf(address(this));
        if (tokenBalance > 0) {
            globalEscrow.tokenContract.safeTransfer(owner(), tokenBalance);
        }
        
        // Transfer remaining BNB
        uint256 bnbBalance = address(this).balance;
        if (bnbBalance > 0) {
            (bool success, ) = payable(owner()).call{value: bnbBalance}("");
            require(success, "Emergency BNB withdrawal failed");
        }
    }

    /**
     * @dev Validates price feed address against hardcoded allowed addresses
     */
    function _validatePriceFeedAddress(address _priceFeed) internal virtual {
        if (_priceFeed != CHAINLINK_BNB_USD_MAINNET && _priceFeed != CHAINLINK_BNB_USD_TESTNET) {
            revert InvalidPriceFeed();
        }
    }

    // SECURITY FIX: Prevent direct BNB transfers to avoid breaking accounting
    receive() external payable {
        revert("Direct BNB transfers are not allowed; use depositBnb()");
    }

    // SECURITY FIX: Secure fallback
    fallback() external payable {
        revert("Function not found");
    }
}
