# EvidenceChain 🔗

**Anonymous Evidence Submission System — Blockchain + IPFS**

> Upload a file anonymously → get its SHA-256 hash + IPFS CID →  
> both are stored on an Ethereum smart contract → verify integrity at any time.

---

## Project Structure

```
evidence-chain/
├── blockchain/          ← Hardhat + Solidity
│   ├── contracts/
│   │   └── Evidence.sol
│   ├── scripts/
│   │   └── deploy.js
│   ├── hardhat.config.js
│   └── package.json
├── server/              ← Node.js + Express
│   ├── index.js
│   ├── package.json
│   └── .env.example
└── client/              ← React + Vite
    ├── src/
    │   ├── App.jsx
    │   ├── main.jsx
    │   └── index.css
    ├── index.html
    ├── vite.config.js
    └── package.json
```

---

## Prerequisites

| Tool | Version |
|------|---------|
| Node.js | ≥ 18 |
| npm | ≥ 9 |
| Git | any |
| A Pinata account | https://app.pinata.cloud (free tier is enough) |

---

## Step-by-Step Setup

### 1 · Install dependencies (all three parts)

```bash
# Blockchain
cd blockchain
npm install

# Server
cd ../server
npm install

# Client
cd ../client
npm install
```

---

### 2 · Set up Pinata

1. Go to **https://app.pinata.cloud** and create a free account.
2. Navigate to **API Keys → New Key**.
3. Enable **pinFileToIPFS** permission.
4. Copy the **JWT** token shown after creation.

---

### 3 · Start the local Hardhat blockchain node

Open **Terminal A** and run:

```bash
cd blockchain
npx hardhat node
```

This starts a local Ethereum network at `http://127.0.0.1:8545`.  
You will see 20 test accounts with private keys printed — **copy the private key of Account #0**.  
It looks like: `0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80`

---

### 4 · Compile & deploy the smart contract

Open **Terminal B** and run:

```bash
cd blockchain
npx hardhat compile
npx hardhat run scripts/deploy.js --network localhost
```

You will see output like:
```
✅ Evidence contract deployed to: 0x5FbDB2315678afecb367f032d93F642f64180aa3
Copy this address into server/.env as CONTRACT_ADDRESS=...
```

**Copy that address.**

---

### 5 · Configure the server

```bash
cd server
cp .env.example .env
```

Edit `server/.env` and fill in:

```env
RPC_URL=http://127.0.0.1:8545
CONTRACT_ADDRESS=0x5FbDB2315678afecb367f032d93F642f64180aa3   # from step 4
PRIVATE_KEY=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80  # from step 3
PINATA_JWT=your_pinata_jwt_here   # from step 2
PORT=5000
```

> ⚠️ The `PRIVATE_KEY` above is a public Hardhat test key — it has no real money.  
> Never use a real wallet key with real ETH.

---

### 6 · Start the backend server

In **Terminal B** (or a new one):

```bash
cd server
npm run dev
```

Server starts at `http://localhost:5000`.

---

### 7 · Start the React frontend

Open **Terminal C**:

```bash
cd client
npm run dev
```

Open **http://localhost:3000** in your browser.

---

## How to Use

1. **Submit Evidence** — Click _Browse_ or drag a file onto the drop zone → click **Submit Evidence Anonymously**.  
   The UI shows you the CID, SHA-256 hash, and blockchain transaction hash.

2. **Verify Integrity** — Paste any CID into the _Verify Integrity_ box and click **Verify**.  
   The server fetches the file from IPFS, recomputes its SHA-256, and compares with the blockchain.  
   Result: **✅ VALID** or **🚨 TAMPERED**.

3. **View Records** — The _On-Chain Records_ card shows all submitted evidence pulled directly from the smart contract. Click **🔍 Verify this** to populate the verify box instantly.

---

## API Reference

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/upload` | Accepts `multipart/form-data` with field `file` |
| GET | `/verify?cid=<CID>` | Verify a file by CID |
| GET | `/evidence` | List all blockchain records |

---

## Smart Contract

**`Evidence.sol`** (deployed on local Hardhat network)

| Function | Description |
|----------|-------------|
| `storeEvidence(cid, hash)` | Store a CID + SHA-256 hash on-chain |
| `getEvidence(index)` | Retrieve a record by index |
| `getEvidenceCount()` | Total number of stored records |

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| `ECONNREFUSED` on server start | Hardhat node not running — run `npx hardhat node` first |
| `401` from Pinata | Wrong or expired JWT in `.env` |
| `Index out of bounds` on contract | Wrong `CONTRACT_ADDRESS` in `.env` |
| CID not found on verify | Submit the file first, or check CID spelling |
| Port 3000/5000 in use | Change `PORT` in `.env` and `server.port` in `vite.config.js` |

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18 + Vite 5 |
| Styling | Vanilla CSS (dark glassmorphism) |
| Backend | Node.js + Express 4 |
| File uploads | Multer |
| Hashing | Node.js `crypto` (SHA-256) |
| IPFS storage | Pinata API |
| Blockchain | Hardhat local network |
| Smart contract | Solidity 0.8.19 |
| Blockchain client | ethers.js v6 |
