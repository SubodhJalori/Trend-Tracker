import { useState, useRef, useEffect, useCallback } from "react";

// Uses Claude to suggest Instagram usernames for a keyword query,
// then optionally verifies them via Apify profile lookup

async function suggestUsernames(query) {
  const res = await fetch("/api/claude", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 600,
      messages: [{
        role: "user",
        content: `You are an Instagram brand expert. A user searched for: "${query}"

List the top 8 most likely Instagram account usernames that match this search — real brands, creators, or businesses that have Instagram accounts related to this query.

Rules:
- Return ONLY real, existing Instagram accounts you are confident about
- Prioritise well-known brands over obscure ones
- Include a mix of account sizes if relevant
- For Indian brands/queries, include Indian accounts

Respond with ONLY raw JSON, no markdown, no explanation:
{"results":[{"username":"string","name":"string","description":"string","category":"string","estimatedFollowers":"string"}]}`
      }],
    }),
  });
  const data = await res.json();
  const text = data.content?.find(b => b.type === "text")?.text || "{}";
  const clean = text.trim().replace(/^```json\s*/i,"").replace(/^```\s*/i,"").replace(/```\s*$/i,"").trim();
  const s = clean.indexOf("{"), e = clean.lastIndexOf("}");
  if (s === -1 || e === -1) throw new Error("No results");
  const parsed = JSON.parse(clean.slice(s, e + 1));
  return Array.isArray(parsed.results) ? parsed.results : [];
}

async function verifyUsername(username) {
  const res = await fetch("/api/instagram", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      actor: "apify~instagram-profile-scraper",
      input: { usernames: [username] },
    }),
  });
  const data = await res.json();
  if (!res.ok) return null;
  return Array.isArray(data) ? data[0] ?? null : null;
}

function fmt(n) {
  if (n == null || isNaN(Number(n))) return null;
  n = Number(n);
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000)     return (n / 1_000).toFixed(1) + "K";
  return n.toLocaleString();
}

// ── Result card ───────────────────────────────────────────────────

function ResultCard({ result, onSelect, selected, color }) {
  const [verified, setVerified]   = useState(null); // null=unchecked, false=checking, object=done
  const [checking, setChecking]   = useState(false);

  const handleVerify = async (e) => {
    e.stopPropagation();
    setChecking(true);
    const profile = await verifyUsername(result.username);
    setVerified(profile);
    setChecking(false);
  };

  const realFollowers = verified?.followersCount ?? verified?.follower_count ?? null;
  const avatar        = verified?.profilePicUrl ?? null;
  const isReal        = verified !== null && verified !== undefined;

  return (
    <div
      onClick={() => onSelect(result.username)}
      style={{
        display: "flex", alignItems: "center", gap: "12px",
        padding: "12px 14px", borderRadius: "12px", cursor: "pointer",
        transition: "all .15s",
        background: selected ? `${color}15` : "rgba(255,255,255,0.03)",
        border: `1px solid ${selected ? color + "44" : "rgba(255,255,255,0.07)"}`,
      }}
      onMouseEnter={e => { if (!selected) { e.currentTarget.style.background = "rgba(255,255,255,0.06)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.12)"; }}}
      onMouseLeave={e => { if (!selected) { e.currentTarget.style.background = "rgba(255,255,255,0.03)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.07)"; }}}
    >
      {/* Avatar */}
      <div style={{ width: "40px", height: "40px", borderRadius: "50%", background: "rgba(255,255,255,0.08)", flexShrink: 0, overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "18px" }}>
        {avatar
          ? <img src={avatar} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} onError={e => e.target.style.display = "none"} />
          : "👤"
        }
      </div>

      {/* Info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
          <span style={{ fontSize: "13px", fontWeight: 700, color: "#fff" }}>@{result.username}</span>
          {result.name && <span style={{ fontSize: "11px", color: "rgba(255,255,255,0.4)" }}>{result.name}</span>}
          {isReal && <span style={{ fontSize: "9px", background: "rgba(52,211,153,0.15)", color: "#34d399", padding: "1px 6px", borderRadius: "10px", fontWeight: 700 }}>✓ verified</span>}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "2px", flexWrap: "wrap" }}>
          {result.category && <span style={{ fontSize: "10px", color: "rgba(255,255,255,0.3)", background: "rgba(255,255,255,0.05)", padding: "1px 7px", borderRadius: "10px" }}>{result.category}</span>}
          {realFollowers
            ? <span style={{ fontSize: "11px", color: "#ff3b5c", fontWeight: 700 }}>{fmt(realFollowers)} followers</span>
            : result.estimatedFollowers
              ? <span style={{ fontSize: "11px", color: "rgba(255,255,255,0.3)" }}>~{result.estimatedFollowers}</span>
              : null
          }
          {result.description && <span style={{ fontSize: "11px", color: "rgba(255,255,255,0.3)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "200px" }}>{result.description}</span>}
        </div>
      </div>

      {/* Actions */}
      <div style={{ display: "flex", gap: "6px", flexShrink: 0 }} onClick={e => e.stopPropagation()}>
        {!isReal && (
          <button
            onClick={handleVerify}
            disabled={checking}
            style={{
              fontSize: "10px", fontWeight: 600, padding: "4px 10px", borderRadius: "8px",
              cursor: checking ? "not-allowed" : "pointer", fontFamily: "inherit",
              background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)",
              color: checking ? "rgba(255,255,255,0.2)" : "rgba(255,255,255,0.5)",
            }}
          >{checking ? "Checking…" : "Verify"}</button>
        )}
        <button
          onClick={() => onSelect(result.username)}
          style={{
            fontSize: "10px", fontWeight: 700, padding: "4px 10px", borderRadius: "8px",
            cursor: "pointer", fontFamily: "inherit", transition: "all .15s",
            background: selected ? `${color}25` : "rgba(255,59,92,0.12)",
            border: `1px solid ${selected ? color + "44" : "rgba(255,59,92,0.25)"}`,
            color: selected ? color : "#ff3b5c",
          }}
        >{selected ? "✓ Selected" : "Select"}</button>
      </div>
    </div>
  );
}

// ── Main BrandSearch ──────────────────────────────────────────────

export default function BrandSearch({ onSelect, selectedUsernames = [], color = "#ff3b5c", placeholder = "Search brands by keyword…", maxSelect = 1 }) {
  const [query,    setQuery]    = useState("");
  const [results,  setResults]  = useState([]);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState(null);
  const [searched, setSearched] = useState("");
  const [open,     setOpen]     = useState(false);
  const ref = useRef(null);

  const search = useCallback(async (q) => {
    if (!q.trim()) return;
    setLoading(true);
    setError(null);
    setResults([]);
    setSearched(q);
    setOpen(true);
    try {
      const list = await suggestUsernames(q);
      setResults(list);
    } catch (err) {
      setError("Search failed — try a different keyword");
    } finally {
      setLoading(false);
    }
  }, []);

  // Close on outside click
  useEffect(() => {
    const handler = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleSelect = (username) => {
    onSelect(username);
    setOpen(false);
    setQuery("");
  };

  return (
    <div ref={ref} style={{ position: "relative", width: "100%" }}>
      {/* Search input */}
      <div style={{
        display: "flex", alignItems: "center", gap: "8px",
        background: "rgba(255,255,255,0.05)", border: `1px solid rgba(255,255,255,0.1)`,
        borderRadius: "10px", padding: "10px 14px", transition: "border-color .2s",
      }}>
        <span style={{ fontSize: "14px", opacity: 0.45 }}>🔍</span>
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={e => e.key === "Enter" && search(query)}
          onFocus={() => results.length > 0 && setOpen(true)}
          placeholder={placeholder}
          style={{ flex: 1, background: "none", border: "none", color: "#fff", fontSize: "13px", fontFamily: "inherit" }}
        />
        {query && (
          <button onClick={() => { setQuery(""); setResults([]); setOpen(false); }} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.3)", cursor: "pointer", fontSize: "14px" }}>✕</button>
        )}
        <button
          onClick={() => search(query)}
          disabled={!query.trim() || loading}
          style={{
            padding: "6px 14px", borderRadius: "8px", fontSize: "12px", fontWeight: 700,
            cursor: !query.trim() || loading ? "not-allowed" : "pointer", fontFamily: "inherit",
            background: query.trim() ? `${color}20` : "rgba(255,255,255,0.04)",
            border: `1px solid ${query.trim() ? color + "44" : "rgba(255,255,255,0.08)"}`,
            color: query.trim() ? color : "rgba(255,255,255,0.2)",
            whiteSpace: "nowrap", transition: "all .15s",
          }}
        >{loading ? "Searching…" : "Search"}</button>
      </div>

      {/* Dropdown results */}
      {open && (loading || results.length > 0 || error) && (
        <div style={{
          position: "absolute", top: "calc(100% + 6px)", left: 0, right: 0, zIndex: 100,
          background: "#17171f", border: "1px solid rgba(255,255,255,0.1)",
          borderRadius: "14px", padding: "10px", boxShadow: "0 20px 50px rgba(0,0,0,0.6)",
          maxHeight: "380px", overflowY: "auto",
        }}>
          {loading && (
            <div style={{ padding: "16px", textAlign: "center" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "8px" }}>
                <div style={{ width: 7, height: 7, borderRadius: "50%", background: color, animation: "pulse 1s infinite" }} />
                <span style={{ fontSize: "12px", color: "rgba(255,255,255,0.4)" }}>Finding Instagram accounts for "{searched}"…</span>
              </div>
            </div>
          )}

          {error && <div style={{ padding: "12px", color: "#ff8080", fontSize: "12px" }}>⚠️ {error}</div>}

          {!loading && results.length > 0 && (
            <>
              <div style={{ fontSize: "10px", color: "rgba(255,255,255,0.25)", fontWeight: 600, letterSpacing: "1px", textTransform: "uppercase", padding: "4px 4px 8px" }}>
                {results.length} accounts found for "{searched}"
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
                {results.map((r, i) => (
                  <ResultCard
                    key={i}
                    result={r}
                    onSelect={handleSelect}
                    selected={selectedUsernames.includes(r.username)}
                    color={color}
                  />
                ))}
              </div>
              <div style={{ marginTop: "10px", paddingTop: "10px", borderTop: "1px solid rgba(255,255,255,0.06)", fontSize: "10px", color: "rgba(255,255,255,0.2)", textAlign: "center" }}>
                Suggested by AI · Click "Verify" to confirm account exists · Click "Select" to add
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
