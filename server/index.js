require("dotenv").config();
const express    = require("express");
const multer     = require("multer");
const crypto     = require("crypto");
const { ethers } = require("ethers");
const cors       = require("cors");
const fs         = require("fs");
const path       = require("path");

// ─── App Setup ────────────────────────────────────────────────────────────────
const app    = express();
const upload = multer({ dest: "uploads/" });

app.use(cors());
app.use(express.json());

// Ensure storage directories exist
if (!fs.existsSync("uploads"))    fs.mkdirSync("uploads");
if (!fs.existsSync("ipfs-store")) fs.mkdirSync("ipfs-store");

// ─── Contract ABI ─────────────────────────────────────────────────────────────
const CONTRACT_ABI = [
  "function storeEvidence(string calldata cid, string calldata hash) external",
  "function getEvidence(uint256 index) external view returns (string memory cid, string memory hash, address submitter, uint256 timestamp)",
  "function getEvidenceCount() external view returns (uint256)",
];

// ─── CID Generation (real CIDv1, no external API) ────────────────────────────
// Uses multiformats (ESM) via dynamic import — works in Node.js 18+
async function generateCID(fileBuffer) {
  const { CID }    = await import("multiformats/cid");
  const { sha256 } = await import("multiformats/hashes/sha2");
  const raw        = await import("multiformats/codecs/raw");

  const hash = await sha256.digest(fileBuffer);
  const cid  = CID.createV1(raw.code, hash);
  return cid.toString(); // base32 CIDv1 string – identical to what IPFS generates
}

// Store file locally, keyed by its CID
async function storeLocalIPFS(filePath) {
  const fileBuffer = fs.readFileSync(filePath);
  const cid        = await generateCID(fileBuffer);
  const storePath  = path.join("ipfs-store", cid);

  // Idempotent: skip if already stored (same content = same CID)
  if (!fs.existsSync(storePath)) {
    fs.copyFileSync(filePath, storePath);
  }

  return cid;
}

// ─── Blockchain helpers ───────────────────────────────────────────────────────
function getSignerContract() {
  const provider = new ethers.JsonRpcProvider(
    process.env.RPC_URL || "http://127.0.0.1:8545"
  );
  const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
  return new ethers.Contract(process.env.CONTRACT_ADDRESS, CONTRACT_ABI, wallet);
}

function getReadContract() {
  const provider = new ethers.JsonRpcProvider(
    process.env.RPC_URL || "http://127.0.0.1:8545"
  );
  return new ethers.Contract(process.env.CONTRACT_ADDRESS, CONTRACT_ABI, provider);
}

// ─── File utilities ───────────────────────────────────────────────────────────
function hashFile(filePath) {
  return new Promise((resolve, reject) => {
    const hash   = crypto.createHash("sha256");
    const stream = fs.createReadStream(filePath);
    stream.on("data",  (chunk) => hash.update(chunk));
    stream.on("end",   ()      => resolve(hash.digest("hex")));
    stream.on("error", reject);
  });
}

function cleanup(filePath) {
  try { if (filePath && fs.existsSync(filePath)) fs.unlinkSync(filePath); } catch (_) {}
}

function blockchainErrorMsg(err) {
  if (err.code === "ECONNREFUSED" || err.message?.includes("could not detect network")) {
    return "Blockchain node unreachable – open a terminal and run: npx hardhat node";
  }
  if (err.message?.includes("invalid private key") || err.message?.includes("PRIVATE_KEY")) {
    return "Invalid PRIVATE_KEY in .env – check server/.env";
  }
  return err.message || "Blockchain error";
}

// ─── Routes ───────────────────────────────────────────────────────────────────

/**
 * POST /upload
 * multipart/form-data: { file: <binary> }
 * → generates SHA-256 hash + CIDv1, stores locally, anchors on blockchain
 */
app.post("/upload", upload.single("file"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No file uploaded" });

  const tempPath = req.file.path;
  try {
    // 1. SHA-256 hash
    const hash = await hashFile(tempPath);

    // 2. Generate real CIDv1 + persist to local store
    const cid = await storeLocalIPFS(tempPath);

    // 3. Anchor on blockchain
    const contract = getSignerContract();
    const tx       = await contract.storeEvidence(cid, hash);
    await tx.wait();

    cleanup(tempPath);

    console.log(`[upload] ✅ CID=${cid}  hash=${hash.slice(0, 12)}…  tx=${tx.hash.slice(0, 12)}…`);

    return res.json({
      success: true,
      cid,
      hash,
      txHash:  tx.hash,
      ipfsUrl: `http://localhost:5000/ipfs/${cid}`,
    });
  } catch (err) {
    cleanup(tempPath);
    console.error("[/upload]", err.message);
    return res.status(502).json({ error: blockchainErrorMsg(err) });
  }
});

/**
 * GET /ipfs/:cid
 * Serves the stored file from the local ipfs-store directory.
 */
app.get("/ipfs/:cid", (req, res) => {
  const storePath = path.join("ipfs-store", req.params.cid);
  if (!fs.existsSync(storePath)) {
    return res.status(404).json({ error: "File not found in local store" });
  }
  res.sendFile(path.resolve(storePath));
});

/**
 * GET /verify?cid=<CID>
 * Recomputes hash from local store, compares with blockchain record.
 */
app.get("/verify", async (req, res) => {
  const { cid } = req.query;
  if (!cid) return res.status(400).json({ error: "Query param 'cid' is required" });

  try {
    // 1. Find record on blockchain
    const contract = getReadContract();
    const count    = Number(await contract.getEvidenceCount());
    let storedHash = null, evidenceIndex = null;

    for (let i = 0; i < count; i++) {
      const record = await contract.getEvidence(i);
      if (record.cid === cid) {
        storedHash    = record.hash;
        evidenceIndex = i;
        break;
      }
    }

    if (!storedHash) {
      return res.status(404).json({ error: "CID not found on blockchain" });
    }

    // 2. Read file from local store
    const storePath = path.join("ipfs-store", cid);
    if (!fs.existsSync(storePath)) {
      return res.status(404).json({
        error: "File not found in local store (was the server restarted?)",
      });
    }

    // 3. Recompute hash and compare
    const computedHash = crypto
      .createHash("sha256")
      .update(fs.readFileSync(storePath))
      .digest("hex");

    const isValid = computedHash === storedHash;

    return res.json({
      valid:         isValid,
      status:        isValid ? "VALID" : "TAMPERED",
      cid,
      storedHash,
      computedHash,
      evidenceIndex,
    });
  } catch (err) {
    console.error("[/verify]", err.message);
    return res.status(500).json({ error: err.message || "Verification failed" });
  }
});

/**
 * GET /evidence
 * Returns all on-chain evidence records.
 */
app.get("/evidence", async (req, res) => {
  try {
    const contract = getReadContract();
    const count    = Number(await contract.getEvidenceCount());
    const records  = [];

    for (let i = 0; i < count; i++) {
      const r = await contract.getEvidence(i);
      records.push({
        index:     i,
        cid:       r.cid,
        hash:      r.hash,
        submitter: r.submitter,
        timestamp: new Date(Number(r.timestamp) * 1000).toISOString(),
        ipfsUrl:   `http://localhost:5000/ipfs/${r.cid}`,
      });
    }

    return res.json({ count, records });
  } catch (err) {
    console.error("[/evidence]", err.message);
    return res.status(500).json({ error: err.message });
  }
});

// ─── Start ────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`\n🚀 Server running at http://localhost:${PORT}`);
  console.log(`   POST /upload             – submit file`);
  console.log(`   GET  /verify?cid=<CID>  – verify integrity`);
  console.log(`   GET  /evidence           – list all records`);
  console.log(`   GET  /ipfs/:cid          – retrieve stored file\n`);
});
