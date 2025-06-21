# Flight Delay Insurance on Sui

A decentralized parametric insurance dApp for flight delays built on Sui testnet.

## 🚀 Live Deployment

- **Contract Package ID**: `0x5ca97a7f3b2b9608848d234255cd34c50d6378d0155b9d779a68029b87fda700`
- **Insurance Pool Object ID**: `0x48ee799b814ccbdfb178ce0e248a80879354e97ac7778d20ad5e9c0182eea90c`
- **Network**: Sui Testnet

## 📋 Features

### Smart Contract Features
- ✅ Create insurance policies with custom coverage amounts
- ✅ Automatic claim processing for flight delays
- ✅ Payouts triggered when delays exceed 24 hours (1440 minutes)
- ✅ Event emission for policy creation and claim processing
- ✅ Shared insurance pool for managing premiums and payouts

### Frontend Features
- ✅ Connect Sui wallet (Sui Wallet, Suiet, etc.)
- ✅ Create insurance policies with flight details
- ✅ Process claims with delay information
- ✅ Real-time transaction status and feedback
- ✅ Modern, responsive UI

## 🛠️ Technology Stack

- **Blockchain**: Sui Testnet
- **Smart Contract**: Sui Move 2024
- **Frontend**: React + TypeScript
- **Wallet Integration**: @mysten/wallet-kit
- **Styling**: Tailwind CSS

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- Sui CLI
- Sui wallet (Sui Wallet, Suiet, etc.)

### Setup

1. **Clone and Install Dependencies**
   ```bash
   git clone <repository-url>
   cd Flight_Insurance_v2
   npm install
   ```

2. **Start Frontend**
   ```bash
   cd packages/frontend
   npm run dev
   ```

3. **Access the Application**
   - Open http://localhost:5173
   - Connect your Sui wallet
   - Start creating insurance policies!

## 📖 How to Use

### Creating a Policy
1. Connect your Sui wallet
2. Fill in flight details:
   - Flight number (e.g., "AA123")
   - Airline (e.g., "American Airlines")
   - Departure time
   - Coverage amount (in SUI)
   - Premium amount (in SUI)
3. Click "Create Policy"
4. Approve the transaction in your wallet
5. Note the Policy ID from the success message

### Processing a Claim
1. Enter the Policy ID from your created policy
2. Enter the delay in minutes
3. Click "Process Claim"
4. If delay ≥ 1440 minutes (24 hours), payout is automatically sent to your wallet

## 🔧 Contract Details

### Key Functions
- `create_policy()` - Create new insurance policy
- `process_claim()` - Process claim for delayed flight
- `get_policy_details()` - Get policy information
- `get_policies()` - Get all policies for an address

### Constants
- **Minimum Premium**: 0.01 SUI
- **Maximum Payout**: 100 SUI
- **Delay Threshold**: 1440 minutes (24 hours)

### Events
- `PolicyCreated` - Emitted when policy is created
- `ClaimProcessed` - Emitted when claim is processed

## 🧪 Testing

The contract is deployed on Sui testnet and ready for testing:

1. Get testnet SUI from the [Sui Faucet](https://discord.gg/sui)
2. Create a test policy with a small premium
3. Test claim processing with different delay values

## 📁 Project Structure

```
Flight_Insurance_v2/
├── packages/
│   ├── contract/           # Sui Move smart contract
│   │   ├── sources/
│   │   │   └── flight_insurance.move
│   │   └── Move.toml
│   └── frontend/           # React frontend
│       ├── src/
│       │   └── App.tsx
│       └── package.json
└── README.md
```

## 🔒 Security Notes

- This is a testnet deployment for demonstration purposes
- In production, additional security measures would be needed:
  - Oracle integration for real flight data
  - Multi-signature admin controls
  - Rate limiting and anti-spam measures
  - Comprehensive audit

## 🤝 Contributing

Feel free to submit issues and enhancement requests!

## 📄 License

MIT License 