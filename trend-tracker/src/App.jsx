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
  { id: "today",   label: "Today" },
  { id: "30days",  label: "30-Day View" },
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

  const context = `You are an Instagram trend analyst for Fashion & Beauty.
Today: ${date}. Sub-niche: ${niche}. Geography: ${regionLabel(region)}. Period: ${period}.`;

  const sparklineNote = timeMode === "30days"
    ? `Also include a "sparkline" field: an array of exactly 8 integers (week-by-week relative engagement index, range 10–100, showing the trend arc over 30 days, e.g. [20,25,30,45,60,75,85,95] for a rising trend).`
    : `Include a "sparkline" field as an array of exactly 8 integers (10–100) showing rough daily momentum this week.`;

  const formats = {
    reels: `${context}
List the top 6 trending Instagram Reels formats or content types ${geo} ${period}. Focus on GRWMs, hauls, transformations, tutorials, skincare routines.
${sparklineNote}
Also include a "peakWeek" field (string like "Week 3" or "Mar 10–16") indicating when this trend peaked.
Respond with ONLY raw JSON. No markdown, no extra text.
Format: {"trends":[{"name":"string","summary":"string","growth":number,"metric":"string","isNew":boolean,"detail":"string","tags":["string"],"sparkline":[n,n,n,n,n,n,n,n],"peakWeek":"string"}]}`,

    hashtags: `${context}
List the top 6 fastest-growing Instagram hashtags ${geo} ${period}. Focus on beauty tags, aesthetic movements, micro-trend tags.
${sparklineNote}
Also include a "peakWeek" field.
Respond with ONLY raw JSON. No markdown, no extra text.
Format: {"trends":[{"name":"string","summary":"string","growth":number,"metric":"string","isNew":boolean,"detail":"string","tags":["string"],"sparkline":[n,n,n,n,n,n,n,n],"peakWeek":"string"}]}`,

    brands: `${context}
List the top 6 most called-out Fashion & Beauty brands on Instagram ${geo} ${period}. Focus on UGC, collabs, launch buzz, organic callouts.
${sparklineNote}
Also include a "peakWeek" field.
Respond with ONLY raw JSON. No markdown, no extra text.
Format: {"trends":[{"name":"string","summary":"string","growth":number,"metric":"string","isNew":boolean,"detail":"string","tags":["string"],"sparkline":[n,n,n,n,n,n,n,n],"peakWeek":"string"}]}`,

    creators: `${context}
List the top 6 rising creator/influencer trends on Instagram ${geo} ${period}. Focus on emerging styles, deinfluencing, anti-filter, collab formats.
${sparklineNote}
Also include a "peakWeek" field.
Respond with ONLY raw JSON. No markdown, no extra text.
Format: {"trends":[{"name":"string","summary":"string","growth":number,"metric":"string","isNew":boolean,"detail":"string","tags":["string"],"sparkline":[n,n,n,n,n,n,n,n],"peakWeek":"string"}]}`,
  };
  return formats[section];
}

function buildSummaryPrompt(niche, region, timeMode) {
  const geo = region === "global" ? "globally" : `in ${regionLabel(region)}`;
  const period = timeMode === "30days" ? "over the past 30 days" : "today";
  return `You are an Instagram trend analyst for Fashion & Beauty.
Sub-niche: ${niche}. Geography: ${regionLabel(region)}. Period: ${period}.
Write exactly 2 sharp sentences about what is dominating Instagram in this space ${geo} ${period}. Name specific trends. No fluff. Plain text only.`;
}

// ── API ──────────────────────────────────────────────────────────

async function callClaude(prompt) {
  // In production this hits /api/claude (Vercel serverless function)
  // which proxies to Anthropic with the secret API key server-side.
  const res = await fetch("/api/claude", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 2000,
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
  if (s === -1 || e === -1) throw new Error("No JSON found: " + text.slice(0, 80));
  return JSON.parse(text.slice(s, e + 1));
}

// ── Sparkline ────────────────────────────────────────────────────

function Sparkline({ data = [], color = "#ff3b5c", height = 36, width = 100 }) {
  if (!data || data.length < 2) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const pad = 3;
  const w = width, h = height;
  const pts = data.map((v, i) => {
    const x = pad + (i / (data.length - 1)) * (w - pad * 2);
    const y = h - pad - ((v - min) / range) * (h - pad * 2);
    return `${x},${y}`;
  });
  const polyline = pts.join(" ");
  // Area fill
  const areaPoints = `${pts[0].split(",")[0]},${h} ` + polyline + ` ${pts[pts.length-1].split(",")[0]},${h}`;

  return (
    <svg width={w} height={h} style={{ overflow: "visible" }}>
      <defs>
        <linearGradient id={`sg-${color.replace("#","")}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.25" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={areaPoints} fill={`url(#sg-${color.replace("#","")})`} />
      <polyline points={polyline} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      {/* last dot */}
      <circle cx={pts[pts.length-1].split(",")[0]} cy={pts[pts.length-1].split(",")[1]} r="2.5" fill={color} />
    </svg>
  );
}

// ── Shimmer ──────────────────────────────────────────────────────

function Shimmer() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
      {[...Array(6)].map((_, i) => (
        <div key={i} style={{ height: "90px", borderRadius: "14px", background: "rgba(255,255,255,0.04)", position: "relative", overflow: "hidden" }}>
          <div style={{ position: "absolute", inset: 0, background: "linear-gradient(90deg,transparent,rgba(255,255,255,0.07),transparent)", animation: "sweep 1.5s ease infinite", animationDelay: `${i*0.12}s` }} />
        </div>
      ))}
      <style>{`@keyframes sweep{0%{transform:translateX(-100%)}100%{transform:translateX(100%)}}`}</style>
    </div>
  );
}

// ── TrendCard ────────────────────────────────────────────────────

function TrendCard({ item, index, timeMode }) {
  const [open, setOpen] = useState(false);
  const pct = Math.max(0, Math.min(Number(item.growth) || 0, 999));
  const color = pct > 200 ? "#ff3b5c" : pct > 100 ? "#ff8c42" : "#00d4a0";
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
      onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.06)"; e.currentTarget.style.borderColor = "rgba(255,59,92,.3)"; }}
      onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.035)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)"; }}
    >
      {/* top accent bar */}
      <div style={{ position: "absolute", top: 0, left: 0, height: "2px", width: `${Math.min(pct/6,100)}%`, background: `linear-gradient(90deg,${color},transparent)` }} />

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "14px" }}>
        {/* Left: rank + text */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "5px", flexWrap: "wrap" }}>
            <span style={{ fontSize: "11px", color: "rgba(255,255,255,0.22)", fontVariantNumeric: "tabular-nums" }}>#{index + 1}</span>
            <span style={{ fontSize: "14px", fontWeight: 700, color: "#fff", letterSpacing: "-0.2px" }}>{item.name}</span>
            {item.isNew && <span style={{ fontSize: "9px", fontWeight: 800, letterSpacing: "1px", color: "#ff3b5c", background: "rgba(255,59,92,.15)", padding: "2px 7px", borderRadius: "20px", textTransform: "uppercase" }}>NEW</span>}
            {timeMode === "30days" && item.peakWeek && (
              <span style={{ fontSize: "10px", color: "rgba(255,255,255,0.3)", background: "rgba(255,255,255,0.05)", padding: "2px 8px", borderRadius: "20px" }}>📈 Peak: {item.peakWeek}</span>
            )}
          </div>
          <p style={{ margin: 0, fontSize: "12px", color: "rgba(255,255,255,0.42)", lineHeight: 1.5 }}>{item.summary}</p>
        </div>

        {/* Right: sparkline + growth */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "4px", flexShrink: 0 }}>
          {sparkData && <Sparkline data={sparkData} color={color} width={80} height={28} />}
          <div style={{ fontSize: "16px", fontWeight: 800, color, letterSpacing: "-0.5px" }}>+{pct}%</div>
          <div style={{ fontSize: "10px", color: "rgba(255,255,255,0.25)" }}>{item.metric}</div>
        </div>
      </div>

      {/* Expanded detail */}
      {open && (
        <div style={{ marginTop: "13px", paddingTop: "13px", borderTop: "1px solid rgba(255,255,255,0.06)", animation: "fadeIn .2s ease" }}>
          {timeMode === "30days" && sparkData && (
            <div style={{ marginBottom: "12px" }}>
              <p style={{ fontSize: "11px", color: "rgba(255,255,255,0.3)", marginBottom: "6px", textTransform: "uppercase", letterSpacing: "1px", fontWeight: 600 }}>30-Day Momentum</p>
              <Sparkline data={sparkData} color={color} width={320} height={48} />
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

// ── Main App ─────────────────────────────────────────────────────

export default function TrendTracker() {
  const [niche,     setNiche]     = useState("All Fashion & Beauty");
  const [region,    setRegion]    = useState("global");
  const [section,   setSection]   = useState("reels");
  const [timeMode,  setTimeMode]  = useState("today");
  const [cache,     setCache]     = useState({});
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState(null);
  const [updatedAt, setUpdatedAt] = useState(null);
  const [summary,   setSummary]   = useState("");
  const [summaryLoading, setSummaryLoading] = useState(false);

  const cacheKey = `${niche}::${region}::${section}::${timeMode}`;
  const trends = cache[cacheKey] || [];

  const loadTrends = useCallback(async (n, r, s, t, force = false) => {
    const key = `${n}::${r}::${s}::${t}`;
    if (!force && cache[key]?.length > 0) return;
    setLoading(true);
    setError(null);
    try {
      const raw = await callClaude(buildTrendPrompt(s, n, r, t));
      const parsed = parseJSON(raw);
      const list = Array.isArray(parsed.trends) ? parsed.trends : [];
      if (list.length === 0) throw new Error("Empty trends — please try refreshing.");
      setCache(prev => ({ ...prev, [key]: list }));
      setUpdatedAt(new Date());
    } catch (err) {
      console.error(err);
      setError(err.message || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }, [cache]);

  const loadSummary = useCallback(async (n, r, t) => {
    setSummaryLoading(true);
    setSummary("");
    try {
      const text = await callClaude(buildSummaryPrompt(n, r, t));
      setSummary(text.trim());
    } catch {
      setSummary("Brief unavailable — please refresh.");
    } finally {
      setSummaryLoading(false);
    }
  }, []);

  useEffect(() => { loadTrends(niche, region, section, timeMode); }, [niche, region, section, timeMode]);
  useEffect(() => { loadSummary(niche, region, timeMode); }, [niche, region, timeMode]);

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
      `}</style>

      {/* ── STICKY HEADER ── */}
      <header style={{
        position: "sticky", top: 0, zIndex: 30,
        background: "rgba(11,11,16,0.94)", backdropFilter: "blur(20px)",
        borderBottom: "1px solid rgba(255,255,255,0.06)",
        padding: "18px 24px 0",
      }}>
        <div style={{ maxWidth: "780px", margin: "0 auto" }}>

          {/* Title + live dot */}
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

            {/* Time mode toggle */}
            <div style={{ display: "flex", background: "rgba(255,255,255,0.05)", borderRadius: "10px", padding: "3px", gap: "2px" }}>
              {TIME_MODES.map(tm => (
                <button key={tm.id} onClick={() => setTimeMode(tm.id)} style={{
                  padding: "6px 14px", borderRadius: "8px", fontSize: "12px", fontWeight: 600,
                  cursor: "pointer", fontFamily: "inherit", transition: "all .15s",
                  background: timeMode === tm.id ? "rgba(255,59,92,0.2)" : "transparent",
                  border: `1px solid ${timeMode === tm.id ? "rgba(255,59,92,0.35)" : "transparent"}`,
                  color: timeMode === tm.id ? "#ff3b5c" : "rgba(255,255,255,0.4)",
                }}>{tm.label}</button>
              ))}
            </div>
          </div>

          {/* Controls row: Niche + Region */}
          <div style={{ display: "flex", gap: "16px", flexWrap: "wrap", alignItems: "flex-start", marginBottom: "14px" }}>

            {/* Niche pills */}
            <div style={{ flex: 1 }}>
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

            {/* Region picker */}
            <div style={{ minWidth: "200px" }}>
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

          {/* Daily brief */}
          <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: "10px", padding: "10px 14px", minHeight: "38px", display: "flex", alignItems: "center", marginBottom: "0" }}>
            {summaryLoading
              ? <div style={{ height: "12px", width: "60%", borderRadius: "4px", background: "rgba(255,255,255,0.07)", animation: "pulse 1.5s infinite" }} />
              : <p style={{ fontSize: "12px", color: "rgba(255,255,255,0.48)", lineHeight: 1.6 }}>
                  <span style={{ color: "#ff3b5c", fontWeight: 700, marginRight: "6px" }}>
                    {activeRegion?.flag} {timeMode === "30days" ? "30-Day Brief" : "Today's Brief"}:
                  </span>
                  {summary || "Loading…"}
                </p>
            }
          </div>

          {/* Section tabs — flush to bottom of header */}
          <div style={{ display: "flex", gap: "2px", marginTop: "14px", overflowX: "auto" }}>
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
              }}>
                {s.emoji} {s.label}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* ── MAIN CONTENT ── */}
      <main style={{ maxWidth: "780px", margin: "0 auto", padding: "20px 24px 64px" }}>

        {/* Context bar + Refresh */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{ fontSize: "12px", color: "rgba(255,255,255,0.35)" }}>
              {activeRegion?.flag} <strong style={{ color: "rgba(255,255,255,0.6)" }}>{activeRegion?.label}</strong>
              {" · "}
              <strong style={{ color: "rgba(255,255,255,0.6)" }}>{timeMode === "30days" ? "Last 30 days" : "Today"}</strong>
              {" · "}
              {niche}
            </span>
            {updatedAt && <span style={{ fontSize: "10px", color: "rgba(255,255,255,0.2)" }}>· {updatedAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>}
          </div>
          <button
            onClick={() => loadTrends(niche, region, section, timeMode, true)}
            disabled={loading}
            style={{
              padding: "6px 13px", borderRadius: "9px", fontSize: "12px", fontWeight: 600,
              cursor: loading ? "not-allowed" : "pointer", fontFamily: "inherit",
              background: "rgba(255,59,92,0.1)", border: "1px solid rgba(255,59,92,0.2)",
              color: loading ? "rgba(255,255,255,0.2)" : "#ff3b5c", transition: "all .15s",
            }}
          >{loading ? "Loading…" : "↻ Refresh"}</button>
        </div>

        {/* Error */}
        {error && (
          <div style={{ padding: "12px 15px", background: "rgba(255,59,92,0.08)", border: "1px solid rgba(255,59,92,0.2)", borderRadius: "10px", color: "#ff8080", fontSize: "13px", marginBottom: "14px", lineHeight: 1.5 }}>
            ⚠️ {error}
          </div>
        )}

        {/* Trend cards */}
        {loading
          ? <Shimmer />
          : trends.length > 0
            ? <div style={{ display: "flex", flexDirection: "column", gap: "9px", animation: "fadeIn .3s ease" }}>
                {trends.map((item, i) => <TrendCard key={`${cacheKey}-${i}`} item={item} index={i} timeMode={timeMode} />)}
              </div>
            : !error && (
                <div style={{ textAlign: "center", padding: "60px 20px", color: "rgba(255,255,255,0.18)", fontSize: "13px" }}>
                  Click <strong style={{ color: "rgba(255,255,255,0.28)" }}>↻ Refresh</strong> to load trends.
                </div>
              )
        }
      </main>
    </div>
  );
}
