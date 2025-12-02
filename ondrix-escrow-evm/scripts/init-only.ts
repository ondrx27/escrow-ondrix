import { ethers } from "ethers";
import hre from "hardhat";

async function main() {
  console.log("🚀 Initializing new escrow contract...");

  // Get provider and signer
  const rpcUrl = process.env.BSC_TESTNET_RPC_URL || "https://data-seed-prebsc-1-s1.bnbchain.org:8545";
  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const wallet = new ethers.Wallet(process.env.BSC_TESTNET_PRIVATE_KEY!, provider);
  
  console.log("Using account:", wallet.address);
  const balance = await provider.getBalance(wallet.address);
  console.log("Account balance:", ethers.formatEther(balance), "BNB");

  const ESCROW_ADDRESS = "0x00B3a9d0598FE7203365f9DbDe1547D265D23141"; // New contract

  // Deploy Mock Token first
  console.log("📦 Step 1: Deploying Mock ODX Token...");
  const tokenJson = await hre.artifacts.readArtifact("MockERC20");
  const tokenFactory = new ethers.ContractFactory(tokenJson.abi, tokenJson.bytecode, wallet);
  const token = await tokenFactory.deploy("Ondrix Token", "ODX", ethers.parseEther("1000000")); // 1M tokens
  await token.waitForDeployment();
  const tokenAddress = await token.getAddress();
  console.log("✅ Mock ODX Token deployed to:", tokenAddress);

  // Parameters
  const RECIPIENT_WALLET = "0x752669e07416E42b318471Eea005f7c9A7828ADF";
  const PRICE_FEED_ADDRESS = "0x2514895c72f50D8bd4B4F9b1110F0D6bD2c97526"; // BSC Testnet BNB/USD
  const TOKEN_AMOUNT = ethers.parseEther("10000"); // 10K tokens for testing
  const LOCK_DURATION = 5 * 60; // 5 minutes
  const MIN_BNB_INVESTMENT = ethers.parseEther("0.001"); // 0.001 BNB minimum
  const MAX_BNB_INVESTMENT = ethers.parseEther("10"); // 10 BNB maximum  
  const PRICE_STALENESS_THRESHOLD = 120; // 2 minutes
  const SALE_END_TIMESTAMP = Math.floor(Date.now() / 1000) + (30 * 24 * 60 * 60); // 30 days

  // Get contract instance
  const escrowAbi = (await hre.artifacts.readArtifact("OndrixEscrow")).abi;
  const escrow = new ethers.Contract(ESCROW_ADDRESS, escrowAbi, wallet);

  // Step 2: Approve tokens for the escrow contract
  console.log("🔐 Step 2: Approving tokens...");
  const approveTx = await token.approve(ESCROW_ADDRESS, TOKEN_AMOUNT);
  await approveTx.wait();
  console.log("✅ Tokens approved");

  // Step 3: Initialize the escrow
  console.log("🚀 Step 3: Initializing escrow...");
  const initTx = await escrow.initializeEscrow(
    tokenAddress,
    RECIPIENT_WALLET,
    TOKEN_AMOUNT,
    LOCK_DURATION,
    SALE_END_TIMESTAMP,
    PRICE_FEED_ADDRESS,
    MIN_BNB_INVESTMENT,
    MAX_BNB_INVESTMENT,
    PRICE_STALENESS_THRESHOLD
  );
  
  console.log("⏳ Waiting for initialization transaction...");
  await initTx.wait();
  console.log("✅ Escrow initialized successfully!");

  // Step 4: Verify initialization
  console.log("🔍 Step 4: Verifying initialization...");
  const status = await escrow.getEscrowStatus();
  
  console.log("📋 Escrow Status:");
  console.log("- Initialized:", status.isInitialized);
  console.log("- Total tokens available:", ethers.formatEther(status.totalTokensAvailable), "ODX");
  console.log("- Lock duration:", status.lockDuration.toString(), "seconds");
  
  console.log("🎉 SUCCESS! Contract ready with 0.001 BNB minimum!");
  console.log("📝 Contract addresses:");
  console.log("- Escrow:", ESCROW_ADDRESS);
  console.log("- Token:", tokenAddress);
  
  return { escrow: ESCROW_ADDRESS, token: tokenAddress };
}

main()
  .then((addresses) => {
    console.log("✅ Initialization completed!");
    console.log("📄 Update frontend token address:", addresses.token);
    process.exit(0);
  })
  .catch((error) => {
    console.error("❌ Initialization failed:", error);
    process.exit(1);
  });