# AnTzOS Discord Bot

A multi-chain Discord verification bot that enables users to prove ownership of Tezos domains and Ethereum/L2 NFTs to claim exclusive community roles.

## Features

### 🪐 **Tezos Verification**

- Verify ownership via **Tezos Domains** metadata (Nickname, Twitter, Description fields)
- Query official TzKT API for domain lookups and token balances
- Dual-query path: check by domain owner or domain resolver address
- Support for Tezos mainnet NFT collections

### ⛓️ **Ethereum & L2 Verification**

- **Hybrid token standard support**: ERC-721 (single-token) and ERC-1155 (multi-token) contracts
- **Signature-based verification**: Users sign a unique code via Etherscan's verified signatures tool
- **Multi-chain support**: Ethereum Mainnet, Base L2, Arbitrum One
- **Direct RPC queries**: No reliance on block explorers for asset checking
- Automatic chain detection via ERC-165 interface inspection

### 🔐 **Security**

- Local cryptographic signature verification using ethers.js
- No private keys required from users
- Environment-protected credentials (.env configuration)

### 🎯 **Discord Integration**

- Slash command `/verify` for easy access
- Interactive selection menu for chain choice
- Modal form submission for wallet address and proof data
- Automatic Discord role assignment upon successful verification
- Per-user verification sessions

## Setup

### Prerequisites

- Node.js 16+ and npm
- Discord bot token (create one at [Discord Developer Portal](https://discord.com/developers/applications))
- Guild/Server ID where the bot operates
- (Optional) Etherscan API key for legacy verification methods

### Installation

```bash
git clone https://github.com/PixelSushiRobot/antzos-bot.git
cd antzos-bot
npm install
```

### Configuration

Copy `.env.example` to `.env` and fill in your values:

```bash
cp .env.example .env
```

Edit `.env` with:

- `DISCORD_TOKEN`: Your bot token
- `GUILD_ID`: Your Discord server ID
- `TEZOS_ROLE_ID`: Role to assign for Tezos verification
- `ETH_ROLE_ID`: Role to assign for Ethereum verification
- `TEZOS_NFT_CONTRACT_ADDRESS`: Tezos contract address to verify
- `ETH_NFT_CONTRACT_ADDRESS`: Ethereum contract address to verify

### Running

**Development mode:**

```bash
npm run dev
```

**Production build:**

```bash
npm run build
```

## How It Works

### Tezos Flow

1. User runs `/verify` and selects "Tezos"
2. Bot generates a unique code (e.g., `Antzos-ABC123`)
3. User pastes code into their Tezos domain metadata and saves on-chain
4. User provides their wallet address to the bot
5. Bot queries TzKT API to verify code presence in domain records
6. If verified, bot checks for token holdings and assigns role

### Ethereum/L2 Flow

1. User runs `/verify` and selects "Ethereum / L2"
2. Bot generates a unique code
3. User signs the code via [etherscan.io/verifiedSignatures](https://etherscan.io/verifiedSignatures)
4. User pastes the signature hash into the bot's form
5. Bot verifies signature cryptographically
6. Bot queries RPC nodes to check for ERC-721 or ERC-1155 token balance
7. If verified, bot assigns role

## Architecture

```
src/
├── index.ts              # Discord bot entry point & interaction handler
├── verifiers/
│   ├── IChainVerifier.ts # Chain verifier interface
│   ├── TezosVerifier.ts  # Tezos domain & balance verification
│   └── EthVerifier.ts    # Ethereum hybrid ERC-721/1155 verification
```

## Technologies

- **Discord.js**: Discord bot framework
- **Ethers.js**: Ethereum signing and smart contract interaction
- **TzKT API**: Tezos blockchain data queries
- **TypeScript**: Type-safe implementation

## License

ISC
