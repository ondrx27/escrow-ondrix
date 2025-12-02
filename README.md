# Ondrix Escrow

## Contract Addresses

### BNB Smart Chain (Testnet)
- **Contract**: `0xd25bf3cbdb4efa7f6231535ffb5d7f621f4767af`
- **Token**: `0x95147725D225a74CeE2F40D2e856425b25D4Fa98`
- **Recipient**: `0x7B863a4618491Ca5AdB38cb1c4bb80FD23272253`
- **Network**: BSC Testnet (Chain ID: 97)
- **Status**: ✅ Verified on BscScan

### Solana (Devnet)
- **Program ID**: `6wed4KmcmSteExiur2gkyfDNgkwzUg77tadgX1x3tWSE`
- **Global Escrow**: `FxSCqi1tu17txoiJf5F6eiF7mrqAat4U9XynMm6xWmtg`
- **Token Mint**: `4xY7ica7H18vEnVgiFYiBACiGzANTztAJVELrjtXxqfR`
- **Recipient**: `EJ6bPvsTXfzk1WS9eXKDQ3KL5x9a2wy15XPxL48FdeAc`
- **Network**: Solana Devnet

## ABI

### BNB Smart Chain
```json
[
  {
    "inputs": [
      {"name": "_tokenContract", "type": "address"},
      {"name": "_recipientWallet", "type": "address"},
      {"name": "_tokenAmount", "type": "uint256"},
      {"name": "_lockDuration", "type": "uint256"},
      {"name": "_saleEndTimestamp", "type": "uint256"},
      {"name": "_priceFeed", "type": "address"},
      {"name": "_minBnbInvestment", "type": "uint256"},
      {"name": "_maxBnbInvestment", "type": "uint256"},
      {"name": "_priceStalenessThreshold", "type": "uint256"}
    ],
    "name": "initializeEscrow",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "depositBnb",
    "outputs": [],
    "stateMutability": "payable",
    "type": "function"
  },
  {
    "inputs": [{"name": "_investor", "type": "address"}],
    "name": "withdrawLockedBnb",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "withdrawPendingBnb",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  }
]
```

### Solana Program
```rust
pub enum EscrowInstruction {
    InitializeEscrow {
        token_amount: u64,
        lock_duration: i64,
        sale_end_timestamp: i64,
        min_sol_investment: u64,
        max_sol_investment: u64,
        price_staleness_threshold: u64,
    },
    DepositSol {
        sol_amount: u64,
    },
    WithdrawLockedSol {
        investor: Pubkey,
    },
}
```

## Initialization Parameters

### BNB Smart Chain
- **Token Amount**: 50,000 ODX
- **Lock Duration**: 300 seconds (5 minutes)
- **Min Investment**: 0.01 BNB
- **Max Investment**: 10,000 BNB
- **Price Feed**: `0x2514895c72f50D8bd4B4F9b1110F0D6bD2c97526`
- **Price Staleness**: 7,200 seconds (2 hours)

### Solana
- **Token Amount**: 1,000 tokens (9 decimals)
- **Lock Duration**: 300 seconds (5 minutes)
- **Min Investment**: 0.001 SOL
- **Max Investment**: 10,000 SOL
- **Price Staleness**: 300 seconds (5 minutes)

## Deploy/Verify Commands

### BNB Smart Chain
```bash
# Deploy
npx hardhat run scripts/deploy-simple.ts --network bscTestnet

# Verify
npx hardhat verify --network bscTestnet 0xd25bf3cbdb4efa7f6231535ffb5d7f621f4767af
```

### Solana
```bash
# Build
anchor build

# Deploy
anchor deploy --provider.cluster devnet

# Verify
solana program show 6wed4KmcmSteExiur2gkyfDNgkwzUg77tadgX1x3tWSE --url devnet
```

## Transaction Links

### BNB Smart Chain
1. **Initialization**: https://testnet.bscscan.com/tx/0x40730c928b4583a5a4d14da4155d3e61686c66e0dbad5ec8089fad56be6a6e1e
2. **Deposit**: https://testnet.bscscan.com/tx/0x22313ea32871a8bd100e96441bdf61ccba45c2bde9ea90cedcc249190aa7a3c1
3. **Withdraw Locked**: https://testnet.bscscan.com/tx/0x7e0a9f3818a2f9f2811021726791ff8317808d92422e25e8af98b46d251f6fb2
4. **Withdraw Pending**: https://testnet.bscscan.com/tx/0xe02559955df8551940535cfd87a9abc2a7797515faf971aa889a408ae3c1271b

### Solana
1. **Initialization**: https://explorer.solana.com/tx/2QGxi4UcKruTubCCVs5D68FTusC9nw6qQ8C2gBMW34xG7tWJY1napECruPx8NuqgXt5rb7sMPxFJ9dn9LFgBKqGS?cluster=devnet
2. **First Deposit**: https://explorer.solana.com/tx/4roUj2ebzPKyEpKX8fWSRLkZf1377Gkt5nKu7q27m2nr7Uzp9coGet298rqxKiMhAAgoesNviyiLstaKpVoDxayP?cluster=devnet
3. **First Claim**: https://explorer.solana.com/tx/2sawHmYTTavnd9tG5HJbhyYADVfRiL6wqT11PM4X3sM3UTva3XnrkPRN9yvJxHvbzaJZixTm3h9BkNBAxj7nUUx4?cluster=devnet
4. **Second Deposit**: https://explorer.solana.com/tx/3PTmL9BYJH1TxpbXPPiMRsD6RngePZeSifxMjd7ggJTi9yMuRMY9wJ47hu2NuHf7dBtrrmZKFxuyQAvZ7Pm8CXak?cluster=devnet
5. **Second Claim**: https://explorer.solana.com/tx/2k3gMrodjLkMa4BTnsgti5V6qzYNpDFXVYTLj5AULSebYrqN32pj5e1cs6TSEZPjeurvGAkQXf6GcKCoi9QLWau8?cluster=devnet

## Changelog

### v1.0.0 (2025-09-22)
#### BNB Smart Chain
- ✅ Contract deployed and verified on BSC Testnet
- ✅ Complete initialization, deposit, withdraw cycle tested
- ✅ Pull pattern for recipient withdrawals implemented
- ✅ Oracle price feed integration with staleness protection

#### Solana
- ✅ Program deployed on Solana Devnet
- ✅ Two complete investment cycles executed
- ✅ Multi-investor functionality verified
- ✅ Time-lock mechanism tested with 5-minute duration
- ✅ 50/50 fund distribution working correctly

<img width="1024" height="1024" alt="image" src="https://github.com/user-attachments/assets/4800311c-1e75-43df-b9a9-1eda271efc6f" />

