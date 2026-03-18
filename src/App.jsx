import { useState, useEffect, useCallback, useRef } from "react";
import BrandIntel from "./BrandIntel.jsx";
import CompareBrands from "./CompareBrands.jsx";

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
  const period = timeMode === "30days" ? "over the past 30 days" : "right now today";
  const context = `You are an Instagram trend analyst. Today: ${date}. Topic/Niche: ${niche}. Geography: ${regionLabel(region)}. Period: ${period}.`;
  const sparkNote = `Include "sparkline": array of exactly 8 integers (10-100) showing momentum. Include "peakWeek": string like "Week 3".`;
  const fmt = `{"trends":[{"name":"string","summary":"string","growth":number,"metric":"string","isNew":boolean,"detail":"string","tags":["string"],"sparkline":[n,n,n,n,n,n,n,n],"peakWeek":"string"}]}`;

  const sectionPrompts = {
    reels:    `${context}\nList top 6 trending Instagram Reels formats for "${niche}" ${geo} ${period}. ${sparkNote}\nONLY raw JSON:\n${fmt}`,
    hashtags: `${context}\nList top 6 fastest-growing Instagram hashtags for "${niche}" ${geo} ${period}. ${sparkNote}\nONLY raw JSON:\n${fmt}`,
    brands:   `${context}\nList top 6 most called-out brands on Instagram for "${niche}" ${geo} ${period}. Focus on organic callouts, UGC, launch buzz. ${sparkNote}\nONLY raw JSON:\n${fmt}`,
    creators: `${context}\nList top 6 rising creator/influencer trends for "${niche}" ${geo} ${period}. ${sparkNote}\nONLY raw JSON:\n${fmt}`,
  };
  return sectionPrompts[section];
}

function buildSummaryPrompt(niche, region, timeMode) {
  const geo = region === "global" ? "globally" : `in ${regionLabel(region)}`;
  const period = timeMode === "30days" ? "over the past 30 days" : "today";
  return `You are an Instagram trend analyst. Topic: "${niche}". Geography: ${regionLabel(region)}. Period: ${period}.
Write exactly 2 sharp sentences about what is dominating Instagram for this topic ${geo} ${period}. Name specific trends. No fluff. Plain text only.`;
}

function buildSearchPrompt(query, region, timeMode) {
  const date = new Date().toDateString();
  const geo = region === "global" ? "globally" : `in ${regionLabel(region)}`;
  const period = timeMode === "30days" ? "over the past 30 days" : "right now";
  return `You are an Instagram trend analyst. Today: ${date}.
User is searching Instagram trends for: "${query}". Geography: ${regionLabel(region)}. Period: ${period}.
Give a comprehensive trend report: top 3 Reels formats, top 3 hashtags, top 3 brands, top 3 creator trends.
Each item needs sparkline (8 integers 10-100) and peakWeek field.
ONLY raw JSON:
{
  "overview":"2 sentence summary",
  "reels":[{"name":"","summary":"","growth":0,"metric":"","isNew":false,"detail":"","tags":[],"sparkline":[0,0,0,0,0,0,0,0],"peakWeek":""}],
  "hashtags":[same],
  "brands":[same],
  "creators":[same]
}`;
}

// ── Deep Insights prompt ─────────────────────────────────────────

function buildInsightPrompt(item, type, niche, region, timeMode) {
  const geo = regionLabel(region);
  const period = timeMode === "30days" ? "over the past 30 days" : "currently";
  const disclaimer = `IMPORTANT: You are an AI analyst. All numerical estimates are AI-generated benchmarks based on industry patterns and publicly known data — not live scraped data. Always include the field "isEstimated": true.`;

  const typeInstructions = {
    brands: `Generate a deep brand intelligence report for "${item.name}" on Instagram in the "${niche}" space in ${geo} ${period}.
Include realistic AI-estimated benchmarks based on the brand's known size and category.
${disclaimer}
Return ONLY raw JSON:
{
  "isEstimated": true,
  "disclaimer": "All figures are AI-estimated benchmarks, not live data",
  "overview": "3-4 sentence brand overview and Instagram presence summary",
  "estimatedMetrics": {
    "avgReelViews": "e.g. 500K–1.2M",
    "avgReelViewsNote": "estimated daily average per Reel",
    "engagementRate": "e.g. 3.2%",
    "engagementNote": "estimated avg engagement rate",
    "postingFrequency": "e.g. 4–6 Reels/week",
    "followerRange": "e.g. 800K–1.2M",
    "ugcVolume": "e.g. 2,000–5,000 mentions/month",
    "shareOfVoice": "e.g. 18%",
    "shareOfVoiceNote": "estimated share within niche"
  },
  "contentStrategy": {
    "topFormats": ["format1","format2","format3"],
    "bestPerformingThemes": ["theme1","theme2","theme3"],
    "postingPattern": "description of when and how they post",
    "audioStrategy": "what music/sounds they tend to use",
    "creatorCollabs": "how they work with influencers"
  },
  "audienceProfile": {
    "primaryAge": "e.g. 22–34",
    "genderSplit": "e.g. 72% female, 28% male",
    "topLocations": ["city1","city2","city3"],
    "interests": ["interest1","interest2","interest3"]
  },
  "recentWins": [
    {"title":"Campaign or content win title","description":"what worked and why","estimatedReach":"e.g. 2M+"},
    {"title":"","description":"","estimatedReach":""}
  ],
  "competitorComparison": [
    {"brand":"competitor name","advantage":"what this brand does better","disadvantage":"where competitor leads"}
  ],
  "opportunities": ["opportunity1","opportunity2","opportunity3"],
  "redFlags": ["risk or weakness1","risk or weakness2"],
  "score": {
    "overall": 78,
    "contentQuality": 82,
    "engagement": 74,
    "brandConsistency": 80,
    "creatorStrategy": 76
  }
}`,

    reels: `Generate a deep content intelligence report for the Reels trend "${item.name}" on Instagram in the "${niche}" space in ${geo} ${period}.
${disclaimer}
Return ONLY raw JSON:
{
  "isEstimated": true,
  "disclaimer": "All figures are AI-estimated benchmarks, not live data",
  "overview": "3-4 sentence overview of this Reels trend",
  "estimatedMetrics": {
    "avgViews": "e.g. 200K–800K",
    "avgViewsNote": "estimated per Reel using this format",
    "avgLikes": "e.g. 8K–25K",
    "avgComments": "e.g. 200–600",
    "avgShares": "e.g. 1K–4K",
    "avgSaves": "e.g. 3K–10K",
    "completionRate": "e.g. 65–75%",
    "bestPostingTime": "e.g. 7–9pm IST weekdays",
    "idealLength": "e.g. 15–30 seconds"
  },
  "contentBreakdown": {
    "hookStyle": "description of what makes the opening 3 seconds work",
    "visualStyle": "lighting, editing, color palette patterns",
    "audioTrends": ["sound1","sound2","sound3"],
    "captionStyle": "how captions typically read",
    "ctaPatterns": ["CTA type 1","CTA type 2"]
  },
  "whoIsWinning": [
    {"type":"Brand or Creator type","why":"why they perform well with this format","example":"example content style"}
  ],
  "howToReplicate": ["step1","step2","step3","step4"],
  "score": {
    "virality": 80,
    "saveability": 72,
    "shareability": 68,
    "conversionPotential": 65
  }
}`,

    hashtags: `Generate a deep hashtag intelligence report for "${item.name}" on Instagram in the "${niche}" space in ${geo} ${period}.
${disclaimer}
Return ONLY raw JSON:
{
  "isEstimated": true,
  "disclaimer": "All figures are AI-estimated benchmarks, not live data",
  "overview": "3-4 sentence overview of this hashtag's usage and community",
  "estimatedMetrics": {
    "totalPosts": "e.g. 2.4M",
    "dailyNewPosts": "e.g. 8K–15K",
    "avgViewsPerPost": "e.g. 10K–50K",
    "topContentType": "e.g. Tutorial Reels (60%), GRWM (25%)",
    "competitionLevel": "Low / Medium / High",
    "discoverabilityScore": "e.g. 7.2/10"
  },
  "audienceProfile": {
    "primaryAge": "e.g. 18–28",
    "genderSplit": "e.g. 80% female",
    "topLocations": ["location1","location2","location3"],
    "intent": "e.g. Discovery, Shopping, Entertainment"
  },
  "relatedHashtags": ["#tag1","#tag2","#tag3","#tag4","#tag5"],
  "bestUsedWith": ["content type 1","content type 2","content type 3"],
  "topBrandsUsing": ["brand1","brand2","brand3"],
  "contentCalendar": [
    {"day":"Monday","recommendation":"what to post"},
    {"day":"Wednesday","recommendation":"what to post"},
    {"day":"Friday","recommendation":"what to post"}
  ],
  "score": {
    "reach": 75,
    "competition": 60,
    "relevance": 82,
    "growth": 88
  }
}`,

    creators: `Generate a deep creator trend intelligence report for "${item.name}" on Instagram in the "${niche}" space in ${geo} ${period}.
${disclaimer}
Return ONLY raw JSON:
{
  "isEstimated": true,
  "disclaimer": "All figures are AI-estimated benchmarks, not live data",
  "overview": "3-4 sentence overview of this creator trend",
  "estimatedMetrics": {
    "avgFollowerRange": "e.g. 50K–500K",
    "avgEngagementRate": "e.g. 4–8%",
    "avgReelViews": "e.g. 100K–400K",
    "brandDealRate": "e.g. 2–4 paid posts/month",
    "audienceGrowthRate": "e.g. +5–10% monthly"
  },
  "creatorProfile": {
    "contentPillars": ["pillar1","pillar2","pillar3"],
    "aestheticStyle": "description of visual identity",
    "toneOfVoice": "how they communicate",
    "postingCadence": "e.g. Daily Reels, 3x Stories/day",
    "signatureElement": "what makes them immediately recognizable"
  },
  "audienceProfile": {
    "primaryAge": "e.g. 20–32",
    "genderSplit": "e.g. 68% female",
    "topLocations": ["location1","location2","location3"],
    "purchaseIntent": "High / Medium / Low"
  },
  "brandOpportunities": [
    {"category":"brand category","fitReason":"why this creator trend suits this brand type","estimatedCost":"e.g. ₹50K–2L per post"}
  ],
  "topExamples": [
    {"handle":"@handle or archetype","why":"what makes them a good example"}
  ],
  "score": {
    "authenticity": 82,
    "commercialViability": 74,
    "audienceQuality": 78,
    "contentConsistency": 80
  }
}`,
  };
  return typeInstructions[type] || typeInstructions.brands;
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

// ── UI Primitives ────────────────────────────────────────────────

function Sparkline({ data = [], color = "#ff3b5c", height = 36, width = 100 }) {
  if (!data || data.length < 2) return null;
  const min = Math.min(...data), max = Math.max(...data), range = max - min || 1;
  const pad = 3, w = width, h = height;
  const pts = data.map((v, i) => {
    const x = pad + (i / (data.length - 1)) * (w - pad * 2);
    const y = h - pad - ((v - min) / range) * (h - pad * 2);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  const polyline = pts.join(" ");
  const areaPoints = `${pts[0].split(",")[0]},${h} ${polyline} ${pts[pts.length - 1].split(",")[0]},${h}`;
  const uid = `${color.replace("#", "")}${w}`;
  return (
    <svg width={w} height={h} style={{ overflow: "visible" }}>
      <defs>
        <linearGradient id={`sg${uid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.25" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={areaPoints} fill={`url(#sg${uid})`} />
      <polyline points={polyline} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={pts[pts.length - 1].split(",")[0]} cy={pts[pts.length - 1].split(",")[1]} r="2.5" fill={color} />
    </svg>
  );
}

function Shimmer({ count = 6 }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
      {[...Array(count)].map((_, i) => (
        <div key={i} style={{ height: "90px", borderRadius: "14px", background: "rgba(255,255,255,0.04)", position: "relative", overflow: "hidden" }}>
          <div style={{ position: "absolute", inset: 0, background: "linear-gradient(90deg,transparent,rgba(255,255,255,0.07),transparent)", animation: "sweep 1.5s ease infinite", animationDelay: `${i * 0.12}s` }} />
        </div>
      ))}
      <style>{`@keyframes sweep{0%{transform:translateX(-100%)}100%{transform:translateX(100%)}}`}</style>
    </div>
  );
}

function ScoreBar({ label, value, color = "#ff3b5c" }) {
  return (
    <div style={{ marginBottom: "10px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
        <span style={{ fontSize: "11px", color: "rgba(255,255,255,0.45)" }}>{label}</span>
        <span style={{ fontSize: "11px", fontWeight: 700, color }}>{value}/100</span>
      </div>
      <div style={{ height: "4px", background: "rgba(255,255,255,0.07)", borderRadius: "2px", overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${value}%`, background: `linear-gradient(90deg, ${color}, ${color}88)`, borderRadius: "2px", transition: "width 0.8s ease" }} />
      </div>
    </div>
  );
}

function MetricPill({ label, value, note }) {
  return (
    <div style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "12px", padding: "12px 14px", flex: "1 1 140px" }}>
      <div style={{ fontSize: "10px", color: "rgba(255,255,255,0.3)", textTransform: "uppercase", letterSpacing: "1px", fontWeight: 600, marginBottom: "5px" }}>{label}</div>
      <div style={{ fontSize: "16px", fontWeight: 800, color: "#fff", letterSpacing: "-0.5px", marginBottom: note ? "3px" : 0 }}>{value}</div>
      {note && <div style={{ fontSize: "10px", color: "rgba(255,255,255,0.25)", lineHeight: 1.4 }}>{note}</div>}
    </div>
  );
}

// ── Deep Insights Drawer ─────────────────────────────────────────

function InsightsDrawer({ item, type, niche, region, timeMode, onClose }) {
  const [insights, setInsights] = useState(null);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState(null);
  const drawerRef = useRef(null);

  useEffect(() => {
    (async () => {
      try {
        const raw = await callClaude(buildInsightPrompt(item, type, niche, region, timeMode));
        setInsights(parseJSON(raw));
      } catch (e) { setError(e.message); }
      finally { setLoading(false); }
    })();
  }, []);

  // Close on outside click
  useEffect(() => {
    const handler = (e) => { if (drawerRef.current && !drawerRef.current.contains(e.target)) onClose(); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const pct = Math.max(0, Math.min(Number(item.growth) || 0, 999));
  const color = pct > 200 ? "#ff3b5c" : pct > 100 ? "#ff8c42" : "#00d4a0";

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 100, display: "flex", justifyContent: "flex-end", background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)", animation: "fadeIn .2s ease" }}>
      <div ref={drawerRef} style={{
        width: "min(560px, 100vw)", height: "100vh", overflowY: "auto",
        background: "#111118", borderLeft: "1px solid rgba(255,255,255,0.08)",
        display: "flex", flexDirection: "column",
        animation: "slideIn .25s ease",
      }}>
        <style>{`@keyframes slideIn{from{transform:translateX(100%)}to{transform:translateX(0)}}`}</style>

        {/* Drawer header */}
        <div style={{ padding: "20px 24px 16px", borderBottom: "1px solid rgba(255,255,255,0.06)", position: "sticky", top: 0, background: "#111118", zIndex: 10 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "12px" }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: "10px", color: "rgba(255,255,255,0.3)", textTransform: "uppercase", letterSpacing: "1.5px", fontWeight: 600, marginBottom: "5px" }}>
                Deep Insights · {type.charAt(0).toUpperCase() + type.slice(1)}
              </div>
              <h2 style={{ fontSize: "20px", fontWeight: 800, color: "#fff", letterSpacing: "-0.5px", lineHeight: 1.2 }}>{item.name}</h2>
              <p style={{ fontSize: "12px", color: "rgba(255,255,255,0.4)", marginTop: "4px" }}>{item.summary}</p>
            </div>
            <button onClick={onClose} style={{ background: "rgba(255,255,255,0.08)", border: "none", color: "rgba(255,255,255,0.5)", borderRadius: "8px", width: "32px", height: "32px", cursor: "pointer", fontSize: "16px", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>✕</button>
          </div>

          {/* Disclaimer banner */}
          <div style={{ marginTop: "12px", padding: "8px 12px", background: "rgba(251,191,36,0.08)", border: "1px solid rgba(251,191,36,0.2)", borderRadius: "8px", display: "flex", gap: "8px", alignItems: "flex-start" }}>
            <span style={{ fontSize: "13px" }}>⚠️</span>
            <p style={{ fontSize: "11px", color: "rgba(251,191,36,0.7)", lineHeight: 1.5 }}>
              <strong>AI-estimated benchmarks.</strong> These figures are generated based on industry patterns and known brand data — not live Instagram data. Use as directional intelligence, not exact metrics.
            </p>
          </div>
        </div>

        {/* Drawer body */}
        <div style={{ padding: "20px 24px 40px", flex: 1 }}>
          {loading && (
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {[...Array(8)].map((_, i) => (
                <div key={i} style={{ height: i % 3 === 0 ? "60px" : "40px", borderRadius: "10px", background: "rgba(255,255,255,0.04)", position: "relative", overflow: "hidden" }}>
                  <div style={{ position: "absolute", inset: 0, background: "linear-gradient(90deg,transparent,rgba(255,255,255,0.06),transparent)", animation: "sweep 1.5s ease infinite", animationDelay: `${i * 0.1}s` }} />
                </div>
              ))}
              <p style={{ textAlign: "center", color: "rgba(255,255,255,0.2)", fontSize: "12px", marginTop: "8px" }}>Generating deep insights…</p>
            </div>
          )}

          {error && <div style={{ padding: "14px", background: "rgba(255,59,92,0.08)", border: "1px solid rgba(255,59,92,0.2)", borderRadius: "10px", color: "#ff8080", fontSize: "13px" }}>⚠️ {error}</div>}

          {insights && !loading && (() => {
            const m = insights.estimatedMetrics || {};
            const scores = insights.score || {};
            const scoreColor = (v) => v >= 80 ? "#00d4a0" : v >= 65 ? "#ff8c42" : "#ff3b5c";

            return (
              <div style={{ display: "flex", flexDirection: "column", gap: "22px" }}>

                {/* Overview */}
                <section>
                  <SectionTitle>Overview</SectionTitle>
                  <p style={{ fontSize: "13px", color: "rgba(255,255,255,0.55)", lineHeight: 1.7 }}>{insights.overview}</p>
                </section>

                {/* Estimated Metrics grid */}
                <section>
                  <SectionTitle>Estimated Benchmarks</SectionTitle>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                    {Object.entries(m).filter(([k]) => !k.endsWith("Note")).map(([key, val]) => {
                      const noteKey = key + "Note";
                      const note = m[noteKey];
                      const label = key.replace(/([A-Z])/g, " $1").replace(/^./, s => s.toUpperCase());
                      return <MetricPill key={key} label={label} value={val} note={note} />;
                    })}
                  </div>
                </section>

                {/* Scores */}
                {Object.keys(scores).length > 0 && (
                  <section>
                    <SectionTitle>Performance Scores</SectionTitle>
                    {Object.entries(scores).map(([key, val]) => {
                      const label = key.replace(/([A-Z])/g, " $1").replace(/^./, s => s.toUpperCase());
                      return <ScoreBar key={key} label={label} value={val} color={scoreColor(val)} />;
                    })}
                  </section>
                )}

                {/* Content Strategy (brands/reels) */}
                {insights.contentStrategy && (
                  <section>
                    <SectionTitle>Content Strategy</SectionTitle>
                    <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                      {insights.contentStrategy.topFormats && (
                        <InsightRow label="Top Formats" items={insights.contentStrategy.topFormats} />
                      )}
                      {insights.contentStrategy.bestPerformingThemes && (
                        <InsightRow label="Best Themes" items={insights.contentStrategy.bestPerformingThemes} />
                      )}
                      {insights.contentStrategy.postingPattern && (
                        <InsightText label="Posting Pattern" value={insights.contentStrategy.postingPattern} />
                      )}
                      {insights.contentStrategy.audioStrategy && (
                        <InsightText label="Audio Strategy" value={insights.contentStrategy.audioStrategy} />
                      )}
                      {insights.contentStrategy.creatorCollabs && (
                        <InsightText label="Creator Collabs" value={insights.contentStrategy.creatorCollabs} />
                      )}
                    </div>
                  </section>
                )}

                {/* Content Breakdown (reels) */}
                {insights.contentBreakdown && (
                  <section>
                    <SectionTitle>Content Breakdown</SectionTitle>
                    <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                      {insights.contentBreakdown.hookStyle && <InsightText label="Hook Style" value={insights.contentBreakdown.hookStyle} />}
                      {insights.contentBreakdown.visualStyle && <InsightText label="Visual Style" value={insights.contentBreakdown.visualStyle} />}
                      {insights.contentBreakdown.audioTrends && <InsightRow label="Trending Audio" items={insights.contentBreakdown.audioTrends} />}
                      {insights.contentBreakdown.captionStyle && <InsightText label="Caption Style" value={insights.contentBreakdown.captionStyle} />}
                      {insights.contentBreakdown.ctaPatterns && <InsightRow label="CTA Patterns" items={insights.contentBreakdown.ctaPatterns} />}
                    </div>
                  </section>
                )}

                {/* Audience Profile */}
                {insights.audienceProfile && (
                  <section>
                    <SectionTitle>Audience Profile</SectionTitle>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                      {insights.audienceProfile.primaryAge && <MetricPill label="Age Range" value={insights.audienceProfile.primaryAge} />}
                      {insights.audienceProfile.genderSplit && <MetricPill label="Gender Split" value={insights.audienceProfile.genderSplit} />}
                      {insights.audienceProfile.purchaseIntent && <MetricPill label="Purchase Intent" value={insights.audienceProfile.purchaseIntent} />}
                    </div>
                    {insights.audienceProfile.topLocations && (
                      <div style={{ marginTop: "8px" }}>
                        <InsightRow label="Top Locations" items={insights.audienceProfile.topLocations} />
                      </div>
                    )}
                    {insights.audienceProfile.interests && (
                      <div style={{ marginTop: "8px" }}>
                        <InsightRow label="Interests" items={insights.audienceProfile.interests} />
                      </div>
                    )}
                  </section>
                )}

                {/* Creator Profile */}
                {insights.creatorProfile && (
                  <section>
                    <SectionTitle>Creator Profile</SectionTitle>
                    <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                      {insights.creatorProfile.contentPillars && <InsightRow label="Content Pillars" items={insights.creatorProfile.contentPillars} />}
                      {insights.creatorProfile.aestheticStyle && <InsightText label="Aesthetic" value={insights.creatorProfile.aestheticStyle} />}
                      {insights.creatorProfile.toneOfVoice && <InsightText label="Tone of Voice" value={insights.creatorProfile.toneOfVoice} />}
                      {insights.creatorProfile.postingCadence && <InsightText label="Posting Cadence" value={insights.creatorProfile.postingCadence} />}
                      {insights.creatorProfile.signatureElement && <InsightText label="Signature Element" value={insights.creatorProfile.signatureElement} />}
                    </div>
                  </section>
                )}

                {/* Recent Wins */}
                {insights.recentWins?.length > 0 && (
                  <section>
                    <SectionTitle>Recent Wins</SectionTitle>
                    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                      {insights.recentWins.map((w, i) => (
                        <div key={i} style={{ padding: "12px 14px", background: "rgba(0,212,160,0.05)", border: "1px solid rgba(0,212,160,0.12)", borderRadius: "10px" }}>
                          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                            <span style={{ fontSize: "12px", fontWeight: 700, color: "#00d4a0" }}>{w.title}</span>
                            {w.estimatedReach && <span style={{ fontSize: "11px", color: "rgba(0,212,160,0.6)", background: "rgba(0,212,160,0.1)", padding: "1px 8px", borderRadius: "10px" }}>~{w.estimatedReach} reach</span>}
                          </div>
                          <p style={{ fontSize: "12px", color: "rgba(255,255,255,0.45)", lineHeight: 1.5, margin: 0 }}>{w.description}</p>
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                {/* How to Replicate */}
                {insights.howToReplicate?.length > 0 && (
                  <section>
                    <SectionTitle>How to Replicate This</SectionTitle>
                    <div style={{ display: "flex", flexDirection: "column", gap: "7px" }}>
                      {insights.howToReplicate.map((step, i) => (
                        <div key={i} style={{ display: "flex", gap: "10px", alignItems: "flex-start" }}>
                          <span style={{ width: "20px", height: "20px", borderRadius: "50%", background: "rgba(255,59,92,0.15)", color: "#ff3b5c", fontSize: "10px", fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: "1px" }}>{i + 1}</span>
                          <p style={{ fontSize: "12.5px", color: "rgba(255,255,255,0.55)", lineHeight: 1.6, margin: 0 }}>{step}</p>
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                {/* Brand Opportunities (creators) */}
                {insights.brandOpportunities?.length > 0 && (
                  <section>
                    <SectionTitle>Brand Opportunities</SectionTitle>
                    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                      {insights.brandOpportunities.map((opp, i) => (
                        <div key={i} style={{ padding: "12px 14px", background: "rgba(99,179,237,0.05)", border: "1px solid rgba(99,179,237,0.12)", borderRadius: "10px" }}>
                          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px", gap: "8px" }}>
                            <span style={{ fontSize: "12px", fontWeight: 700, color: "#63b3ed" }}>{opp.category}</span>
                            {opp.estimatedCost && <span style={{ fontSize: "11px", color: "rgba(99,179,237,0.6)", whiteSpace: "nowrap" }}>{opp.estimatedCost}</span>}
                          </div>
                          <p style={{ fontSize: "12px", color: "rgba(255,255,255,0.45)", lineHeight: 1.5, margin: 0 }}>{opp.fitReason}</p>
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                {/* Competitor Comparison */}
                {insights.competitorComparison?.length > 0 && (
                  <section>
                    <SectionTitle>vs. Competitors</SectionTitle>
                    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                      {insights.competitorComparison.map((c, i) => (
                        <div key={i} style={{ padding: "12px 14px", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: "10px" }}>
                          <div style={{ fontSize: "12px", fontWeight: 700, color: "#fff", marginBottom: "6px" }}>vs. {c.brand}</div>
                          <div style={{ display: "flex", gap: "8px" }}>
                            <div style={{ flex: 1, padding: "6px 10px", background: "rgba(0,212,160,0.06)", borderRadius: "7px" }}>
                              <div style={{ fontSize: "9px", color: "rgba(0,212,160,0.6)", fontWeight: 700, marginBottom: "3px", textTransform: "uppercase" }}>✓ Advantage</div>
                              <p style={{ fontSize: "11.5px", color: "rgba(255,255,255,0.5)", margin: 0, lineHeight: 1.4 }}>{c.advantage}</p>
                            </div>
                            <div style={{ flex: 1, padding: "6px 10px", background: "rgba(255,59,92,0.06)", borderRadius: "7px" }}>
                              <div style={{ fontSize: "9px", color: "rgba(255,59,92,0.6)", fontWeight: 700, marginBottom: "3px", textTransform: "uppercase" }}>↓ Gap</div>
                              <p style={{ fontSize: "11.5px", color: "rgba(255,255,255,0.5)", margin: 0, lineHeight: 1.4 }}>{c.disadvantage}</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                {/* Who is Winning (reels) */}
                {insights.whoIsWinning?.length > 0 && (
                  <section>
                    <SectionTitle>Who's Winning With This Format</SectionTitle>
                    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                      {insights.whoIsWinning.map((w, i) => (
                        <div key={i} style={{ padding: "12px 14px", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: "10px" }}>
                          <div style={{ fontSize: "12px", fontWeight: 700, color: "#fff", marginBottom: "4px" }}>{w.type}</div>
                          <p style={{ fontSize: "12px", color: "rgba(255,255,255,0.45)", lineHeight: 1.5, margin: "0 0 4px" }}>{w.why}</p>
                          <p style={{ fontSize: "11px", color: "rgba(255,255,255,0.28)", margin: 0, fontStyle: "italic" }}>e.g. {w.example}</p>
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                {/* Opportunities + Red Flags */}
                <div style={{ display: "flex", gap: "10px" }}>
                  {insights.opportunities?.length > 0 && (
                    <section style={{ flex: 1 }}>
                      <SectionTitle>Opportunities</SectionTitle>
                      {insights.opportunities.map((o, i) => (
                        <div key={i} style={{ display: "flex", gap: "8px", marginBottom: "7px", alignItems: "flex-start" }}>
                          <span style={{ color: "#00d4a0", fontSize: "12px", marginTop: "2px", flexShrink: 0 }}>↑</span>
                          <p style={{ fontSize: "12px", color: "rgba(255,255,255,0.5)", lineHeight: 1.5, margin: 0 }}>{o}</p>
                        </div>
                      ))}
                    </section>
                  )}
                  {insights.redFlags?.length > 0 && (
                    <section style={{ flex: 1 }}>
                      <SectionTitle>Watch Out</SectionTitle>
                      {insights.redFlags.map((r, i) => (
                        <div key={i} style={{ display: "flex", gap: "8px", marginBottom: "7px", alignItems: "flex-start" }}>
                          <span style={{ color: "#ff3b5c", fontSize: "12px", marginTop: "2px", flexShrink: 0 }}>⚠</span>
                          <p style={{ fontSize: "12px", color: "rgba(255,255,255,0.5)", lineHeight: 1.5, margin: 0 }}>{r}</p>
                        </div>
                      ))}
                    </section>
                  )}
                </div>

                {/* Related hashtags */}
                {insights.relatedHashtags?.length > 0 && (
                  <section>
                    <SectionTitle>Related Hashtags</SectionTitle>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                      {insights.relatedHashtags.map((t, i) => (
                        <span key={i} style={{ fontSize: "12px", color: "#a78bfa", background: "rgba(167,139,250,0.1)", border: "1px solid rgba(167,139,250,0.2)", padding: "4px 12px", borderRadius: "20px" }}>{t}</span>
                      ))}
                    </div>
                  </section>
                )}

                {/* Content Calendar */}
                {insights.contentCalendar?.length > 0 && (
                  <section>
                    <SectionTitle>Content Calendar Tips</SectionTitle>
                    {insights.contentCalendar.map((c, i) => (
                      <div key={i} style={{ display: "flex", gap: "10px", marginBottom: "8px", alignItems: "flex-start" }}>
                        <span style={{ fontSize: "11px", fontWeight: 700, color: "#a78bfa", background: "rgba(167,139,250,0.1)", padding: "3px 10px", borderRadius: "8px", flexShrink: 0, whiteSpace: "nowrap" }}>{c.day}</span>
                        <p style={{ fontSize: "12px", color: "rgba(255,255,255,0.5)", lineHeight: 1.5, margin: 0 }}>{c.recommendation}</p>
                      </div>
                    ))}
                  </section>
                )}

              </div>
            );
          })()}
        </div>
      </div>
    </div>
  );
}

function SectionTitle({ children }) {
  return (
    <h3 style={{ fontSize: "10px", fontWeight: 700, color: "rgba(255,255,255,0.3)", textTransform: "uppercase", letterSpacing: "1.5px", marginBottom: "10px" }}>{children}</h3>
  );
}

function InsightRow({ label, items }) {
  return (
    <div>
      <span style={{ fontSize: "11px", color: "rgba(255,255,255,0.3)", marginRight: "8px" }}>{label}:</span>
      <div style={{ display: "inline-flex", flexWrap: "wrap", gap: "5px", marginTop: "4px" }}>
        {items.map((item, i) => (
          <span key={i} style={{ fontSize: "11.5px", color: "rgba(255,255,255,0.55)", background: "rgba(255,255,255,0.06)", padding: "3px 10px", borderRadius: "20px" }}>{item}</span>
        ))}
      </div>
    </div>
  );
}

function InsightText({ label, value }) {
  return (
    <div>
      <span style={{ fontSize: "11px", color: "rgba(255,255,255,0.3)" }}>{label}: </span>
      <span style={{ fontSize: "12.5px", color: "rgba(255,255,255,0.55)" }}>{value}</span>
    </div>
  );
}

// ── TrendCard ────────────────────────────────────────────────────

function TrendCard({ item, index, timeMode, accentColor, type, niche, region }) {
  const [showInsights, setShowInsights] = useState(false);
  const pct = Math.max(0, Math.min(Number(item.growth) || 0, 999));
  const color = accentColor || (pct > 200 ? "#ff3b5c" : pct > 100 ? "#ff8c42" : "#00d4a0");
  const sparkData = Array.isArray(item.sparkline) && item.sparkline.length === 8 ? item.sparkline : null;
  const [expanded, setExpanded] = useState(false);

  return (
    <>
      <div style={{
        position: "relative", overflow: "hidden",
        background: "rgba(255,255,255,0.035)", border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: "14px", transition: "border-color .18s, background .18s",
      }}
        onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.055)"; e.currentTarget.style.borderColor = `${color}44`; }}
        onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.035)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)"; }}
      >
        <div style={{ position: "absolute", top: 0, left: 0, height: "2px", width: `${Math.min(pct / 6, 100)}%`, background: `linear-gradient(90deg,${color},transparent)` }} />

        {/* Main row */}
        <div style={{ padding: "15px 18px", cursor: "pointer" }} onClick={() => setExpanded(o => !o)}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "14px" }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "5px", flexWrap: "wrap" }}>
                <span style={{ fontSize: "11px", color: "rgba(255,255,255,0.22)" }}>#{index + 1}</span>
                <span style={{ fontSize: "14px", fontWeight: 700, color: "#fff", letterSpacing: "-0.2px" }}>{item.name}</span>
                {item.isNew && <span style={{ fontSize: "9px", fontWeight: 800, letterSpacing: "1px", color, background: `${color}22`, padding: "2px 7px", borderRadius: "20px", textTransform: "uppercase" }}>NEW</span>}
                {timeMode === "30days" && item.peakWeek && (
                  <span style={{ fontSize: "10px", color: "rgba(255,255,255,0.28)", background: "rgba(255,255,255,0.05)", padding: "2px 8px", borderRadius: "20px" }}>📈 {item.peakWeek}</span>
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
        </div>

        {/* Expanded summary + Deep Insights button */}
        {expanded && (
          <div style={{ padding: "0 18px 15px", borderTop: "1px solid rgba(255,255,255,0.05)", paddingTop: "13px" }}>
            {timeMode === "30days" && sparkData && (
              <div style={{ marginBottom: "12px" }}>
                <p style={{ fontSize: "10px", color: "rgba(255,255,255,0.28)", marginBottom: "5px", textTransform: "uppercase", letterSpacing: "1px", fontWeight: 600 }}>30-Day Momentum</p>
                <Sparkline data={sparkData} color={color} width={360} height={48} />
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: "2px" }}>
                  <span style={{ fontSize: "10px", color: "rgba(255,255,255,0.18)" }}>Day 1</span>
                  <span style={{ fontSize: "10px", color: "rgba(255,255,255,0.18)" }}>Day 30</span>
                </div>
              </div>
            )}
            <p style={{ margin: "0 0 12px", fontSize: "12.5px", color: "rgba(255,255,255,0.55)", lineHeight: 1.65 }}>{item.detail}</p>
            {Array.isArray(item.tags) && item.tags.length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginBottom: "14px" }}>
                {item.tags.map((t, ti) => (
                  <span key={ti} style={{ fontSize: "11px", color: "rgba(255,255,255,0.35)", background: "rgba(255,255,255,0.05)", padding: "3px 10px", borderRadius: "20px" }}>{t}</span>
                ))}
              </div>
            )}
            {/* Deep Insights CTA */}
            <button
              onClick={(e) => { e.stopPropagation(); setShowInsights(true); }}
              style={{
                display: "flex", alignItems: "center", gap: "7px",
                padding: "8px 16px", borderRadius: "9px", fontSize: "12px", fontWeight: 700,
                cursor: "pointer", fontFamily: "inherit", transition: "all .15s",
                background: `${color}15`, border: `1px solid ${color}33`, color,
              }}
              onMouseEnter={e => { e.currentTarget.style.background = `${color}25`; }}
              onMouseLeave={e => { e.currentTarget.style.background = `${color}15`; }}
            >
              <span>🔬</span> Deep Insights & Benchmarks →
            </button>
          </div>
        )}
      </div>

      {showInsights && (
        <InsightsDrawer
          item={item}
          type={type}
          niche={niche}
          region={region}
          timeMode={timeMode}
          onClose={() => setShowInsights(false)}
        />
      )}
    </>
  );
}

// ── Search Results ────────────────────────────────────────────────

const SEARCH_SECTIONS = [
  { id: "reels",    emoji: "🎬", label: "Reels",    color: "#ff3b5c" },
  { id: "hashtags", emoji: "#",  label: "Hashtags", color: "#a78bfa" },
  { id: "brands",   emoji: "🏷️", label: "Brands",   color: "#34d399" },
  { id: "creators", emoji: "✨", label: "Creators", color: "#fbbf24" },
];

function SearchResults({ results, loading, error, timeMode, niche, region }) {
  const [activeTab, setActiveTab] = useState("reels");
  if (loading) return <Shimmer count={8} />;
  if (error) return <div style={{ padding: "12px 15px", background: "rgba(255,59,92,0.08)", border: "1px solid rgba(255,59,92,0.2)", borderRadius: "10px", color: "#ff8080", fontSize: "13px" }}>⚠️ {error}</div>;
  if (!results) return null;

  const sec = SEARCH_SECTIONS.find(s => s.id === activeTab);
  const items = results[activeTab] || [];

  return (
    <div style={{ animation: "fadeIn .3s ease" }}>
      {results.overview && (
        <div style={{ padding: "14px 16px", background: "rgba(99,179,237,0.06)", border: "1px solid rgba(99,179,237,0.15)", borderRadius: "12px", marginBottom: "18px" }}>
          <span style={{ fontSize: "11px", fontWeight: 700, color: "#63b3ed", letterSpacing: "1px", textTransform: "uppercase", marginRight: "8px" }}>Overview</span>
          <span style={{ fontSize: "13px", color: "rgba(255,255,255,0.55)", lineHeight: 1.6 }}>{results.overview}</span>
        </div>
      )}
      <div style={{ display: "flex", gap: "6px", marginBottom: "16px", overflowX: "auto" }}>
        {SEARCH_SECTIONS.map(s => (
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
            <span style={{ fontSize: "10px", background: activeTab === s.id ? `${s.color}22` : "rgba(255,255,255,0.06)", padding: "1px 6px", borderRadius: "10px", color: activeTab === s.id ? s.color : "rgba(255,255,255,0.3)" }}>{(results[s.id] || []).length}</span>
          </button>
        ))}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: "9px" }}>
        {items.map((item, i) => (
          <TrendCard key={i} item={item} index={i} timeMode={timeMode} accentColor={sec?.color} type={activeTab} niche={niche} region={region} />
        ))}
        {items.length === 0 && <div style={{ textAlign: "center", padding: "40px", color: "rgba(255,255,255,0.2)", fontSize: "13px" }}>No data for this category</div>}
      </div>
    </div>
  );
}

// ── Main App ─────────────────────────────────────────────────────

export default function TrendTracker() {
  const [mode, setMode] = useState("tracker");
  const [niche, setNiche] = useState("All Fashion & Beauty");
  const [region, setRegion] = useState("global");
  const [section, setSection] = useState("reels");
  const [timeMode, setTimeMode] = useState("today");
  const [cache, setCache] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [updatedAt, setUpdatedAt] = useState(null);
  const [summary, setSummary] = useState("");
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [searchResults, setSearchResults] = useState(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState(null);
  const [searchRegion, setSearchRegion] = useState("global");
  const [searchTimeMode, setSearchTimeMode] = useState("today");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const searchRef = useRef(null);

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
    try { setSummary((await callClaude(buildSummaryPrompt(n, r, t))).trim()); }
    catch { setSummary("Brief unavailable."); }
    finally { setSummaryLoading(false); }
  }, []);

  useEffect(() => { if (mode === "tracker") loadTrends(niche, region, section, timeMode); }, [niche, region, section, timeMode, mode]);
  useEffect(() => { if (mode === "tracker") loadSummary(niche, region, timeMode); }, [niche, region, timeMode, mode]);

  const runSearch = useCallback(async (q, r, t) => {
    if (!q.trim()) return;
    setSearchLoading(true); setSearchError(null); setSearchResults(null);
    try { setSearchResults(parseJSON(await callClaude(buildSearchPrompt(q, r, t)))); }
    catch (err) { setSearchError(err.message || "Search failed."); }
    finally { setSearchLoading(false); }
  }, []);

  const handleSearch = (q) => {
    const query = q || searchInput;
    if (!query.trim()) return;
    setSearchQuery(query); setSearchInput(query); setShowSuggestions(false);
    runSearch(query, searchRegion, searchTimeMode);
  };

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
        input::placeholder { color:rgba(255,255,255,0.25); }
        input:focus { outline:none; }
      `}</style>

      {/* HEADER */}
      <header style={{ position: "sticky", top: 0, zIndex: 30, background: "rgba(11,11,16,0.94)", backdropFilter: "blur(20px)", borderBottom: "1px solid rgba(255,255,255,0.06)", padding: "18px 24px 0" }}>
        <div style={{ maxWidth: "780px", margin: "0 auto" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "14px", flexWrap: "wrap", gap: "10px" }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "7px", marginBottom: "3px" }}>
                <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#ff3b5c", boxShadow: "0 0 8px #ff3b5c", display: "inline-block", animation: "pulse 2s infinite" }} />
                <span style={{ fontSize: "10px", letterSpacing: "2px", textTransform: "uppercase", color: "rgba(255,255,255,0.3)", fontWeight: 600 }}>Instagram · Trend Intel</span>
              </div>
              <h1 style={{ fontSize: "21px", fontWeight: 800, letterSpacing: "-0.7px" }}>
                Fashion &amp; Beauty <span style={{ background: "linear-gradient(120deg,#ff3b5c,#ff8c42)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>Trend Tracker</span>
              </h1>
            </div>
            <div style={{ display: "flex", background: "rgba(255,255,255,0.05)", borderRadius: "10px", padding: "3px", gap: "2px" }}>
              {[{ id: "tracker", label: "📊 Tracker" }, { id: "search", label: "🔍 Search" }, { id: "brand", label: "📈 Brand Intel" }, { id: "compare", label: "⚡ Compare" }].map(m => (
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

          {/* TRACKER CONTROLS */}
          {mode === "tracker" && (<>
            <div style={{ display: "flex", gap: "16px", flexWrap: "wrap", alignItems: "flex-start", marginBottom: "14px" }}>
              <div style={{ flex: 1, minWidth: "260px" }}>
                <p style={{ fontSize: "10px", letterSpacing: "1.5px", textTransform: "uppercase", color: "rgba(255,255,255,0.25)", fontWeight: 600, marginBottom: "7px" }}>Niche</p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "5px" }}>
                  {NICHES.map(n => (
                    <button key={n} onClick={() => setNiche(n)} style={{ padding: "4px 11px", borderRadius: "20px", fontSize: "11.5px", fontWeight: 600, cursor: "pointer", fontFamily: "inherit", transition: "all .15s", background: niche === n ? "rgba(255,59,92,0.14)" : "rgba(255,255,255,0.05)", border: `1px solid ${niche === n ? "rgba(255,59,92,0.4)" : "rgba(255,255,255,0.07)"}`, color: niche === n ? "#ff3b5c" : "rgba(255,255,255,0.4)" }}>{n}</button>
                  ))}
                </div>
              </div>
              <div>
                <p style={{ fontSize: "10px", letterSpacing: "1.5px", textTransform: "uppercase", color: "rgba(255,255,255,0.25)", fontWeight: 600, marginBottom: "7px" }}>Geography</p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "5px" }}>
                  {REGIONS.map(r => (
                    <button key={r.code} onClick={() => setRegion(r.code)} style={{ padding: "4px 10px", borderRadius: "20px", fontSize: "11.5px", fontWeight: 600, cursor: "pointer", fontFamily: "inherit", transition: "all .15s", background: region === r.code ? "rgba(99,179,237,0.15)" : "rgba(255,255,255,0.05)", border: `1px solid ${region === r.code ? "rgba(99,179,237,0.4)" : "rgba(255,255,255,0.07)"}`, color: region === r.code ? "#63b3ed" : "rgba(255,255,255,0.4)" }}>{r.flag} {r.label}</button>
                  ))}
                </div>
              </div>
            </div>
            <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: "10px", padding: "10px 14px", minHeight: "38px", display: "flex", alignItems: "center", marginBottom: "0" }}>
              {summaryLoading
                ? <div style={{ height: "12px", width: "60%", borderRadius: "4px", background: "rgba(255,255,255,0.07)", animation: "pulse 1.5s infinite" }} />
                : <p style={{ fontSize: "12px", color: "rgba(255,255,255,0.48)", lineHeight: 1.6 }}><span style={{ color: "#ff3b5c", fontWeight: 700, marginRight: "6px" }}>{activeRegion?.flag} {timeMode === "30days" ? "30-Day Brief:" : "Today's Brief:"}</span>{summary || "Loading…"}</p>
              }
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginTop: "14px" }}>
              <div style={{ display: "flex", gap: "2px", overflowX: "auto" }}>
                {SECTIONS.map(s => (
                  <button key={s.id} onClick={() => setSection(s.id)} style={{ display: "flex", alignItems: "center", gap: "5px", padding: "9px 16px", borderRadius: "10px 10px 0 0", fontSize: "12.5px", fontWeight: section === s.id ? 700 : 500, cursor: "pointer", whiteSpace: "nowrap", transition: "all .15s", fontFamily: "inherit", background: section === s.id ? "rgba(255,59,92,0.1)" : "transparent", borderTop: `1px solid ${section === s.id ? "rgba(255,59,92,0.3)" : "transparent"}`, borderLeft: `1px solid ${section === s.id ? "rgba(255,59,92,0.3)" : "transparent"}`, borderRight: `1px solid ${section === s.id ? "rgba(255,59,92,0.3)" : "transparent"}`, borderBottom: `2px solid ${section === s.id ? "rgba(255,59,92,0.6)" : "transparent"}`, color: section === s.id ? "#fff" : "rgba(255,255,255,0.35)" }}>{s.emoji} {s.label}</button>
                ))}
              </div>
              <div style={{ display: "flex", background: "rgba(255,255,255,0.04)", borderRadius: "8px", padding: "2px", gap: "2px", marginBottom: "0", flexShrink: 0 }}>
                {TIME_MODES.map(tm => (
                  <button key={tm.id} onClick={() => setTimeMode(tm.id)} style={{ padding: "5px 12px", borderRadius: "6px", fontSize: "11px", fontWeight: 600, cursor: "pointer", fontFamily: "inherit", transition: "all .15s", background: timeMode === tm.id ? "rgba(255,59,92,0.2)" : "transparent", border: `1px solid ${timeMode === tm.id ? "rgba(255,59,92,0.3)" : "transparent"}`, color: timeMode === tm.id ? "#ff3b5c" : "rgba(255,255,255,0.35)" }}>{tm.label}</button>
                ))}
              </div>
            </div>
          </>)}

          {/* SEARCH CONTROLS */}
          {mode === "search" && (
            <div style={{ paddingBottom: "16px" }}>
              <div ref={searchRef} style={{ position: "relative", marginBottom: "12px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "10px", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: "12px", padding: "11px 16px", transition: "border-color .2s" }}>
                  <span style={{ fontSize: "16px", opacity: 0.5 }}>🔍</span>
                  <input value={searchInput} onChange={e => { setSearchInput(e.target.value); setShowSuggestions(true); }} onKeyDown={e => e.key === "Enter" && handleSearch()} onFocus={() => setShowSuggestions(true)} placeholder='Try "bed linen", "matcha", "luxury watches"…' style={{ flex: 1, background: "transparent", border: "none", color: "#fff", fontSize: "14px", fontFamily: "inherit", fontWeight: 500 }} />
                  {searchInput && <button onClick={() => { setSearchInput(""); setSearchResults(null); setSearchQuery(""); }} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.3)", cursor: "pointer", fontSize: "16px", padding: "0 2px" }}>✕</button>}
                  <button onClick={() => handleSearch()} disabled={!searchInput.trim() || searchLoading} style={{ background: "rgba(99,179,237,0.15)", border: "1px solid rgba(99,179,237,0.3)", color: searchInput.trim() ? "#63b3ed" : "rgba(255,255,255,0.2)", borderRadius: "8px", padding: "6px 14px", fontSize: "12px", fontWeight: 700, cursor: searchInput.trim() && !searchLoading ? "pointer" : "not-allowed", fontFamily: "inherit", whiteSpace: "nowrap", transition: "all .15s" }}>{searchLoading ? "Searching…" : "Search"}</button>
                </div>
                {showSuggestions && !searchLoading && (
                  <div style={{ position: "absolute", top: "calc(100% + 6px)", left: 0, right: 0, zIndex: 50, background: "#17171f", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "12px", padding: "8px", boxShadow: "0 16px 40px rgba(0,0,0,0.5)" }}>
                    <p style={{ fontSize: "10px", color: "rgba(255,255,255,0.25)", fontWeight: 600, letterSpacing: "1px", textTransform: "uppercase", padding: "4px 8px 8px" }}>Popular searches</p>
                    {SEARCH_SUGGESTIONS.filter(s => !searchInput || s.toLowerCase().includes(searchInput.toLowerCase())).map(s => (
                      <div key={s} onClick={() => handleSearch(s)} style={{ padding: "8px 12px", borderRadius: "8px", fontSize: "13px", color: "rgba(255,255,255,0.6)", cursor: "pointer", display: "flex", alignItems: "center", gap: "8px", transition: "all .12s" }} onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.05)"; e.currentTarget.style.color = "#fff"; }} onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "rgba(255,255,255,0.6)"; }}>
                        <span style={{ opacity: 0.4 }}>↗</span> {s}
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div style={{ display: "flex", gap: "16px", flexWrap: "wrap", alignItems: "flex-start" }}>
                <div>
                  <p style={{ fontSize: "10px", letterSpacing: "1.5px", textTransform: "uppercase", color: "rgba(255,255,255,0.25)", fontWeight: 600, marginBottom: "6px" }}>Geography</p>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "5px" }}>
                    {REGIONS.map(r => (
                      <button key={r.code} onClick={() => setSearchRegion(r.code)} style={{ padding: "4px 10px", borderRadius: "20px", fontSize: "11.5px", fontWeight: 600, cursor: "pointer", fontFamily: "inherit", transition: "all .15s", background: searchRegion === r.code ? "rgba(99,179,237,0.15)" : "rgba(255,255,255,0.05)", border: `1px solid ${searchRegion === r.code ? "rgba(99,179,237,0.4)" : "rgba(255,255,255,0.07)"}`, color: searchRegion === r.code ? "#63b3ed" : "rgba(255,255,255,0.4)" }}>{r.flag} {r.label}</button>
                    ))}
                  </div>
                </div>
                <div>
                  <p style={{ fontSize: "10px", letterSpacing: "1.5px", textTransform: "uppercase", color: "rgba(255,255,255,0.25)", fontWeight: 600, marginBottom: "6px" }}>Period</p>
                  <div style={{ display: "flex", background: "rgba(255,255,255,0.04)", borderRadius: "8px", padding: "2px", gap: "2px" }}>
                    {TIME_MODES.map(tm => (
                      <button key={tm.id} onClick={() => setSearchTimeMode(tm.id)} style={{ padding: "6px 14px", borderRadius: "6px", fontSize: "11px", fontWeight: 600, cursor: "pointer", fontFamily: "inherit", transition: "all .15s", background: searchTimeMode === tm.id ? "rgba(255,59,92,0.2)" : "transparent", border: `1px solid ${searchTimeMode === tm.id ? "rgba(255,59,92,0.3)" : "transparent"}`, color: searchTimeMode === tm.id ? "#ff3b5c" : "rgba(255,255,255,0.35)" }}>{tm.label}</button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </header>

      {/* MAIN */}
      <main style={{ maxWidth: "780px", margin: "0 auto", padding: "20px 24px 64px" }}>

        {/* TRACKER MODE */}
        {mode === "tracker" && (<>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
            <span style={{ fontSize: "12px", color: "rgba(255,255,255,0.3)" }}>
              {activeRegion?.flag} <strong style={{ color: "rgba(255,255,255,0.55)" }}>{activeRegion?.label}</strong>{" · "}
              <strong style={{ color: "rgba(255,255,255,0.55)" }}>{timeMode === "30days" ? "Last 30 days" : "Today"}</strong>{" · "}{niche}
              {updatedAt && <span style={{ color: "rgba(255,255,255,0.2)" }}> · {updatedAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>}
            </span>
            <button onClick={() => loadTrends(niche, region, section, timeMode, true)} disabled={loading} style={{ padding: "6px 13px", borderRadius: "9px", fontSize: "12px", fontWeight: 600, cursor: loading ? "not-allowed" : "pointer", fontFamily: "inherit", background: "rgba(255,59,92,0.1)", border: "1px solid rgba(255,59,92,0.2)", color: loading ? "rgba(255,255,255,0.2)" : "#ff3b5c", transition: "all .15s" }}>{loading ? "Loading…" : "↻ Refresh"}</button>
          </div>
          {error && <div style={{ padding: "12px 15px", background: "rgba(255,59,92,0.08)", border: "1px solid rgba(255,59,92,0.2)", borderRadius: "10px", color: "#ff8080", fontSize: "13px", marginBottom: "14px" }}>⚠️ {error}</div>}
          {loading ? <Shimmer /> : trends.length > 0
            ? <div style={{ display: "flex", flexDirection: "column", gap: "9px", animation: "fadeIn .3s ease" }}>
                {trends.map((item, i) => <TrendCard key={`${cacheKey}-${i}`} item={item} index={i} timeMode={timeMode} type={section} niche={niche} region={region} />)}
              </div>
            : !error && <div style={{ textAlign: "center", padding: "60px 20px", color: "rgba(255,255,255,0.18)", fontSize: "13px" }}>Click <strong style={{ color: "rgba(255,255,255,0.28)" }}>↻ Refresh</strong> to load trends.</div>
          }
        </>)}

        {/* COMPARE MODE */}
        {mode === "compare" && <CompareBrands />}

        {/* BRAND INTEL MODE */}
        {mode === "brand" && <BrandIntel />}

        {/* SEARCH MODE */}
        {mode === "search" && (<>
          {!searchQuery && !searchLoading && (
            <div style={{ textAlign: "center", padding: "60px 20px 20px" }}>
              <div style={{ fontSize: "40px", marginBottom: "12px" }}>🔍</div>
              <p style={{ fontSize: "15px", color: "rgba(255,255,255,0.4)", marginBottom: "6px" }}>Search any product, niche or industry</p>
              <p style={{ fontSize: "13px", color: "rgba(255,255,255,0.2)", marginBottom: "6px" }}>Get trend intel on reels, hashtags, brands & creators</p>
              <p style={{ fontSize: "11px", color: "rgba(255,255,255,0.15)" }}>Click any card → expand → hit <strong style={{color:"rgba(255,255,255,0.3)"}}>Deep Insights</strong> for benchmarks & strategy</p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", justifyContent: "center", marginTop: "24px" }}>
                {SEARCH_SUGGESTIONS.slice(0, 6).map(s => (
                  <button key={s} onClick={() => handleSearch(s)} style={{ padding: "7px 15px", borderRadius: "20px", fontSize: "12px", fontWeight: 600, cursor: "pointer", fontFamily: "inherit", transition: "all .15s", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.09)", color: "rgba(255,255,255,0.45)" }} onMouseEnter={e => { e.currentTarget.style.background = "rgba(99,179,237,0.1)"; e.currentTarget.style.borderColor = "rgba(99,179,237,0.3)"; e.currentTarget.style.color = "#63b3ed"; }} onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.05)"; e.currentTarget.style.borderColor = "rgba(99,179,237,0)"; e.currentTarget.style.color = "rgba(255,255,255,0.45)"; }}>↗ {s}</button>
                ))}
              </div>
            </div>
          )}
          {searchQuery && (
            <div style={{ marginBottom: "18px", display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
              <span style={{ fontSize: "13px", color: "rgba(255,255,255,0.35)" }}>Results for</span>
              <span style={{ fontSize: "14px", fontWeight: 700, background: "rgba(99,179,237,0.1)", border: "1px solid rgba(99,179,237,0.25)", padding: "3px 12px", borderRadius: "20px", color: "#63b3ed" }}>"{searchQuery}"</span>
              <span style={{ fontSize: "12px", color: "rgba(255,255,255,0.25)" }}>{REGIONS.find(r => r.code === searchRegion)?.flag} {REGIONS.find(r => r.code === searchRegion)?.label} · {searchTimeMode === "30days" ? "Last 30 days" : "Today"}</span>
              {!searchLoading && <button onClick={() => runSearch(searchQuery, searchRegion, searchTimeMode)} style={{ marginLeft: "auto", padding: "5px 12px", borderRadius: "8px", fontSize: "11px", fontWeight: 600, cursor: "pointer", fontFamily: "inherit", background: "rgba(255,59,92,0.1)", border: "1px solid rgba(255,59,92,0.2)", color: "#ff3b5c" }}>↻ Refresh</button>}
            </div>
          )}
          <SearchResults results={searchResults} loading={searchLoading} error={searchError} timeMode={searchTimeMode} niche={searchQuery} region={searchRegion} />
        </>)}
      </main>
    </div>
  );
}
