import { useState, useCallback, useRef, useEffect } from "react";
import BrandSearch from "./BrandSearch.jsx";

// ── Helpers ──────────────────────────────────────────────────────

function fmt(n) {
  if (n == null || isNaN(Number(n))) return "—";
  n = Number(n);
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000)     return (n / 1_000).toFixed(1) + "K";
  return n.toLocaleString();
}

function num(n) { return Number(n) || 0; }

async function apifyRun(actor, input) {
  const res = await fetch("/api/instagram", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ actor, input }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error || `API error ${res.status}`);
  if (!Array.isArray(data)) throw new Error("Unexpected response from Apify");
  return data;
}

async function askClaude(prompt) {
  const res = await fetch("/api/claude", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 2000,
      messages: [{ role: "user", content: prompt }],
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error || "Claude error");
  const text = data.content?.find(b => b.type === "text")?.text || "";
  const clean = text.trim().replace(/^```json\s*/i,"").replace(/^```\s*/i,"").replace(/```\s*$/i,"").trim();
  const s = clean.indexOf("{"), e = clean.lastIndexOf("}");
  if (s === -1 || e === -1) throw new Error("No JSON in response");
  return JSON.parse(clean.slice(s, e + 1));
}

// ── Visual components ─────────────────────────────────────────────

function Shimmer({ lines = 5, message = "" }) {
  return (
    <div>
      {message && (
        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "14px" }}>
          <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#a78bfa", animation: "pulse 1s infinite" }} />
          <span style={{ fontSize: "12px", color: "rgba(255,255,255,0.35)" }}>{message}</span>
        </div>
      )}
      <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
        {[...Array(lines)].map((_, i) => (
          <div key={i} style={{ height: `${40 + (i % 3) * 20}px`, borderRadius: "12px", background: "rgba(255,255,255,0.04)", position: "relative", overflow: "hidden" }}>
            <div style={{ position: "absolute", inset: 0, background: "linear-gradient(90deg,transparent,rgba(255,255,255,0.07),transparent)", animation: "sweep 1.5s ease infinite", animationDelay: `${i * 0.12}s` }} />
          </div>
        ))}
      </div>
    </div>
  );
}

// Donut chart for demographics
function DonutChart({ segments, size = 120 }) {
  const r = 40, cx = 60, cy = 60;
  const circumference = 2 * Math.PI * r;
  let offset = 0;
  const total = segments.reduce((s, seg) => s + seg.value, 0);

  return (
    <svg width={size} height={size} viewBox="0 0 120 120">
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="18" />
      {segments.map((seg, i) => {
        const dash = (seg.value / total) * circumference;
        const gap  = circumference - dash;
        const el = (
          <circle
            key={i}
            cx={cx} cy={cy} r={r}
            fill="none"
            stroke={seg.color}
            strokeWidth="18"
            strokeDasharray={`${dash} ${gap}`}
            strokeDashoffset={-offset}
            strokeLinecap="butt"
            style={{ transform: "rotate(-90deg)", transformOrigin: "60px 60px" }}
          />
        );
        offset += dash;
        return el;
      })}
      {/* Centre text */}
      <text x={cx} y={cy - 4} textAnchor="middle" fill="#fff" fontSize="13" fontWeight="800">{segments[0]?.value}%</text>
      <text x={cx} y={cy + 10} textAnchor="middle" fill="rgba(255,255,255,0.4)" fontSize="8">{segments[0]?.label}</text>
    </svg>
  );
}

// Horizontal bar
function HBar({ label, value, max, color, suffix = "%" }) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return (
    <div style={{ marginBottom: "10px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
        <span style={{ fontSize: "12px", color: "rgba(255,255,255,0.55)" }}>{label}</span>
        <span style={{ fontSize: "12px", fontWeight: 700, color }}>{value}{suffix}</span>
      </div>
      <div style={{ height: "6px", background: "rgba(255,255,255,0.06)", borderRadius: "4px", overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${pct}%`, background: `linear-gradient(90deg,${color},${color}99)`, borderRadius: "4px", transition: "width 1s cubic-bezier(.4,0,.2,1)" }} />
      </div>
    </div>
  );
}

// Insight card
function InsightCard({ icon, label, value, sub, color = "#a78bfa", badge = null }) {
  return (
    <div style={{ background: `${color}0d`, border: `1px solid ${color}25`, borderRadius: "14px", padding: "16px", flex: 1, minWidth: "140px" }}>
      <div style={{ fontSize: "20px", marginBottom: "8px" }}>{icon}</div>
      <div style={{ fontSize: "10px", color: "rgba(255,255,255,0.35)", textTransform: "uppercase", letterSpacing: "1px", fontWeight: 600, marginBottom: "4px" }}>{label}</div>
      <div style={{ fontSize: "18px", fontWeight: 800, color, letterSpacing: "-0.5px", lineHeight: 1.1, marginBottom: "3px" }}>{value}</div>
      {sub   && <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.35)", lineHeight: 1.4 }}>{sub}</div>}
      {badge && <div style={{ marginTop: "6px", display: "inline-block", fontSize: "9px", fontWeight: 700, color, background: `${color}20`, padding: "2px 8px", borderRadius: "10px", letterSpacing: "0.8px", textTransform: "uppercase" }}>{badge}</div>}
    </div>
  );
}

// Ask anything chat
function AskAnything({ profile, posts, insights, username }) {
  const [question, setQuestion] = useState("");
  const [history,  setHistory]  = useState([]);
  const [loading,  setLoading]  = useState(false);
  const bottomRef = useRef(null);

  const SUGGESTIONS = [
    `What type of content performs best for @${username}?`,
    `What demographics follow @${username}?`,
    `What are the best times to post for @${username}?`,
    `How does @${username} compare to industry averages?`,
    `What hashtags should @${username} use?`,
    `What's the content strategy of @${username}?`,
  ];

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [history]);

  const ask = async (q) => {
    const query = q || question;
    if (!query.trim() || loading) return;
    setQuestion("");
    setHistory(h => [...h, { role: "user", text: query }]);
    setLoading(true);

    try {
      const context = `
Instagram account: @${username}
Full name: ${profile?.fullName ?? username}
Followers: ${fmt(profile?.followersCount)}
Following: ${fmt(profile?.followsCount)}
Posts: ${fmt(profile?.postsCount)}
Bio: ${profile?.biography ?? "N/A"}
Category: ${profile?.businessCategoryName ?? profile?.category ?? "N/A"}
Verified: ${profile?.verified ? "Yes" : "No"}
Total posts analysed: ${posts.length}
Avg video views: ${fmt(Math.round(posts.reduce((s,p) => s + num(p.videoPlayCount ?? p.videoViewCount), 0) / (posts.length || 1)))}
Avg likes: ${fmt(Math.round(posts.reduce((s,p) => s + num(p.likesCount), 0) / (posts.length || 1)))}
Avg comments: ${fmt(Math.round(posts.reduce((s,p) => s + num(p.commentsCount), 0) / (posts.length || 1)))}
AI insights summary: ${JSON.stringify(insights ?? {})}
Sample captions: ${posts.slice(0,5).map(p => p.caption ?? "").filter(Boolean).join(" | ")}
      `.trim();

      const res = await fetch("/api/claude", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 600,
          messages: [
            {
              role: "user",
              content: `You are an expert Instagram analyst. Here is data about an Instagram account:\n\n${context}\n\nAnswer this question concisely and specifically using the data above. Be direct and insightful. Plain text, no markdown headers, 3-5 sentences max.\n\nQuestion: ${query}`
            }
          ],
        }),
      });
      const data = await res.json();
      const text = data.content?.find(b => b.type === "text")?.text ?? "Sorry, couldn't generate an answer.";
      setHistory(h => [...h, { role: "assistant", text }]);
    } catch (err) {
      setHistory(h => [...h, { role: "assistant", text: "Something went wrong — please try again." }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ background: "rgba(167,139,250,0.05)", border: "1px solid rgba(167,139,250,0.15)", borderRadius: "16px", padding: "18px" }}>
      <div style={{ fontSize: "13px", fontWeight: 700, color: "#a78bfa", marginBottom: "14px" }}>💬 Ask anything about @{username}</div>

      {/* Suggestion chips */}
      {history.length === 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginBottom: "14px" }}>
          {SUGGESTIONS.map((s, i) => (
            <button key={i} onClick={() => ask(s)} style={{
              fontSize: "11px", padding: "5px 12px", borderRadius: "20px", cursor: "pointer",
              background: "rgba(167,139,250,0.08)", border: "1px solid rgba(167,139,250,0.2)",
              color: "rgba(255,255,255,0.5)", fontFamily: "inherit", transition: "all .15s", textAlign: "left",
            }}
              onMouseEnter={e => { e.currentTarget.style.background = "rgba(167,139,250,0.15)"; e.currentTarget.style.color = "#a78bfa"; }}
              onMouseLeave={e => { e.currentTarget.style.background = "rgba(167,139,250,0.08)"; e.currentTarget.style.color = "rgba(255,255,255,0.5)"; }}
            >{s}</button>
          ))}
        </div>
      )}

      {/* Chat history */}
      {history.length > 0 && (
        <div style={{ maxHeight: "280px", overflowY: "auto", marginBottom: "12px", display: "flex", flexDirection: "column", gap: "10px" }}>
          {history.map((msg, i) => (
            <div key={i} style={{ display: "flex", justifyContent: msg.role === "user" ? "flex-end" : "flex-start" }}>
              <div style={{
                maxWidth: "85%", padding: "10px 14px", borderRadius: msg.role === "user" ? "14px 14px 4px 14px" : "14px 14px 14px 4px",
                background: msg.role === "user" ? "rgba(167,139,250,0.2)" : "rgba(255,255,255,0.05)",
                border: `1px solid ${msg.role === "user" ? "rgba(167,139,250,0.3)" : "rgba(255,255,255,0.08)"}`,
                fontSize: "12.5px", color: msg.role === "user" ? "#c4b5fd" : "rgba(255,255,255,0.7)",
                lineHeight: 1.6,
              }}>
                {msg.text}
              </div>
            </div>
          ))}
          {loading && (
            <div style={{ display: "flex", justifyContent: "flex-start" }}>
              <div style={{ padding: "10px 14px", borderRadius: "14px 14px 14px 4px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}>
                <div style={{ display: "flex", gap: "4px", alignItems: "center" }}>
                  {[0,1,2].map(i => <div key={i} style={{ width: 6, height: 6, borderRadius: "50%", background: "#a78bfa", animation: "pulse 1s infinite", animationDelay: `${i * 0.2}s` }} />)}
                </div>
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      )}

      {/* Input */}
      <div style={{ display: "flex", gap: "8px" }}>
        <input
          value={question}
          onChange={e => setQuestion(e.target.value)}
          onKeyDown={e => e.key === "Enter" && ask()}
          placeholder="Ask anything about this profile…"
          disabled={loading}
          style={{
            flex: 1, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(167,139,250,0.25)",
            borderRadius: "10px", padding: "10px 14px", color: "#fff", fontSize: "13px", fontFamily: "inherit",
          }}
        />
        <button onClick={() => ask()} disabled={!question.trim() || loading} style={{
          padding: "10px 16px", borderRadius: "10px", fontSize: "13px", fontWeight: 700,
          cursor: !question.trim() || loading ? "not-allowed" : "pointer", fontFamily: "inherit",
          background: "rgba(167,139,250,0.2)", border: "1px solid rgba(167,139,250,0.35)",
          color: question.trim() ? "#a78bfa" : "rgba(255,255,255,0.2)",
        }}>↑</button>
      </div>
    </div>
  );
}

// ── Main DeepProfile ──────────────────────────────────────────────

const INSIGHT_TABS = [
  { id: "overview",     label: "📊 Overview" },
  { id: "demographics", label: "👥 Audience" },
  { id: "content",      label: "🎬 Content" },
  { id: "ask",          label: "💬 Ask AI" },
];

export default function DeepProfile() {
  const [searchMode,   setSearchMode]   = useState("keyword");
  const [inputVal,     setInputVal]     = useState("");
  const [username,     setUsername]     = useState("");
  const [profile,      setProfile]      = useState(null);
  const [posts,        setPosts]        = useState([]);
  const [insights,     setInsights]     = useState(null);
  const [tab,          setTab]          = useState("overview");

  const [step,         setStep]         = useState(""); // status message
  const [loading,      setLoading]      = useState(false);
  const [error,        setError]        = useState(null);

  const lookup = useCallback(async (raw) => {
    const handle = (raw || inputVal).trim().replace(/^@/, "");
    if (!handle) return;

    setUsername(handle);
    setProfile(null); setPosts([]); setInsights(null);
    setError(null); setLoading(true);
    setTab("overview");

    try {
      // Step 1: profile
      setStep("Fetching profile from Instagram…");
      const profileData = await apifyRun("apify~instagram-profile-scraper", { usernames: [handle] });
      const prof = profileData?.[0] ?? null;
      if (!prof) throw new Error(`Account "@${handle}" not found or is private`);
      setProfile(prof);

      // Step 2: posts
      setStep("Fetching recent posts and reels…");
      const postsData = await apifyRun("apify~instagram-scraper", {
        directUrls: [`https://www.instagram.com/${handle}/`],
        resultsType: "posts",
        resultsLimit: 30,
      });
      const postList = Array.isArray(postsData) ? postsData : [];
      setPosts(postList);

      // Step 3: AI deep analysis
      setStep("Running AI analysis — demographics, content strategy, audience insights…");

      const followers   = num(prof.followersCount ?? prof.follower_count);
      const videos      = postList.filter(p => p.videoPlayCount != null || p.videoViewCount != null);
      const avgViews    = videos.length ? Math.round(videos.reduce((s,p) => s + num(p.videoPlayCount ?? p.videoViewCount), 0) / videos.length) : 0;
      const avgLikes    = postList.length ? Math.round(postList.reduce((s,p) => s + num(p.likesCount), 0) / postList.length) : 0;
      const avgComments = postList.length ? Math.round(postList.reduce((s,p) => s + num(p.commentsCount), 0) / postList.length) : 0;
      const captions    = postList.slice(0, 10).map(p => p.caption ?? "").filter(Boolean).join("\n");
      const hashtags    = postList.flatMap(p => (p.hashtags ?? (p.caption ?? "").match(/#\w+/g) ?? [])).slice(0, 30).join(", ");

      const aiResult = await askClaude(`You are an expert Instagram analyst. Analyse this Instagram profile and provide deep insights.

Profile: @${handle}
Full name: ${prof.fullName ?? handle}
Bio: ${prof.biography ?? "N/A"}
Category: ${prof.businessCategoryName ?? prof.category ?? "N/A"}
Verified: ${prof.verified ? "Yes" : "No"}
Followers: ${fmt(followers)}
Following: ${fmt(prof.followsCount)}
Total posts: ${fmt(prof.postsCount)}
Posts analysed: ${postList.length}
Avg video views: ${fmt(avgViews)}
Avg likes/post: ${fmt(avgLikes)}
Avg comments/post: ${fmt(avgComments)}
Engagement rate: ${followers ? (((avgLikes + avgComments) / followers) * 100).toFixed(2) : 0}%
Sample captions: ${captions.slice(0, 800)}
Top hashtags used: ${hashtags}

Respond with ONLY raw JSON. No markdown, no extra text:
{
  "summary": "2-3 sentence sharp overview of this account's Instagram presence and positioning",
  "audience": {
    "genderSplit": { "female": <0-100 number>, "male": <0-100 number>, "other": <0-10 number> },
    "ageGroups": [
      { "range": "13-17", "pct": <number> },
      { "range": "18-24", "pct": <number> },
      { "range": "25-34", "pct": <number> },
      { "range": "35-44", "pct": <number> },
      { "range": "45+",   "pct": <number> }
    ],
    "topLocations": ["city/country 1", "city/country 2", "city/country 3"],
    "audienceType": "one of: Mass Consumer, Niche Enthusiast, Professional, Gen Z, Millennial, Mixed",
    "audienceInterests": ["interest1", "interest2", "interest3", "interest4"],
    "audienceNote": "1 sentence explanation of why these demographics make sense for this account"
  },
  "content": {
    "postingFrequency": "e.g. ~4x per week",
    "bestPostType": "e.g. Reels / Carousels / Static",
    "contentThemes": ["theme1", "theme2", "theme3"],
    "toneAndStyle": "e.g. Aspirational & polished",
    "topHashtags": ["#tag1", "#tag2", "#tag3", "#tag4", "#tag5"],
    "recommendedHashtags": ["#tag1", "#tag2", "#tag3", "#tag4", "#tag5"],
    "bestTimeToPost": "e.g. 7–9 PM IST weekdays",
    "contentGaps": ["gap1", "gap2"]
  },
  "brandScore": {
    "overall": <0-100>,
    "engagement": <0-100>,
    "consistency": <0-100>,
    "reachPotential": <0-100>,
    "contentQuality": <0-100>
  },
  "keyInsights": [
    { "icon": "emoji", "title": "short title", "detail": "1 sentence insight" },
    { "icon": "emoji", "title": "short title", "detail": "1 sentence insight" },
    { "icon": "emoji", "title": "short title", "detail": "1 sentence insight" },
    { "icon": "emoji", "title": "short title", "detail": "1 sentence insight" }
  ],
  "disclaimer": "Note: Audience demographics are AI-estimated based on content analysis, not official Meta data."
}`);

      setInsights(aiResult);
      setStep("");
    } catch (err) {
      setError(err.message || "Something went wrong");
      setStep("");
    } finally {
      setLoading(false);
    }
  }, [inputVal]);

  const handleSelect = useCallback((u) => {
    setInputVal(u);
    lookup(u);
  }, [lookup]);

  const hasData = profile && insights;

  return (
    <div style={{ animation: "fadeIn .3s ease" }}>

      {/* ── Search bar ── */}
      <div style={{ marginBottom: "16px" }}>
        <div style={{ display: "flex", gap: "6px", marginBottom: "10px" }}>
          {[{ id: "keyword", label: "🔍 Search by keyword" }, { id: "exact", label: "@ Exact username" }].map(m => (
            <button key={m.id} onClick={() => setSearchMode(m.id)} style={{
              padding: "6px 14px", borderRadius: "8px", fontSize: "12px", fontWeight: 600,
              cursor: "pointer", fontFamily: "inherit", transition: "all .15s",
              background: searchMode === m.id ? "rgba(167,139,250,0.15)" : "rgba(255,255,255,0.05)",
              border: `1px solid ${searchMode === m.id ? "rgba(167,139,250,0.35)" : "rgba(255,255,255,0.08)"}`,
              color: searchMode === m.id ? "#a78bfa" : "rgba(255,255,255,0.4)",
            }}>{m.label}</button>
          ))}
        </div>

        {searchMode === "keyword" ? (
          <BrandSearch
            onSelect={handleSelect}
            color="#a78bfa"
            placeholder='Search e.g. "cricket player india", "hair care brand", "fitness influencer"…'
            selectedUsernames={username ? [username] : []}
          />
        ) : (
          <div style={{ display: "flex", gap: "8px" }}>
            <div style={{ flex: 1, display: "flex", alignItems: "center", gap: "8px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(167,139,250,0.2)", borderRadius: "10px", padding: "10px 14px" }}>
              <span style={{ opacity: 0.4 }}>👤</span>
              <input
                value={inputVal}
                onChange={e => setInputVal(e.target.value)}
                onKeyDown={e => e.key === "Enter" && lookup()}
                placeholder="e.g. virat.kohli or traya_health"
                style={{ flex: 1, background: "none", border: "none", color: "#fff", fontSize: "13px", fontFamily: "inherit" }}
              />
            </div>
            <button onClick={() => lookup()} disabled={loading || !inputVal.trim()} style={{
              padding: "10px 18px", borderRadius: "10px", fontSize: "12px", fontWeight: 700,
              cursor: loading || !inputVal.trim() ? "not-allowed" : "pointer", fontFamily: "inherit",
              background: "rgba(167,139,250,0.15)", border: "1px solid rgba(167,139,250,0.3)",
              color: inputVal.trim() ? "#a78bfa" : "rgba(255,255,255,0.2)", whiteSpace: "nowrap",
            }}>{loading ? "Analysing…" : "Analyse"}</button>
          </div>
        )}
      </div>

      {/* Loading */}
      {loading && <Shimmer lines={6} message={step} />}

      {/* Error */}
      {error && !loading && (
        <div style={{ padding: "12px 15px", background: "rgba(255,59,92,0.08)", border: "1px solid rgba(255,59,92,0.2)", borderRadius: "10px", color: "#ff8080", fontSize: "13px" }}>⚠️ {error}</div>
      )}

      {/* ── Results ── */}
      {hasData && !loading && (() => {
        const followers   = num(profile.followersCount ?? profile.follower_count);
        const following   = num(profile.followsCount);
        const postsCount  = num(profile.postsCount);
        const fullName    = profile.fullName ?? username;
        const bio         = profile.biography ?? "";
        const isVerified  = profile.verified ?? false;
        const category    = profile.businessCategoryName ?? profile.category ?? "";
        const avatar      = profile.profilePicUrl ?? null;
        const videos      = posts.filter(p => p.videoPlayCount != null || p.videoViewCount != null);
        const avgViews    = videos.length ? Math.round(videos.reduce((s,p) => s + num(p.videoPlayCount ?? p.videoViewCount), 0) / videos.length) : 0;
        const avgLikes    = posts.length  ? Math.round(posts.reduce((s,p) => s + num(p.likesCount), 0) / posts.length) : 0;
        const avgComments = posts.length  ? Math.round(posts.reduce((s,p) => s + num(p.commentsCount), 0) / posts.length) : 0;
        const er          = followers ? (((avgLikes + avgComments) / followers) * 100).toFixed(2) : "0";
        const gender      = insights.audience?.genderSplit ?? {};
        const ageGroups   = insights.audience?.ageGroups ?? [];
        const brandScore  = insights.brandScore ?? {};

        return (
          <div style={{ animation: "fadeIn .3s ease" }}>

            {/* Profile header */}
            <div style={{ display: "flex", gap: "16px", alignItems: "flex-start", marginBottom: "20px", padding: "18px", background: "rgba(167,139,250,0.05)", border: "1px solid rgba(167,139,250,0.15)", borderRadius: "16px" }}>
              <div style={{ width: "68px", height: "68px", borderRadius: "50%", background: "rgba(255,255,255,0.08)", flexShrink: 0, overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "28px" }}>
                {avatar ? <img src={avatar} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} onError={e => e.target.style.display = "none"} /> : "👤"}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "3px", flexWrap: "wrap" }}>
                  <span style={{ fontSize: "18px", fontWeight: 800 }}>{fullName}</span>
                  {isVerified && <span title="Verified">✅</span>}
                  {category && <span style={{ fontSize: "11px", color: "rgba(255,255,255,0.35)", background: "rgba(255,255,255,0.06)", padding: "2px 8px", borderRadius: "20px" }}>{category}</span>}
                </div>
                <div style={{ fontSize: "12px", color: "rgba(255,255,255,0.4)", marginBottom: "6px" }}>@{username}</div>
                {bio && <p style={{ fontSize: "12.5px", color: "rgba(255,255,255,0.5)", lineHeight: 1.55, margin: "0 0 8px" }}>{bio}</p>}
                {insights.summary && <p style={{ fontSize: "13px", color: "rgba(255,255,255,0.65)", lineHeight: 1.6, margin: 0, fontStyle: "italic" }}>"{insights.summary}"</p>}
              </div>
              {/* Brand score ring */}
              <div style={{ textAlign: "center", flexShrink: 0 }}>
                <div style={{ width: "60px", height: "60px", borderRadius: "50%", background: `conic-gradient(#a78bfa ${(brandScore.overall ?? 0) * 3.6}deg, rgba(255,255,255,0.06) 0deg)`, display: "flex", alignItems: "center", justifyContent: "center", position: "relative" }}>
                  <div style={{ width: "46px", height: "46px", borderRadius: "50%", background: "#0b0b10", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column" }}>
                    <span style={{ fontSize: "14px", fontWeight: 800, color: "#a78bfa", lineHeight: 1 }}>{brandScore.overall ?? "—"}</span>
                    <span style={{ fontSize: "8px", color: "rgba(255,255,255,0.3)" }}>/100</span>
                  </div>
                </div>
                <div style={{ fontSize: "9px", color: "rgba(255,255,255,0.3)", marginTop: "5px", textTransform: "uppercase", letterSpacing: "0.8px" }}>Brand Score</div>
              </div>
            </div>

            {/* Quick stats */}
            <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", marginBottom: "20px" }}>
              <InsightCard icon="👥" label="Followers"     value={fmt(followers)}   color="#a78bfa" />
              <InsightCard icon="👁️" label="Avg Views"     value={fmt(avgViews)}    color="#ff8c42" sub="per reel" />
              <InsightCard icon="❤️" label="Avg Likes"     value={fmt(avgLikes)}    color="#ff3b5c" sub="per post" />
              <InsightCard icon="💬" label="Eng. Rate"     value={er + "%"}         color="#00d4a0" badge={Number(er) > 3 ? "Excellent" : Number(er) > 1 ? "Average" : "Low"} />
            </div>

            {/* Insight tabs */}
            <div style={{ display: "flex", gap: "6px", marginBottom: "20px", overflowX: "auto" }}>
              {INSIGHT_TABS.map(t => (
                <button key={t.id} onClick={() => setTab(t.id)} style={{
                  padding: "8px 15px", borderRadius: "10px", fontSize: "12.5px",
                  fontWeight: tab === t.id ? 700 : 500, cursor: "pointer",
                  fontFamily: "inherit", transition: "all .15s", whiteSpace: "nowrap",
                  background: tab === t.id ? "rgba(167,139,250,0.12)" : "rgba(255,255,255,0.04)",
                  border: `1px solid ${tab === t.id ? "rgba(167,139,250,0.3)" : "rgba(255,255,255,0.07)"}`,
                  color: tab === t.id ? "#fff" : "rgba(255,255,255,0.38)",
                }}>{t.label}</button>
              ))}
            </div>

            {/* ── OVERVIEW TAB ── */}
            {tab === "overview" && (
              <div style={{ animation: "fadeIn .3s ease" }}>
                {/* Key insights */}
                {Array.isArray(insights.keyInsights) && (
                  <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginBottom: "20px" }}>
                    {insights.keyInsights.map((ins, i) => (
                      <div key={i} style={{ display: "flex", gap: "14px", alignItems: "flex-start", padding: "14px 16px", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: "12px" }}>
                        <span style={{ fontSize: "22px", flexShrink: 0 }}>{ins.icon}</span>
                        <div>
                          <div style={{ fontSize: "13px", fontWeight: 700, color: "#fff", marginBottom: "3px" }}>{ins.title}</div>
                          <div style={{ fontSize: "12px", color: "rgba(255,255,255,0.5)", lineHeight: 1.5 }}>{ins.detail}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {/* Brand score breakdown */}
                {Object.keys(brandScore).length > 0 && (
                  <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: "14px", padding: "18px" }}>
                    <p style={{ fontSize: "11px", fontWeight: 700, color: "rgba(255,255,255,0.35)", textTransform: "uppercase", letterSpacing: "1px", marginBottom: "14px" }}>Brand Score Breakdown</p>
                    {Object.entries(brandScore).filter(([k]) => k !== "overall").map(([key, val]) => (
                      <HBar key={key} label={key.replace(/([A-Z])/g, " $1").replace(/^./, s => s.toUpperCase())} value={val} max={100} color="#a78bfa" suffix="/100" />
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ── AUDIENCE TAB ── */}
            {tab === "demographics" && (
              <div style={{ animation: "fadeIn .3s ease" }}>
                <div style={{ display: "inline-block", marginBottom: "12px", padding: "6px 12px", background: "rgba(255,193,7,0.1)", border: "1px solid rgba(255,193,7,0.25)", borderRadius: "8px", fontSize: "11px", color: "rgba(255,193,7,0.8)" }}>
                  ⚠️ {insights.disclaimer ?? "Demographics are AI-estimated based on content analysis, not official Meta data."}
                </div>

                <div style={{ display: "flex", gap: "16px", flexWrap: "wrap", marginBottom: "20px" }}>
                  {/* Gender donut */}
                  <div style={{ flex: 1, minWidth: "200px", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: "14px", padding: "18px" }}>
                    <p style={{ fontSize: "11px", fontWeight: 700, color: "rgba(255,255,255,0.35)", textTransform: "uppercase", letterSpacing: "1px", marginBottom: "16px" }}>Gender Split</p>
                    <div style={{ display: "flex", alignItems: "center", gap: "20px" }}>
                      <DonutChart segments={[
                        { label: "Female", value: gender.female ?? 50, color: "#f472b6" },
                        { label: "Male",   value: gender.male ?? 45,   color: "#60a5fa" },
                        { label: "Other",  value: gender.other ?? 5,   color: "#a78bfa" },
                      ]} />
                      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                        {[
                          { label: "Female", value: gender.female ?? 50, color: "#f472b6" },
                          { label: "Male",   value: gender.male ?? 45,   color: "#60a5fa" },
                          { label: "Other",  value: gender.other ?? 5,   color: "#a78bfa" },
                        ].map(g => (
                          <div key={g.label} style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                            <div style={{ width: 8, height: 8, borderRadius: "50%", background: g.color }} />
                            <span style={{ fontSize: "12px", color: "rgba(255,255,255,0.6)" }}>{g.label}</span>
                            <span style={{ fontSize: "13px", fontWeight: 800, color: g.color, marginLeft: "auto" }}>{g.value}%</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Age groups */}
                  <div style={{ flex: 1, minWidth: "200px", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: "14px", padding: "18px" }}>
                    <p style={{ fontSize: "11px", fontWeight: 700, color: "rgba(255,255,255,0.35)", textTransform: "uppercase", letterSpacing: "1px", marginBottom: "14px" }}>Age Groups</p>
                    {ageGroups.map(ag => (
                      <HBar key={ag.range} label={ag.range} value={ag.pct} max={Math.max(...ageGroups.map(a => a.pct), 1)} color="#a78bfa" />
                    ))}
                  </div>
                </div>

                {/* Audience details */}
                <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", marginBottom: "16px" }}>
                  {insights.audience?.audienceType && (
                    <InsightCard icon="🎯" label="Audience Type"      value={insights.audience.audienceType}   color="#a78bfa" />
                  )}
                  {insights.audience?.topLocations?.length > 0 && (
                    <InsightCard icon="📍" label="Top Locations"      value={insights.audience.topLocations.join(", ")} color="#63b3ed" sub="estimated top markets" />
                  )}
                </div>
                {insights.audience?.audienceInterests?.length > 0 && (
                  <div style={{ padding: "14px 16px", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: "12px", marginBottom: "12px" }}>
                    <p style={{ fontSize: "11px", fontWeight: 700, color: "rgba(255,255,255,0.35)", textTransform: "uppercase", letterSpacing: "1px", marginBottom: "10px" }}>Audience Interests</p>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                      {insights.audience.audienceInterests.map((int, i) => (
                        <span key={i} style={{ fontSize: "12px", background: "rgba(167,139,250,0.1)", border: "1px solid rgba(167,139,250,0.2)", color: "#c4b5fd", padding: "4px 12px", borderRadius: "20px" }}>{int}</span>
                      ))}
                    </div>
                  </div>
                )}
                {insights.audience?.audienceNote && (
                  <div style={{ padding: "12px 14px", background: "rgba(255,255,255,0.02)", borderRadius: "10px", fontSize: "12.5px", color: "rgba(255,255,255,0.45)", lineHeight: 1.6, fontStyle: "italic" }}>
                    💡 {insights.audience.audienceNote}
                  </div>
                )}
              </div>
            )}

            {/* ── CONTENT TAB ── */}
            {tab === "content" && insights.content && (
              <div style={{ animation: "fadeIn .3s ease" }}>
                <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", marginBottom: "16px" }}>
                  <InsightCard icon="📅" label="Posting Frequency" value={insights.content.postingFrequency ?? "—"} color="#ff8c42" />
                  <InsightCard icon="🏆" label="Best Post Type"    value={insights.content.bestPostType ?? "—"}      color="#ff3b5c" />
                  <InsightCard icon="🕐" label="Best Time to Post" value={insights.content.bestTimeToPost ?? "—"}    color="#00d4a0" />
                  <InsightCard icon="🎨" label="Tone & Style"      value={insights.content.toneAndStyle ?? "—"}      color="#a78bfa" />
                </div>

                {/* Themes */}
                {insights.content.contentThemes?.length > 0 && (
                  <div style={{ padding: "14px 16px", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: "12px", marginBottom: "12px" }}>
                    <p style={{ fontSize: "11px", fontWeight: 700, color: "rgba(255,255,255,0.35)", textTransform: "uppercase", letterSpacing: "1px", marginBottom: "10px" }}>Content Themes</p>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                      {insights.content.contentThemes.map((t, i) => (
                        <span key={i} style={{ fontSize: "12px", background: "rgba(255,140,66,0.1)", border: "1px solid rgba(255,140,66,0.2)", color: "#ff8c42", padding: "4px 12px", borderRadius: "20px" }}>{t}</span>
                      ))}
                    </div>
                  </div>
                )}

                <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
                  {/* Top hashtags used */}
                  {insights.content.topHashtags?.length > 0 && (
                    <div style={{ flex: 1, minWidth: "180px", padding: "14px 16px", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: "12px" }}>
                      <p style={{ fontSize: "11px", fontWeight: 700, color: "rgba(255,255,255,0.35)", textTransform: "uppercase", letterSpacing: "1px", marginBottom: "10px" }}>Hashtags Used</p>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: "5px" }}>
                        {insights.content.topHashtags.map((t, i) => (
                          <span key={i} style={{ fontSize: "11px", color: "#63b3ed", background: "rgba(99,179,237,0.08)", padding: "3px 10px", borderRadius: "20px", border: "1px solid rgba(99,179,237,0.18)" }}>{t}</span>
                        ))}
                      </div>
                    </div>
                  )}
                  {/* Recommended hashtags */}
                  {insights.content.recommendedHashtags?.length > 0 && (
                    <div style={{ flex: 1, minWidth: "180px", padding: "14px 16px", background: "rgba(52,211,153,0.04)", border: "1px solid rgba(52,211,153,0.15)", borderRadius: "12px" }}>
                      <p style={{ fontSize: "11px", fontWeight: 700, color: "rgba(52,211,153,0.7)", textTransform: "uppercase", letterSpacing: "1px", marginBottom: "10px" }}>✨ Recommended</p>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: "5px" }}>
                        {insights.content.recommendedHashtags.map((t, i) => (
                          <span key={i} style={{ fontSize: "11px", color: "#34d399", background: "rgba(52,211,153,0.08)", padding: "3px 10px", borderRadius: "20px", border: "1px solid rgba(52,211,153,0.2)" }}>{t}</span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Content gaps */}
                {insights.content.contentGaps?.length > 0 && (
                  <div style={{ marginTop: "12px", padding: "14px 16px", background: "rgba(255,59,92,0.04)", border: "1px solid rgba(255,59,92,0.15)", borderRadius: "12px" }}>
                    <p style={{ fontSize: "11px", fontWeight: 700, color: "rgba(255,59,92,0.7)", textTransform: "uppercase", letterSpacing: "1px", marginBottom: "10px" }}>⚡ Content Gaps & Opportunities</p>
                    <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                      {insights.content.contentGaps.map((gap, i) => (
                        <div key={i} style={{ fontSize: "12.5px", color: "rgba(255,255,255,0.55)", display: "flex", gap: "8px" }}>
                          <span style={{ color: "#ff3b5c", flexShrink: 0 }}>→</span> {gap}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ── ASK AI TAB ── */}
            {tab === "ask" && (
              <AskAnything profile={profile} posts={posts} insights={insights} username={username} />
            )}

          </div>
        );
      })()}

      {/* Empty state */}
      {!hasData && !loading && !error && (
        <div style={{ textAlign: "center", padding: "50px 20px" }}>
          <div style={{ fontSize: "40px", marginBottom: "12px" }}>🔬</div>
          <p style={{ fontSize: "15px", color: "rgba(255,255,255,0.4)", marginBottom: "5px" }}>Deep profile analysis</p>
          <p style={{ fontSize: "13px", color: "rgba(255,255,255,0.22)", marginBottom: "28px" }}>Search any brand, creator or public figure — get demographics, content strategy, brand score and more</p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", justifyContent: "center" }}>
            {["virat.kohli", "traya_health", "mamaearth", "nykaabeauty", "beerbiceps"].map(u => (
              <button key={u} onClick={() => { setInputVal(u); lookup(u); }} style={{
                padding: "7px 14px", borderRadius: "20px", fontSize: "12px", fontWeight: 600,
                cursor: "pointer", fontFamily: "inherit", transition: "all .15s",
                background: "rgba(167,139,250,0.08)", border: "1px solid rgba(167,139,250,0.2)", color: "rgba(255,255,255,0.4)",
              }}
                onMouseEnter={e => { e.currentTarget.style.color = "#a78bfa"; e.currentTarget.style.background = "rgba(167,139,250,0.15)"; }}
                onMouseLeave={e => { e.currentTarget.style.color = "rgba(255,255,255,0.4)"; e.currentTarget.style.background = "rgba(167,139,250,0.08)"; }}
              >@{u}</button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
