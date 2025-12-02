import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox-mocha-ethers";
import * as dotenv from "dotenv";

dotenv.config();

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.20",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
      viaIR: true, // Enable IR-based code generator to fix "stack too deep"
    },
  },
  networks: {
    hardhatMainnet: {
      type: "edr-simulated",
      chainType: "l1",
    },
    hardhatOp: {
      type: "edr-simulated",
      chainType: "op",
    },
  },
};

// Only add live networks if private keys are available and non-empty
// This allows CI/CD to work without any environment variables
const sepoliaKey = process.env.SEPOLIA_PRIVATE_KEY?.trim();
if (sepoliaKey && sepoliaKey.length > 0 && sepoliaKey.startsWith('0x')) {
  config.networks!.sepolia = {
    type: "http",
    chainType: "l1",
    url: process.env.SEPOLIA_RPC_URL || "https://rpc.sepolia.org",
    accounts: [sepoliaKey],
  };
}

const bscKey = process.env.BSC_PRIVATE_KEY?.trim();
if (bscKey && bscKey.length > 0 && bscKey.startsWith('0x')) {
  config.networks!.bsc = {
    type: "http",
    chainType: "l1",
    url: "https://bsc-dataseed1.binance.org/",
    accounts: [bscKey],
    gasPrice: 5000000000, // 5 gwei
  };
}

const bscTestnetKey = process.env.BSC_TESTNET_PRIVATE_KEY?.trim();
if (bscTestnetKey && bscTestnetKey.length > 0 && bscTestnetKey.startsWith('0x')) {
  config.networks!.bscTestnet = {
    type: "http",
    chainType: "l1",
    url: process.env.BSC_TESTNET_RPC_URL || "https://data-seed-prebsc-1-s1.binance.org:8545/",
    accounts: [bscTestnetKey],
    gasPrice: 10000000000, // 10 gwei
  };
}

export default config;
