import { ethers } from "ethers";
import hre from "hardhat";

async function main() {
  console.log("🚀 Deploying new OndrixEscrow with 0.001 BNB minimum...");

  // Get provider and signer
  const rpcUrl = process.env.BSC_TESTNET_RPC_URL || "https://data-seed-prebsc-1-s1.bnbchain.org:8545";
  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const wallet = new ethers.Wallet(process.env.BSC_TESTNET_PRIVATE_KEY!, provider);
  
  console.log("Deploying with account:", wallet.address);
  const balance = await provider.getBalance(wallet.address);
  console.log("Account balance:", ethers.formatEther(balance), "BNB");

  // Get contract factory
  const escrowJson = await hre.artifacts.readArtifact("OndrixEscrow");
  const escrowFactory = new ethers.ContractFactory(escrowJson.abi, escrowJson.bytecode, wallet);
  
  // Deploy contract
  console.log("📦 Deploying OndrixEscrow contract...");
  const escrow = await escrowFactory.deploy();
  await escrow.waitForDeployment();
  const escrowAddress = await escrow.getAddress();
  
  console.log("✅ New OndrixEscrow deployed to:", escrowAddress);
  console.log("📝 Update frontend config to use this address");
  
  return escrowAddress;
}

main()
  .then((address) => {
    console.log("🎉 Deployment completed!");
    console.log("📄 New contract address:", address);
    process.exit(0);
  })
  .catch((error) => {
    console.error("❌ Deployment failed:", error);
    process.exit(1);
  });