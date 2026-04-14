import { useState, useCallback, useEffect, useRef } from "react";

const API = "/api"; // proxied to http://localhost:5000 via vite

// ─── Utility ──────────────────────────────────────────────────────────────────
function truncate(str, n = 20) {
  if (!str) return "";
  return str.length <= n ? str : `${str.slice(0, n)}…`;
}

function formatDate(iso) {
  return new Date(iso).toLocaleString();
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function ResultBox({ data, type }) {
  if (!data) return null;
  return (
    <div className={`result-box ${type}`}>
      {data.rows.map((row, i) => (
        <div className="result-row" key={i}>
          <span className="result-key">{row.key}</span>
          <span className="result-val">
            {row.link ? (
              <a href={row.link} target="_blank" rel="noopener noreferrer">
                {row.value}
              </a>
            ) : (
              row.value
            )}
          </span>
        </div>
      ))}
    </div>
  );
}

// ─── Upload Section ───────────────────────────────────────────────────────────
function UploadSection({ onUploadSuccess }) {
  const [file,    setFile]    = useState(null);
  const [loading, setLoading] = useState(false);
  const [result,  setResult]  = useState(null);
  const [error,   setError]   = useState(null);
  const [drag,    setDrag]    = useState(false);

  const handleFile = (f) => {
    if (!f) return;
    setFile(f);
    setResult(null);
    setError(null);
  };

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setDrag(false);
    const f = e.dataTransfer.files?.[0];
    if (f) handleFile(f);
  }, []);

  const handleSubmit = async () => {
    if (!file) return;
    setLoading(true);
    setResult(null);
    setError(null);

    const form = new FormData();
    form.append("file", file);

    try {
      const res  = await fetch(`${API}/upload`, { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload failed");

      setResult(data);
      if (onUploadSuccess) onUploadSuccess();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card">
      <div className="card-title">
        <div className="icon icon-upload">📤</div>
        Submit Evidence
      </div>

      {/* Drop Zone */}
      <div
        className={`drop-zone ${drag ? "drag-over" : ""}`}
        onDragOver={(e) => { e.preventDefault(); setDrag(true);  }}
        onDragLeave={() => setDrag(false)}
        onDrop={handleDrop}
      >
        <input
          id="file-input"
          type="file"
          onChange={(e) => handleFile(e.target.files?.[0])}
        />
        <div className="dz-icon">🗂️</div>
        <div className="dz-label">
          {file ? "File selected" : "Drop file here or click to browse"}
        </div>
        {file ? (
          <div className="dz-name">
            {file.name} &nbsp;·&nbsp; {(file.size / 1024).toFixed(1)} KB
          </div>
        ) : (
          <div className="dz-sub">Any file type · Max 50 MB</div>
        )}
      </div>

      <button
        id="submit-btn"
        className="btn btn-primary"
        onClick={handleSubmit}
        disabled={!file || loading}
      >
        {loading ? (
          <><div className="spinner" /> Uploading to IPFS & Blockchain…</>
        ) : (
          "🔒 Submit Evidence Anonymously"
        )}
      </button>

      {/* Success Result */}
      {result && (
        <div className="result-box success" style={{ marginTop: 20 }}>
          <div className="result-status status-valid">✅ Evidence Submitted</div>
          <div className="result-row">
            <span className="result-key">CID</span>
            <span className="result-val">{result.cid}</span>
          </div>
          <div className="result-row">
            <span className="result-key">SHA-256</span>
            <span className="result-val">{result.hash}</span>
          </div>
          <div className="result-row">
            <span className="result-key">Tx Hash</span>
            <span className="result-val">{result.txHash}</span>
          </div>
          <div className="result-row">
            <span className="result-key">IPFS Link</span>
            <span className="result-val">
              <a href={result.ipfsUrl} target="_blank" rel="noopener noreferrer">
                Open on IPFS ↗
              </a>
            </span>
          </div>
          <div style={{ marginTop: 12, fontSize: 12, color: "var(--text-muted)" }}>
            Save your CID — you'll need it for verification.
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="result-box error" style={{ marginTop: 20 }}>
          <div className="result-status" style={{ color: "var(--danger)" }}>❌ Error</div>
          <div className="result-row">
            <span className="result-val">{error}</span>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Verify Section ───────────────────────────────────────────────────────────
function VerifySection({ prefillCid }) {
  const [cid,     setCid]     = useState("");
  const [loading, setLoading] = useState(false);
  const [result,  setResult]  = useState(null);
  const [error,   setError]   = useState(null);

  // Allow parent to prefill CID
  useEffect(() => {
    if (prefillCid) { setCid(prefillCid); setResult(null); setError(null); }
  }, [prefillCid]);

  const handleVerify = async () => {
    const trimmed = cid.trim();
    if (!trimmed) return;
    setLoading(true);
    setResult(null);
    setError(null);

    try {
      const res  = await fetch(`${API}/verify?cid=${encodeURIComponent(trimmed)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Verification failed");
      setResult(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const isValid   = result?.valid === true;
  const isTampered = result?.valid === false;

  return (
    <div className="card">
      <div className="card-title">
        <div className="icon icon-verify">🔍</div>
        Verify Integrity
      </div>

      <div className="input-group">
        <label className="input-label" htmlFor="cid-input">IPFS CID</label>
        <div className="input-row">
          <input
            id="cid-input"
            type="text"
            value={cid}
            onChange={(e) => setCid(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleVerify()}
            placeholder="bafybeig…"
          />
          <button
            id="verify-btn"
            className="btn btn-verify-inline"
            onClick={handleVerify}
            disabled={!cid.trim() || loading}
          >
            {loading ? <div className="spinner" style={{ borderTopColor: "#fff" }} /> : "Verify"}
          </button>
        </div>
      </div>

      {/* Result */}
      {result && (
        <div className={`result-box ${isValid ? "success" : "error"}`} style={{ marginTop: 20 }}>
          <div className={`result-status ${isValid ? "status-valid" : "status-tampered"}`}>
            {isValid ? "✅ VALID — File is intact" : "🚨 TAMPERED — File has been modified"}
          </div>
          <div className="result-row">
            <span className="result-key">CID</span>
            <span className="result-val">{result.cid}</span>
          </div>
          <div className="result-row">
            <span className="result-key">Stored Hash</span>
            <span className="result-val">{result.storedHash}</span>
          </div>
          <div className="result-row">
            <span className="result-key">Computed Hash</span>
            <span className="result-val">{result.computedHash}</span>
          </div>
          <div className="result-row">
            <span className="result-key">Record #</span>
            <span className="result-val">#{result.evidenceIndex}</span>
          </div>
        </div>
      )}

      {error && (
        <div className="result-box error" style={{ marginTop: 20 }}>
          <div className="result-status" style={{ color: "var(--danger)" }}>❌ Error</div>
          <div className="result-row">
            <span className="result-val">{error}</span>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Records Section ──────────────────────────────────────────────────────────
function RecordsSection({ refreshTrigger, onFillCid }) {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState(null);

  const fetchRecords = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res  = await fetch(`${API}/evidence`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load records");
      setRecords(data.records || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchRecords(); }, [fetchRecords, refreshTrigger]);

  return (
    <div className="card">
      <div className="records-header">
        <div className="card-title" style={{ marginBottom: 0 }}>
          <div className="icon icon-records">📋</div>
          On-Chain Records
          {records.length > 0 && (
            <span style={{
              fontSize: 12, fontWeight: 500, color: "var(--text-muted)",
              background: "var(--surface-2)", border: "1px solid var(--border)",
              borderRadius: "999px", padding: "2px 10px"
            }}>
              {records.length}
            </span>
          )}
        </div>
        <button
          id="refresh-btn"
          className="btn btn-refresh"
          onClick={fetchRecords}
          disabled={loading}
        >
          {loading ? <div className="spinner" style={{ width: 14, height: 14, borderTopColor: "#c4b5fd" }} /> : "↻ Refresh"}
        </button>
      </div>

      <hr className="divider" />

      {error && (
        <div className="result-box error">
          <div className="result-row">
            <span className="result-val">{error}</span>
          </div>
        </div>
      )}

      {!loading && !error && records.length === 0 && (
        <div className="evidence-empty">No evidence submitted yet.</div>
      )}

      <div className="evidence-list">
        {records.map((r) => (
          <div className="evidence-item" key={r.index}>
            <div className="evidence-item-header">
              <span className="evidence-index">#{r.index}</span>
              <span className="evidence-ts">{formatDate(r.timestamp)}</span>
            </div>
            <div className="evidence-cid">CID: {r.cid}</div>
            <div className="evidence-hash">SHA-256: {r.hash}</div>
            <div className="evidence-actions">
              <button
                className="btn btn-sm btn-fill-cid"
                onClick={() => onFillCid(r.cid)}
              >
                🔍 Verify this
              </button>
              <a
                className="btn btn-sm btn-open-ipfs"
                href={r.ipfsUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                ↗ Open IPFS
              </a>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── App Root ─────────────────────────────────────────────────────────────────
export default function App() {
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [prefillCid,     setPrefillCid]     = useState("");

  const handleUploadSuccess = () => setRefreshTrigger((n) => n + 1);
  const handleFillCid       = (cid) => {
    setPrefillCid(cid);
    // Scroll to verify card
    document.getElementById("verify-section")?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <div className="app">
      {/* Header */}
      <header className="header">
        <div className="badge">🔗 Ethereum + IPFS</div>
        <h1>EvidenceChain</h1>
        <p>
          Submit files anonymously. Every upload is hashed, stored on IPFS,
          and anchored to the Ethereum blockchain — tamper-proof by design.
        </p>
      </header>

      {/* Upload */}
      <UploadSection onUploadSuccess={handleUploadSuccess} />

      {/* Verify */}
      <div id="verify-section">
        <VerifySection prefillCid={prefillCid} />
      </div>

      {/* Records */}
      <RecordsSection
        refreshTrigger={refreshTrigger}
        onFillCid={handleFillCid}
      />

      {/* Footer */}
      <footer className="footer">
        EvidenceChain · Anonymous · Immutable · Verifiable
      </footer>
    </div>
  );
}
