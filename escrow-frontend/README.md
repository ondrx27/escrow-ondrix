# Ondrix Escrow Frontend

A secure investment platform with 50/50 split escrow protection for multi-chain investments.

## Features

- **Multi-Chain Support**: Solana Devnet and BSC Testnet
- **Secure Escrow**: 50% immediate, 50% time-locked protection
- **Real-time Monitoring**: Live contract status and investment tracking
- **Responsive Design**: Mobile-first with smooth animations
- **Professional UI**: Black-green theme with Tailwind CSS

## Tech Stack

- **Frontend**: React 18 + TypeScript + Vite
- **Styling**: Tailwind CSS + Framer Motion
- **Wallets**: Solana Wallet Adapter + Reown AppKit
- **Blockchain**: Ethers.js for contract interactions

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn

### Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the development server:
   ```bash
   npm run dev
   ```

4. Open http://localhost:3000 in your browser

### Environment Variables

Create a `.env` file with:
```
VITE_REOWN_PROJECT_ID=your-reown-project-id
```

## Contract Addresses

- **BNB Testnet Escrow**: `0x739F6012CFbc0a68e2D7180a1d55Cb6AF95180fe`
- **BNB Testnet Token**: `0xDf0B790BaA6Cdf852c6441c4a1474458CFff5c04`

## How It Works

1. **Connect Wallet**: Choose network (Solana/BNB) and connect wallet
2. **Invest**: Enter amount - 50% goes to project, 50% is time-locked
3. **Track**: Monitor investment status and unlock timer
4. **Withdraw**: Claim time-locked funds after 5-minute period

## Security Features

- Smart contract escrow with automatic splitting
- Time-lock protection mechanism
- Real-time price feed integration
- Immutable contract logic

## Development

### Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run lint` - Run ESLint
- `npm run preview` - Preview production build

### Project Structure

```
src/
├── components/          # React components
├── contexts/           # Context providers
├── config/            # Configuration files
├── types/             # TypeScript types
└── styles/            # Global styles
```

## Testnet Notice

⚠️ This application currently runs on testnets only:
- Solana Devnet
- BSC Testnet

Use testnet tokens only - not real funds.