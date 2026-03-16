import { useState, useEffect, useCallback, useRef } from "react";

// ── Constants ────────────────────────────────────────────────────

const NICHES = ["All Fashion & Beauty", "Skincare", "Makeup", "Streetwear", "Luxury Fashion", "Haircare"];

const REGIONS = [
  { code: "global", flag: "🌐", label: "Global" },
  { code: "in",     flag: "🇮🇳", label: "India" },
  { code: "us",     flag: "🇺🇸", label: "USA" },
  { code: "uk",     flag: "🇬🇧", label: "UK" },
  { code: "ae",     flag: "🇦🇪", label: "UAE" },
  { code: "fr",     flag: "🇫🇷", label: "France" },
  { code: "jp",     flag: "🇯🇵", label: "Japan" },
  { code: "br",     flag: "🇧🇷", label: "Brazil" },
  { code: "au",     flag: "🇦🇺", label: "Australia" },
];

const SECTIONS = [
  { id: "reels",    emoji: "🎬", label: "Reels" },
  { id: "hashtags", emoji: "#",  label: "Hashtags" },
  { id: "brands",   emoji: "🏷️", label: "Brands" },
  { id: "creators", emoji: "✨", label: "Creators" },
];

const TIME_MODES = [
  { id: "today",  label: "Today" },
  { id: "30days", label: "30-Day View" },
];

const SEARCH_SUGGESTIONS = [
  "bed linen", "sustainable fashion", "protein supplements",
  "luxury watches", "home decor", "pet accessories",
  "matcha", "running shoes", "minimalist jewellery", "baby clothing",
];

// ── Prompt builders ──────────────────────────────────────────────

function regionLabel(code) {
  return REGIONS.find(r => r.code === code)?.label || "Global";
}

function buildTrendPrompt(section, niche, region, timeMode) {
  const date = new Date().toDateString();
  const geo = region === "global" ? "globally" : `in ${regionLabel(region)}`;
  const period = timeMode === "30days"
    ? "over the past 30 days (identify trends that have built momentum over this period, not just today)"
    : "right now today";
  const context = `You are an Instagram trend analyst. Today: ${date}. Topic/Niche: ${niche}. Geography: ${regionLabel(region)}. Period: ${period}.`;
  const sparkNote = timeMode === "30days"
    ? `Also include a "sparkline" field: array of exactly 8 integers (10–100) showing week-by-week momentum over 30 days.`
    : `Include a "sparkline" field: array of exactly 8 integers (10–100) showing daily momentum this week.`;

  const formats = {
    reels: `${context}
List the top 6 trending Instagram Reels formats or content types for "${niche}" ${geo} ${period}.
${sparkNote}
Include a "peakWeek" field (e.g. "Week 3" or "Mar 10–16") for when the trend peaked.
Respond with ONLY raw JSON. No markdown, no extra text.
Format: {"trends":[{"name":"string","summary":"string","growth":number,"metric":"string","isNew":boolean,"detail":"string","tags":["string"],"sparkline":[n,n,n,n,n,n,n,n],"peakWeek":"string"}]}`,

    hashtags: `${context}
List the top 6 fastest-growing Instagram hashtags for "${niche}" ${geo} ${period}.
${sparkNote}
Include a "peakWeek" field.
Respond with ONLY raw JSON. No markdown, no extra text.
Format: {"trends":[{"name":"string","summary":"string","growth":number,"metric":"string","isNew":boolean,"detail":"string","tags":["string"],"sparkline":[n,n,n,n,n,n,n,n],"peakWeek":"string"}]}`,

    brands: `${context}
List the top 6 most mentioned/called-out brands on Instagram for the "${niche}" space ${geo} ${period}. Focus on organic callouts, UGC, launch buzz, collabs.
${sparkNote}
Include a "peakWeek" field.
Respond with ONLY raw JSON. No markdown, no extra text.
Format: {"trends":[{"name":"string","summary":"string","growth":number,"metric":"string","isNew":boolean,"detail":"string","tags":["string"],"sparkline":[n,n,n,n,n,n,n,n],"peakWeek":"string"}]}`,

    creators: `${context}
List the top 6 rising creator/influencer trends on Instagram for the "${niche}" space ${geo} ${period}.
${sparkNote}
Include a "peakWeek" field.
Respond with ONLY raw JSON. No markdown, no extra text.
Format: {"trends":[{"name":"string","summary":"string","growth":number,"metric":"string","isNew":boolean,"detail":"string","tags":["string"],"sparkline":[n,n,n,n,n,n,n,n],"peakWeek":"string"}]}`,
  };
  return formats[section];
}

function buildSummaryPrompt(niche, region, timeMode) {
  const geo = region === "global" ? "globally" : `in ${regionLabel(region)}`;
  const period = timeMode === "30days" ? "over the past 30 days" : "today";
  return `You are an Instagram trend analyst. Topic: "${niche}". Geography: ${regionLabel(region)}. Period: ${period}.
Write exactly 2 sharp sentences about what is dominating Instagram for this topic ${geo} ${period}. Name specific trends or brands. No fluff. Plain text only.`;
}

function buildSearchPrompt(query, region, timeMode) {
  const date = new Date().toDateString();
  const geo = region === "global" ? "globally" : `in ${regionLabel(region)}`;
  const period = timeMode === "30days" ? "over the past 30 days" : "right now";
  return `You are an Instagram trend analyst. Today: ${date}.
The user is searching for Instagram trends related to: "${query}".
Geography: ${regionLabel(region)}. Period: ${period}.

Give a comprehensive trend report covering all of:
1. Top trending Reels/content formats (3 items)
2. Top trending hashtags (3 items)  
3. Most mentioned brands (3 items)
4. Rising creator trends (3 items)

For each item include a sparkline: array of exactly 8 integers (10–100) showing momentum.
For 30-day mode also include peakWeek (e.g. "Week 2").

Respond with ONLY raw JSON. No markdown, no extra text.
Format:
{
  "overview": "2 sentence summary of what's trending for this topic on Instagram",
  "reels":    [{"name":"string","summary":"string","growth":number,"metric":"string","isNew":boolean,"detail":"string","tags":["string"],"sparkline":[n,n,n,n,n,n,n,n],"peakWeek":"string"}],
  "hashtags": [{"name":"string","summary":"string","growth":number,"metric":"string","isNew":boolean,"detail":"string","tags":["string"],"sparkline":[n,n,n,n,n,n,n,n],"peakWeek":"string"}],
  "brands":   [{"name":"string","summary":"string","growth":number,"metric":"string","isNew":boolean,"detail":"string","tags":["string"],"sparkline":[n,n,n,n,n,n,n,n],"peakWeek":"string"}],
  "creators": [{"name":"string","summary":"string","growth":number,"metric":"string","isNew":boolean,"detail":"string","tags":["string"],"sparkline":[n,n,n,n,n,n,n,n],"peakWeek":"string"}]
}`;
}

// ── API ──────────────────────────────────────────────────────────

async function callClaude(prompt) {
  const res = await fetch("/api/claude", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 2500,
      messages: [{ role: "user", content: prompt }],
    }),
  });
  if (!res.ok) throw new Error(`API ${res.status}: ${await res.text()}`);
  const data = await res.json();
  if (data.error) throw new Error(data.error.message);
  const block = data.content?.find(b => b.type === "text");
  if (!block) throw new Error("No text in response");
  return block.text;
}

function parseJSON(raw) {
  let text = raw.trim().replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```\s*$/i, "").trim();
  const s = text.indexOf("{"), e = text.lastIndexOf("}");
  if (s === -1 || e === -1) throw new Error("No JSON found");
  return JSON.parse(text.slice(s, e + 1));
}

// ── Sparkline ────────────────────────────────────────────────────

function Sparkline({ data = [], color = "#ff3b5c", height = 36, width = 100 }) {
  if (!data || data.length < 2) return null;
  const min = Math.min(...data), max = Math.max(...data);
  const range = max - min || 1;
  const pad = 3, w = width, h = height;
  const pts = data.map((v, i) => {
    const x = pad + (i / (data.length - 1)) * (w - pad * 2);
    const y = h - pad - ((v - min) / range) * (h - pad * 2);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  const polyline = pts.join(" ");
  const areaPoints = `${pts[0].split(",")[0]},${h} ${polyline} ${pts[pts.length - 1].split(",")[0]},${h}`;
  const uid = color.replace("#", "");
  return (
    <svg width={w} height={h} style={{ overflow: "visible" }}>
      <defs>
        <linearGradient id={`sg${uid}${w}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.25" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={areaPoints} fill={`url(#sg${uid}${w})`} />
      <polyline points={polyline} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={pts[pts.length - 1].split(",")[0]} cy={pts[pts.length - 1].split(",")[1]} r="2.5" fill={color} />
    </svg>
  );
}

// ── Shimmer ──────────────────────────────────────────────────────

function Shimmer({ count = 6 }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
      {[...Array(count)].map((_, i) => (
        <div key={i} style={{ height: "88px", borderRadius: "14px", background: "rgba(255,255,255,0.04)", position: "relative", overflow: "hidden" }}>
          <div style={{ position: "absolute", inset: 0, background: "linear-gradient(90deg,transparent,rgba(255,255,255,0.07),transparent)", animation: "sweep 1.5s ease infinite", animationDelay: `${i * 0.12}s` }} />
        </div>
      ))}
      <style>{`@keyframes sweep{0%{transform:translateX(-100%)}100%{transform:translateX(100%)}}`}</style>
    </div>
  );
}

// ── TrendCard ────────────────────────────────────────────────────

function TrendCard({ item, index, timeMode, accentColor }) {
  const [open, setOpen] = useState(false);
  const pct = Math.max(0, Math.min(Number(item.growth) || 0, 999));
  const color = accentColor || (pct > 200 ? "#ff3b5c" : pct > 100 ? "#ff8c42" : "#00d4a0");
  const sparkData = Array.isArray(item.sparkline) && item.sparkline.length === 8 ? item.sparkline : null;

  return (
    <div
      onClick={() => setOpen(o => !o)}
      style={{
        position: "relative", overflow: "hidden",
        background: "rgba(255,255,255,0.035)",
        border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: "14px", padding: "15px 18px",
        cursor: "pointer", transition: "border-color .18s, background .18s",
      }}
      onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.06)"; e.currentTarget.style.borderColor = `${color}44`; }}
      onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.035)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)"; }}
    >
      <div style={{ position: "absolute", top: 0, left: 0, height: "2px", width: `${Math.min(pct / 6, 100)}%`, background: `linear-gradient(90deg,${color},transparent)` }} />
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "14px" }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "5px", flexWrap: "wrap" }}>
            <span style={{ fontSize: "11px", color: "rgba(255,255,255,0.22)" }}>#{index + 1}</span>
            <span style={{ fontSize: "14px", fontWeight: 700, color: "#fff", letterSpacing: "-0.2px" }}>{item.name}</span>
            {item.isNew && <span style={{ fontSize: "9px", fontWeight: 800, letterSpacing: "1px", color, background: `${color}22`, padding: "2px 7px", borderRadius: "20px", textTransform: "uppercase" }}>NEW</span>}
            {timeMode === "30days" && item.peakWeek && (
              <span style={{ fontSize: "10px", color: "rgba(255,255,255,0.3)", background: "rgba(255,255,255,0.05)", padding: "2px 8px", borderRadius: "20px" }}>📈 {item.peakWeek}</span>
            )}
          </div>
          <p style={{ margin: 0, fontSize: "12px", color: "rgba(255,255,255,0.42)", lineHeight: 1.5 }}>{item.summary}</p>
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "4px", flexShrink: 0 }}>
          {sparkData && <Sparkline data={sparkData} color={color} width={80} height={28} />}
          <div style={{ fontSize: "16px", fontWeight: 800, color, letterSpacing: "-0.5px" }}>+{pct}%</div>
          <div style={{ fontSize: "10px", color: "rgba(255,255,255,0.25)" }}>{item.metric}</div>
        </div>
      </div>
      {open && (
        <div style={{ marginTop: "13px", paddingTop: "13px", borderTop: "1px solid rgba(255,255,255,0.06)", animation: "fadeIn .2s ease" }}>
          {timeMode === "30days" && sparkData && (
            <div style={{ marginBottom: "12px" }}>
              <p style={{ fontSize: "10px", color: "rgba(255,255,255,0.3)", marginBottom: "6px", textTransform: "uppercase", letterSpacing: "1px", fontWeight: 600 }}>30-Day Momentum</p>
              <Sparkline data={sparkData} color={color} width={360} height={52} />
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: "3px" }}>
                <span style={{ fontSize: "10px", color: "rgba(255,255,255,0.2)" }}>Day 1</span>
                <span style={{ fontSize: "10px", color: "rgba(255,255,255,0.2)" }}>Day 30</span>
              </div>
            </div>
          )}
          <p style={{ margin: "0 0 10px", fontSize: "12.5px", color: "rgba(255,255,255,0.58)", lineHeight: 1.65 }}>{item.detail}</p>
          {Array.isArray(item.tags) && item.tags.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
              {item.tags.map((t, ti) => (
                <span key={ti} style={{ fontSize: "11px", color: "rgba(255,255,255,0.38)", background: "rgba(255,255,255,0.05)", padding: "3px 10px", borderRadius: "20px" }}>{t}</span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Search Results panel ─────────────────────────────────────────

const SEARCH_SECTIONS = [
  { id: "reels",    emoji: "🎬", label: "Reels",    color: "#ff3b5c" },
  { id: "hashtags", emoji: "#",  label: "Hashtags", color: "#a78bfa" },
  { id: "brands",   emoji: "🏷️", label: "Brands",   color: "#34d399" },
  { id: "creators", emoji: "✨", label: "Creators", color: "#fbbf24" },
];

function SearchResults({ results, loading, error, query, timeMode }) {
  const [activeTab, setActiveTab] = useState("reels");
  if (loading) return <Shimmer count={8} />;
  if (error) return (
    <div style={{ padding: "12px 15px", background: "rgba(255,59,92,0.08)", border: "1px solid rgba(255,59,92,0.2)", borderRadius: "10px", color: "#ff8080", fontSize: "13px" }}>⚠️ {error}</div>
  );
  if (!results) return null;

  const sec = SEARCH_SECTIONS.find(s => s.id === activeTab);
  const items = results[activeTab] || [];

  return (
    <div style={{ animation: "fadeIn .3s ease" }}>
      {/* Overview brief */}
      {results.overview && (
        <div style={{ padding: "14px 16px", background: "rgba(99,179,237,0.06)", border: "1px solid rgba(99,179,237,0.15)", borderRadius: "12px", marginBottom: "18px" }}>
          <span style={{ fontSize: "11px", fontWeight: 700, color: "#63b3ed", letterSpacing: "1px", textTransform: "uppercase", marginRight: "8px" }}>Overview</span>
          <span style={{ fontSize: "13px", color: "rgba(255,255,255,0.55)", lineHeight: 1.6 }}>{results.overview}</span>
        </div>
      )}

      {/* Category tabs */}
      <div style={{ display: "flex", gap: "6px", marginBottom: "16px", overflowX: "auto" }}>
        {SEARCH_SECTIONS.map(s => {
          const count = (results[s.id] || []).length;
          return (
            <button key={s.id} onClick={() => setActiveTab(s.id)} style={{
              display: "flex", alignItems: "center", gap: "6px",
              padding: "8px 14px", borderRadius: "10px", fontSize: "12.5px",
              fontWeight: activeTab === s.id ? 700 : 500, cursor: "pointer",
              whiteSpace: "nowrap", transition: "all .15s", fontFamily: "inherit",
              background: activeTab === s.id ? `${s.color}18` : "rgba(255,255,255,0.04)",
              border: `1px solid ${activeTab === s.id ? `${s.color}44` : "rgba(255,255,255,0.07)"}`,
              color: activeTab === s.id ? s.color : "rgba(255,255,255,0.38)",
            }}>
              {s.emoji} {s.label}
              <span style={{ fontSize: "10px", background: activeTab === s.id ? `${s.color}22` : "rgba(255,255,255,0.06)", padding: "1px 6px", borderRadius: "10px", color: activeTab === s.id ? s.color : "rgba(255,255,255,0.3)" }}>{count}</span>
            </button>
          );
        })}
      </div>

      {/* Cards */}
      <div style={{ display: "flex", flexDirection: "column", gap: "9px" }}>
        {items.map((item, i) => (
          <TrendCard key={i} item={item} index={i} timeMode={timeMode} accentColor={sec?.color} />
        ))}
        {items.length === 0 && (
          <div style={{ textAlign: "center", padding: "40px", color: "rgba(255,255,255,0.2)", fontSize: "13px" }}>No data for this category</div>
        )}
      </div>
    </div>
  );
}

// ── Main App ─────────────────────────────────────────────────────

export default function TrendTracker() {
  // Mode: "tracker" or "search"
  const [mode, setMode] = useState("tracker");

  // Tracker state
  const [niche,    setNiche]    = useState("All Fashion & Beauty");
  const [region,   setRegion]   = useState("global");
  const [section,  setSection]  = useState("reels");
  const [timeMode, setTimeMode] = useState("today");
  const [cache,    setCache]    = useState({});
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState(null);
  const [updatedAt, setUpdatedAt] = useState(null);
  const [summary,  setSummary]  = useState("");
  const [summaryLoading, setSummaryLoading] = useState(false);

  // Search state
  const [searchQuery,   setSearchQuery]   = useState("");
  const [searchInput,   setSearchInput]   = useState("");
  const [searchResults, setSearchResults] = useState(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError,   setSearchError]   = useState(null);
  const [searchRegion,  setSearchRegion]  = useState("global");
  const [searchTimeMode, setSearchTimeMode] = useState("today");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const searchRef = useRef(null);

  // Tracker logic
  const cacheKey = `${niche}::${region}::${section}::${timeMode}`;
  const trends = cache[cacheKey] || [];

  const loadTrends = useCallback(async (n, r, s, t, force = false) => {
    const key = `${n}::${r}::${s}::${t}`;
    if (!force && cache[key]?.length > 0) return;
    setLoading(true); setError(null);
    try {
      const raw = await callClaude(buildTrendPrompt(s, n, r, t));
      const parsed = parseJSON(raw);
      const list = Array.isArray(parsed.trends) ? parsed.trends : [];
      if (list.length === 0) throw new Error("Empty trends — please refresh.");
      setCache(prev => ({ ...prev, [key]: list }));
      setUpdatedAt(new Date());
    } catch (err) { setError(err.message || "Something went wrong."); }
    finally { setLoading(false); }
  }, [cache]);

  const loadSummary = useCallback(async (n, r, t) => {
    setSummaryLoading(true); setSummary("");
    try {
      const text = await callClaude(buildSummaryPrompt(n, r, t));
      setSummary(text.trim());
    } catch { setSummary("Brief unavailable."); }
    finally { setSummaryLoading(false); }
  }, []);

  useEffect(() => { if (mode === "tracker") loadTrends(niche, region, section, timeMode); }, [niche, region, section, timeMode, mode]);
  useEffect(() => { if (mode === "tracker") loadSummary(niche, region, timeMode); }, [niche, region, timeMode, mode]);

  // Search logic
  const runSearch = useCallback(async (q, r, t) => {
    if (!q.trim()) return;
    setSearchLoading(true); setSearchError(null); setSearchResults(null);
    try {
      const raw = await callClaude(buildSearchPrompt(q, r, t));
      const parsed = parseJSON(raw);
      setSearchResults(parsed);
    } catch (err) { setSearchError(err.message || "Search failed — please try again."); }
    finally { setSearchLoading(false); }
  }, []);

  const handleSearch = (q) => {
    const query = q || searchInput;
    if (!query.trim()) return;
    setSearchQuery(query);
    setSearchInput(query);
    setShowSuggestions(false);
    runSearch(query, searchRegion, searchTimeMode);
  };

  // Close suggestions on outside click
  useEffect(() => {
    const handler = (e) => { if (searchRef.current && !searchRef.current.contains(e.target)) setShowSuggestions(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const activeRegion = REGIONS.find(r => r.code === region);

  return (
    <div style={{ minHeight: "100vh", background: "#0b0b10", color: "#fff", fontFamily: "'DM Sans', sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600;9..40,700;9..40,800&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        @keyframes pulse  { 0%,100%{opacity:1}  50%{opacity:.3} }
        @keyframes fadeIn { from{opacity:0;transform:translateY(5px)} to{opacity:1;transform:translateY(0)} }
        ::-webkit-scrollbar { width:4px; height:4px; }
        ::-webkit-scrollbar-thumb { background:rgba(255,255,255,0.1); border-radius:2px; }
        input::placeholder { color: rgba(255,255,255,0.25); }
        input:focus { outline: none; }
      `}</style>

      {/* ── HEADER ── */}
      <header style={{
        position: "sticky", top: 0, zIndex: 30,
        background: "rgba(11,11,16,0.94)", backdropFilter: "blur(20px)",
        borderBottom: "1px solid rgba(255,255,255,0.06)",
        padding: "18px 24px 0",
      }}>
        <div style={{ maxWidth: "780px", margin: "0 auto" }}>

          {/* Title row */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "14px", flexWrap: "wrap", gap: "10px" }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "7px", marginBottom: "3px" }}>
                <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#ff3b5c", boxShadow: "0 0 8px #ff3b5c", display: "inline-block", animation: "pulse 2s infinite" }} />
                <span style={{ fontSize: "10px", letterSpacing: "2px", textTransform: "uppercase", color: "rgba(255,255,255,0.3)", fontWeight: 600 }}>Instagram · Trend Intel</span>
              </div>
              <h1 style={{ fontSize: "21px", fontWeight: 800, letterSpacing: "-0.7px" }}>
                Fashion &amp; Beauty{" "}
                <span style={{ background: "linear-gradient(120deg,#ff3b5c,#ff8c42)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>Trend Tracker</span>
              </h1>
            </div>

            {/* Mode switch */}
            <div style={{ display: "flex", background: "rgba(255,255,255,0.05)", borderRadius: "10px", padding: "3px", gap: "2px" }}>
              {[{ id: "tracker", label: "📊 Tracker" }, { id: "search", label: "🔍 Search" }].map(m => (
                <button key={m.id} onClick={() => setMode(m.id)} style={{
                  padding: "7px 16px", borderRadius: "8px", fontSize: "12px", fontWeight: 600,
                  cursor: "pointer", fontFamily: "inherit", transition: "all .15s",
                  background: mode === m.id ? "rgba(255,59,92,0.2)" : "transparent",
                  border: `1px solid ${mode === m.id ? "rgba(255,59,92,0.35)" : "transparent"}`,
                  color: mode === m.id ? "#ff3b5c" : "rgba(255,255,255,0.4)",
                }}>{m.label}</button>
              ))}
            </div>
          </div>

          {/* ── TRACKER HEADER CONTROLS ── */}
          {mode === "tracker" && (<>
            <div style={{ display: "flex", gap: "16px", flexWrap: "wrap", alignItems: "flex-start", marginBottom: "14px" }}>
              <div style={{ flex: 1, minWidth: "260px" }}>
                <p style={{ fontSize: "10px", letterSpacing: "1.5px", textTransform: "uppercase", color: "rgba(255,255,255,0.25)", fontWeight: 600, marginBottom: "7px" }}>Niche</p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "5px" }}>
                  {NICHES.map(n => (
                    <button key={n} onClick={() => setNiche(n)} style={{
                      padding: "4px 11px", borderRadius: "20px", fontSize: "11.5px", fontWeight: 600,
                      cursor: "pointer", fontFamily: "inherit", transition: "all .15s",
                      background: niche === n ? "rgba(255,59,92,0.14)" : "rgba(255,255,255,0.05)",
                      border: `1px solid ${niche === n ? "rgba(255,59,92,0.4)" : "rgba(255,255,255,0.07)"}`,
                      color: niche === n ? "#ff3b5c" : "rgba(255,255,255,0.4)",
                    }}>{n}</button>
                  ))}
                </div>
              </div>
              <div>
                <p style={{ fontSize: "10px", letterSpacing: "1.5px", textTransform: "uppercase", color: "rgba(255,255,255,0.25)", fontWeight: 600, marginBottom: "7px" }}>Geography</p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "5px" }}>
                  {REGIONS.map(r => (
                    <button key={r.code} onClick={() => setRegion(r.code)} style={{
                      padding: "4px 10px", borderRadius: "20px", fontSize: "11.5px", fontWeight: 600,
                      cursor: "pointer", fontFamily: "inherit", transition: "all .15s",
                      background: region === r.code ? "rgba(99,179,237,0.15)" : "rgba(255,255,255,0.05)",
                      border: `1px solid ${region === r.code ? "rgba(99,179,237,0.4)" : "rgba(255,255,255,0.07)"}`,
                      color: region === r.code ? "#63b3ed" : "rgba(255,255,255,0.4)",
                    }}>{r.flag} {r.label}</button>
                  ))}
                </div>
              </div>
            </div>

            {/* Brief */}
            <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: "10px", padding: "10px 14px", minHeight: "38px", display: "flex", alignItems: "center", marginBottom: "0" }}>
              {summaryLoading
                ? <div style={{ height: "12px", width: "60%", borderRadius: "4px", background: "rgba(255,255,255,0.07)", animation: "pulse 1.5s infinite" }} />
                : <p style={{ fontSize: "12px", color: "rgba(255,255,255,0.48)", lineHeight: 1.6 }}>
                    <span style={{ color: "#ff3b5c", fontWeight: 700, marginRight: "6px" }}>{activeRegion?.flag} {timeMode === "30days" ? "30-Day Brief:" : "Today's Brief:"}</span>
                    {summary || "Loading…"}
                  </p>
              }
            </div>

            {/* Section + time tabs */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginTop: "14px" }}>
              <div style={{ display: "flex", gap: "2px", overflowX: "auto" }}>
                {SECTIONS.map(s => (
                  <button key={s.id} onClick={() => setSection(s.id)} style={{
                    display: "flex", alignItems: "center", gap: "5px",
                    padding: "9px 16px", borderRadius: "10px 10px 0 0", fontSize: "12.5px",
                    fontWeight: section === s.id ? 700 : 500, cursor: "pointer",
                    whiteSpace: "nowrap", transition: "all .15s", fontFamily: "inherit",
                    background: section === s.id ? "rgba(255,59,92,0.1)" : "transparent",
                    borderTop: `1px solid ${section === s.id ? "rgba(255,59,92,0.3)" : "transparent"}`,
                    borderLeft: `1px solid ${section === s.id ? "rgba(255,59,92,0.3)" : "transparent"}`,
                    borderRight: `1px solid ${section === s.id ? "rgba(255,59,92,0.3)" : "transparent"}`,
                    borderBottom: `2px solid ${section === s.id ? "rgba(255,59,92,0.6)" : "transparent"}`,
                    color: section === s.id ? "#fff" : "rgba(255,255,255,0.35)",
                  }}>{s.emoji} {s.label}</button>
                ))}
              </div>
              <div style={{ display: "flex", background: "rgba(255,255,255,0.04)", borderRadius: "8px", padding: "2px", gap: "2px", marginBottom: "0", flexShrink: 0 }}>
                {TIME_MODES.map(tm => (
                  <button key={tm.id} onClick={() => setTimeMode(tm.id)} style={{
                    padding: "5px 12px", borderRadius: "6px", fontSize: "11px", fontWeight: 600,
                    cursor: "pointer", fontFamily: "inherit", transition: "all .15s",
                    background: timeMode === tm.id ? "rgba(255,59,92,0.2)" : "transparent",
                    border: `1px solid ${timeMode === tm.id ? "rgba(255,59,92,0.3)" : "transparent"}`,
                    color: timeMode === tm.id ? "#ff3b5c" : "rgba(255,255,255,0.35)",
                  }}>{tm.label}</button>
                ))}
              </div>
            </div>
          </>)}

          {/* ── SEARCH HEADER CONTROLS ── */}
          {mode === "search" && (
            <div style={{ paddingBottom: "16px" }}>
              {/* Search bar */}
              <div ref={searchRef} style={{ position: "relative", marginBottom: "12px" }}>
                <div style={{
                  display: "flex", alignItems: "center", gap: "10px",
                  background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)",
                  borderRadius: "12px", padding: "11px 16px",
                  transition: "border-color .2s",
                }}
                  onFocus={e => e.currentTarget.style.borderColor = "rgba(99,179,237,0.4)"}
                  onBlur={e => e.currentTarget.style.borderColor = "rgba(255,255,255,0.12)"}
                >
                  <span style={{ fontSize: "16px", opacity: 0.5 }}>🔍</span>
                  <input
                    value={searchInput}
                    onChange={e => { setSearchInput(e.target.value); setShowSuggestions(true); }}
                    onKeyDown={e => e.key === "Enter" && handleSearch()}
                    onFocus={() => setShowSuggestions(true)}
                    placeholder='Try "bed linen", "matcha", "luxury watches"…'
                    style={{
                      flex: 1, background: "transparent", border: "none", color: "#fff",
                      fontSize: "14px", fontFamily: "inherit", fontWeight: 500,
                    }}
                  />
                  {searchInput && (
                    <button onClick={() => { setSearchInput(""); setSearchResults(null); setSearchQuery(""); }} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.3)", cursor: "pointer", fontSize: "16px", padding: "0 2px" }}>✕</button>
                  )}
                  <button
                    onClick={() => handleSearch()}
                    disabled={!searchInput.trim() || searchLoading}
                    style={{
                      background: "rgba(99,179,237,0.15)", border: "1px solid rgba(99,179,237,0.3)",
                      color: searchInput.trim() ? "#63b3ed" : "rgba(255,255,255,0.2)",
                      borderRadius: "8px", padding: "6px 14px", fontSize: "12px", fontWeight: 700,
                      cursor: searchInput.trim() && !searchLoading ? "pointer" : "not-allowed",
                      fontFamily: "inherit", whiteSpace: "nowrap", transition: "all .15s",
                    }}
                  >{searchLoading ? "Searching…" : "Search"}</button>
                </div>

                {/* Suggestions dropdown */}
                {showSuggestions && !searchLoading && (
                  <div style={{
                    position: "absolute", top: "calc(100% + 6px)", left: 0, right: 0, zIndex: 50,
                    background: "#17171f", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "12px",
                    padding: "8px", boxShadow: "0 16px 40px rgba(0,0,0,0.5)",
                  }}>
                    <p style={{ fontSize: "10px", color: "rgba(255,255,255,0.25)", fontWeight: 600, letterSpacing: "1px", textTransform: "uppercase", padding: "4px 8px 8px" }}>Popular searches</p>
                    {SEARCH_SUGGESTIONS
                      .filter(s => !searchInput || s.toLowerCase().includes(searchInput.toLowerCase()))
                      .map(s => (
                        <div key={s} onClick={() => handleSearch(s)} style={{
                          padding: "8px 12px", borderRadius: "8px", fontSize: "13px",
                          color: "rgba(255,255,255,0.6)", cursor: "pointer", transition: "all .12s",
                          display: "flex", alignItems: "center", gap: "8px",
                        }}
                          onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.05)"; e.currentTarget.style.color = "#fff"; }}
                          onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "rgba(255,255,255,0.6)"; }}
                        >
                          <span style={{ opacity: 0.4 }}>↗</span> {s}
                        </div>
                      ))
                    }
                  </div>
                )}
              </div>

              {/* Search filters */}
              <div style={{ display: "flex", gap: "16px", flexWrap: "wrap", alignItems: "flex-start" }}>
                <div>
                  <p style={{ fontSize: "10px", letterSpacing: "1.5px", textTransform: "uppercase", color: "rgba(255,255,255,0.25)", fontWeight: 600, marginBottom: "6px" }}>Geography</p>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "5px" }}>
                    {REGIONS.map(r => (
                      <button key={r.code} onClick={() => setSearchRegion(r.code)} style={{
                        padding: "4px 10px", borderRadius: "20px", fontSize: "11.5px", fontWeight: 600,
                        cursor: "pointer", fontFamily: "inherit", transition: "all .15s",
                        background: searchRegion === r.code ? "rgba(99,179,237,0.15)" : "rgba(255,255,255,0.05)",
                        border: `1px solid ${searchRegion === r.code ? "rgba(99,179,237,0.4)" : "rgba(255,255,255,0.07)"}`,
                        color: searchRegion === r.code ? "#63b3ed" : "rgba(255,255,255,0.4)",
                      }}>{r.flag} {r.label}</button>
                    ))}
                  </div>
                </div>
                <div>
                  <p style={{ fontSize: "10px", letterSpacing: "1.5px", textTransform: "uppercase", color: "rgba(255,255,255,0.25)", fontWeight: 600, marginBottom: "6px" }}>Period</p>
                  <div style={{ display: "flex", background: "rgba(255,255,255,0.04)", borderRadius: "8px", padding: "2px", gap: "2px" }}>
                    {TIME_MODES.map(tm => (
                      <button key={tm.id} onClick={() => setSearchTimeMode(tm.id)} style={{
                        padding: "6px 14px", borderRadius: "6px", fontSize: "11px", fontWeight: 600,
                        cursor: "pointer", fontFamily: "inherit", transition: "all .15s",
                        background: searchTimeMode === tm.id ? "rgba(255,59,92,0.2)" : "transparent",
                        border: `1px solid ${searchTimeMode === tm.id ? "rgba(255,59,92,0.3)" : "transparent"}`,
                        color: searchTimeMode === tm.id ? "#ff3b5c" : "rgba(255,255,255,0.35)",
                      }}>{tm.label}</button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

        </div>
      </header>

      {/* ── MAIN CONTENT ── */}
      <main style={{ maxWidth: "780px", margin: "0 auto", padding: "20px 24px 64px" }}>

        {/* TRACKER MODE */}
        {mode === "tracker" && (<>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
            <span style={{ fontSize: "12px", color: "rgba(255,255,255,0.3)" }}>
              {activeRegion?.flag} <strong style={{ color: "rgba(255,255,255,0.55)" }}>{activeRegion?.label}</strong>
              {" · "}<strong style={{ color: "rgba(255,255,255,0.55)" }}>{timeMode === "30days" ? "Last 30 days" : "Today"}</strong>
              {" · "}{niche}
              {updatedAt && <span style={{ color: "rgba(255,255,255,0.2)" }}> · {updatedAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>}
            </span>
            <button onClick={() => loadTrends(niche, region, section, timeMode, true)} disabled={loading} style={{
              padding: "6px 13px", borderRadius: "9px", fontSize: "12px", fontWeight: 600,
              cursor: loading ? "not-allowed" : "pointer", fontFamily: "inherit",
              background: "rgba(255,59,92,0.1)", border: "1px solid rgba(255,59,92,0.2)",
              color: loading ? "rgba(255,255,255,0.2)" : "#ff3b5c", transition: "all .15s",
            }}>{loading ? "Loading…" : "↻ Refresh"}</button>
          </div>
          {error && <div style={{ padding: "12px 15px", background: "rgba(255,59,92,0.08)", border: "1px solid rgba(255,59,92,0.2)", borderRadius: "10px", color: "#ff8080", fontSize: "13px", marginBottom: "14px" }}>⚠️ {error}</div>}
          {loading
            ? <Shimmer />
            : trends.length > 0
              ? <div style={{ display: "flex", flexDirection: "column", gap: "9px", animation: "fadeIn .3s ease" }}>
                  {trends.map((item, i) => <TrendCard key={`${cacheKey}-${i}`} item={item} index={i} timeMode={timeMode} />)}
                </div>
              : !error && <div style={{ textAlign: "center", padding: "60px 20px", color: "rgba(255,255,255,0.18)", fontSize: "13px" }}>Click <strong style={{ color: "rgba(255,255,255,0.28)" }}>↻ Refresh</strong> to load trends.</div>
          }
        </>)}

        {/* SEARCH MODE */}
        {mode === "search" && (<>
          {!searchQuery && !searchLoading && (
            <div style={{ textAlign: "center", padding: "60px 20px 20px" }}>
              <div style={{ fontSize: "40px", marginBottom: "12px" }}>🔍</div>
              <p style={{ fontSize: "15px", color: "rgba(255,255,255,0.4)", marginBottom: "6px" }}>Search any product, niche or industry</p>
              <p style={{ fontSize: "13px", color: "rgba(255,255,255,0.2)" }}>Get instant trend intel on reels, hashtags, brands & creators</p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", justifyContent: "center", marginTop: "24px" }}>
                {SEARCH_SUGGESTIONS.slice(0, 6).map(s => (
                  <button key={s} onClick={() => handleSearch(s)} style={{
                    padding: "7px 15px", borderRadius: "20px", fontSize: "12px", fontWeight: 600,
                    cursor: "pointer", fontFamily: "inherit", transition: "all .15s",
                    background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.09)",
                    color: "rgba(255,255,255,0.45)",
                  }}
                    onMouseEnter={e => { e.currentTarget.style.background = "rgba(99,179,237,0.1)"; e.currentTarget.style.borderColor = "rgba(99,179,237,0.3)"; e.currentTarget.style.color = "#63b3ed"; }}
                    onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.05)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.09)"; e.currentTarget.style.color = "rgba(255,255,255,0.45)"; }}
                  >↗ {s}</button>
                ))}
              </div>
            </div>
          )}

          {searchQuery && (
            <div style={{ marginBottom: "18px", display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
              <span style={{ fontSize: "13px", color: "rgba(255,255,255,0.35)" }}>Results for</span>
              <span style={{ fontSize: "14px", fontWeight: 700, color: "#fff", background: "rgba(99,179,237,0.1)", border: "1px solid rgba(99,179,237,0.25)", padding: "3px 12px", borderRadius: "20px", color: "#63b3ed" }}>"{searchQuery}"</span>
              <span style={{ fontSize: "12px", color: "rgba(255,255,255,0.25)" }}>
                {REGIONS.find(r => r.code === searchRegion)?.flag} {REGIONS.find(r => r.code === searchRegion)?.label}
                {" · "}{searchTimeMode === "30days" ? "Last 30 days" : "Today"}
              </span>
              {!searchLoading && (
                <button onClick={() => runSearch(searchQuery, searchRegion, searchTimeMode)} style={{
                  marginLeft: "auto", padding: "5px 12px", borderRadius: "8px", fontSize: "11px", fontWeight: 600,
                  cursor: "pointer", fontFamily: "inherit",
                  background: "rgba(255,59,92,0.1)", border: "1px solid rgba(255,59,92,0.2)", color: "#ff3b5c",
                }}>↻ Refresh</button>
              )}
            </div>
          )}

          <SearchResults
            results={searchResults}
            loading={searchLoading}
            error={searchError}
            query={searchQuery}
            timeMode={searchTimeMode}
          />
        </>)}

      </main>
    </div>
  );
}
