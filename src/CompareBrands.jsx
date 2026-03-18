import { useState, useCallback } from "react";
import BrandSearch from "./BrandSearch.jsx";
import { fmt, num, postStats, engRate, engRateNum } from "./stats.js";

// ── API ───────────────────────────────────────────────────────────

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

function engRateStr(followers, likes, comments) {
  const r = engRateNum(followers, likes, comments);
  return r === 0 ? "—" : r.toFixed(2) + "%";
}

// ── extractStats: uses median not mean to avoid celebrity-post skew ──

function extractStats(profile, posts) {
  const followers  = num(profile?.followersCount ?? profile?.follower_count);
  const following  = num(profile?.followsCount ?? profile?.following_count);
  const postsCount = num(profile?.postsCount ?? profile?.mediaCount);
  const videos     = posts.filter(p => p.videoPlayCount != null || p.videoViewCount != null || p.type === "Video");
  const allPosts   = videos.length > 0 ? videos : posts;
  const s          = postStats(allPosts);
  const topPost    = [...allPosts].sort((a, b) => num(b.videoPlayCount ?? b.videoViewCount) - num(a.videoPlayCount ?? a.videoViewCount))[0];
  const er         = engRateNum(followers, s.totalLikes, s.totalComments);
  return {
    followers, following, postsCount,
    totalViews:    s.totalViews,
    totalLikes:    s.totalLikes,
    totalComments: s.totalComments,
    medianViews:   s.medianViews,
    medianLikes:   s.medianLikes,
    medianComments:s.medianComments,
    meanViews:     s.meanViews,
    viewSkew:      s.viewSkew,
    avgViews:      s.medianViews, // keep compat alias → median
    avgLikes:      s.medianLikes,
    avgComments:   s.medianComments,
    topPost, er,
    postsAnalysed: allPosts.length,
  };
}

// ── Bar ───────────────────────────────────────────────────────────

function CompareBar({ values, colors, fmt: fmtFn = fmt, label }) {
  const nums = values.map(v => Number(v) || 0);
  const max  = Math.max(...nums, 1);
  return (
    <div style={{ marginBottom: "16px" }}>
      <div style={{ fontSize: "10px", color: "rgba(255,255,255,0.3)", textTransform: "uppercase", letterSpacing: "1px", fontWeight: 600, marginBottom: "8px" }}>{label}</div>
      {values.map((v, i) => {
        const pct = (num(v) / max) * 100;
        const isWinner = num(v) === max && max > 0;
        return (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "6px" }}>
            <div style={{ width: "100%", background: "rgba(255,255,255,0.05)", borderRadius: "6px", height: "28px", overflow: "hidden", position: "relative" }}>
              <div style={{
                height: "100%", borderRadius: "6px",
                width: `${Math.max(pct, 2)}%`,
                background: `linear-gradient(90deg, ${colors[i]}, ${colors[i]}99)`,
                transition: "width .8s cubic-bezier(.4,0,.2,1)",
                display: "flex", alignItems: "center", paddingLeft: "10px",
              }}>
                <span style={{ fontSize: "12px", fontWeight: 800, color: "#fff", whiteSpace: "nowrap" }}>{fmtFn(v)}</span>
              </div>
              {isWinner && <span style={{ position: "absolute", right: "8px", top: "50%", transform: "translateY(-50%)", fontSize: "12px" }}>🏆</span>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Mini reel list ────────────────────────────────────────────────

function MiniReelList({ posts, color }) {
  const videos = posts.filter(p => p.videoPlayCount != null || p.videoViewCount != null || p.type === "Video");
  const sorted = [...(videos.length > 0 ? videos : posts)]
    .sort((a, b) => num(b.videoPlayCount ?? b.videoViewCount) - num(a.videoPlayCount ?? a.videoViewCount))
    .slice(0, 5);

  if (sorted.length === 0) return <div style={{ fontSize: "12px", color: "rgba(255,255,255,0.2)", padding: "12px 0" }}>No video posts found</div>;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
      {sorted.map((p, i) => {
        const views   = num(p.videoPlayCount ?? p.videoViewCount);
        const likes   = num(p.likesCount);
        const caption = (p.caption ?? p.text ?? "").slice(0, 60);
        const url     = p.url ?? (p.shortCode ? `https://www.instagram.com/reel/${p.shortCode}/` : null);
        return (
          <div key={i} style={{ background: "rgba(255,255,255,0.03)", borderRadius: "10px", padding: "10px 12px", border: "1px solid rgba(255,255,255,0.06)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "8px" }}>
              <p style={{ margin: 0, fontSize: "11.5px", color: "rgba(255,255,255,0.45)", lineHeight: 1.4, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {caption || "(no caption)"}
              </p>
              <div style={{ textAlign: "right", flexShrink: 0 }}>
                <div style={{ fontSize: "13px", fontWeight: 800, color }}>{fmt(views)}</div>
                <div style={{ fontSize: "9px", color: "rgba(255,255,255,0.25)" }}>views</div>
              </div>
            </div>
            <div style={{ display: "flex", gap: "10px", marginTop: "5px", alignItems: "center" }}>
              <span style={{ fontSize: "10px", color: "rgba(255,255,255,0.3)" }}>❤️ {fmt(likes)}</span>
              {url && <a href={url} target="_blank" rel="noopener noreferrer" style={{ fontSize: "10px", color: "#63b3ed", textDecoration: "none", marginLeft: "auto" }}>↗ Open</a>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Shimmer ───────────────────────────────────────────────────────

function Shimmer({ message }) {
  return (
    <div>
      {message && (
        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "10px" }}>
          <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#ff3b5c", animation: "pulse 1s infinite" }} />
          <span style={{ fontSize: "12px", color: "rgba(255,255,255,0.35)" }}>{message}</span>
        </div>
      )}
      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        {[...Array(4)].map((_, i) => (
          <div key={i} style={{ height: "44px", borderRadius: "10px", background: "rgba(255,255,255,0.04)", position: "relative", overflow: "hidden" }}>
            <div style={{ position: "absolute", inset: 0, background: "linear-gradient(90deg,transparent,rgba(255,255,255,0.07),transparent)", animation: "sweep 1.5s ease infinite", animationDelay: `${i * 0.1}s` }} />
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Brand slot ───────────────────────────────────────────────────

const SLOT_COLORS = ["#ff3b5c", "#63b3ed", "#a78bfa", "#34d399"];
const PRESETS     = ["traya_health", "mamaearth", "nykaabeauty", "myglamm", "mcaffeine", "plumgoodness", "beardo_official", "thewholesome_co"];

function BrandSlot({ index, color, brand, onAdd, onRemove }) {
  const [mode,  setMode]  = useState("keyword"); // "keyword" | "exact"
  const [input, setInput] = useState("");

  if (brand) {
    return (
      <div style={{
        flex: 1, minWidth: "160px",
        background: `${color}10`,
        border: `1px solid ${color}33`,
        borderRadius: "14px", padding: "14px 16px",
        position: "relative",
      }}>
        <button
          onClick={() => onRemove(index)}
          style={{ position: "absolute", top: "10px", right: "10px", background: "rgba(255,255,255,0.06)", border: "none", color: "rgba(255,255,255,0.4)", borderRadius: "50%", width: "22px", height: "22px", cursor: "pointer", fontSize: "12px", display: "flex", alignItems: "center", justifyContent: "center" }}
        >✕</button>

        {brand.loading ? (
          <div style={{ paddingTop: "4px" }}>
            <div style={{ width: 7, height: 7, borderRadius: "50%", background: color, animation: "pulse 1s infinite", marginBottom: "8px" }} />
            <div style={{ fontSize: "12px", color: "rgba(255,255,255,0.4)" }}>Loading @{brand.username}…</div>
          </div>
        ) : brand.error ? (
          <div>
            <div style={{ fontSize: "12px", color: color, fontWeight: 700, marginBottom: "4px" }}>@{brand.username}</div>
            <div style={{ fontSize: "11px", color: "#ff8080" }}>⚠️ {brand.error}</div>
          </div>
        ) : (
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" }}>
              {brand.profile?.profilePicUrl && (
                <img src={brand.profile.profilePicUrl} alt="" style={{ width: "32px", height: "32px", borderRadius: "50%", objectFit: "cover" }} onError={e => e.target.style.display = "none"} />
              )}
              <div>
                <div style={{ fontSize: "13px", fontWeight: 800, color: "#fff", letterSpacing: "-0.3px" }}>{brand.profile?.fullName ?? brand.username}</div>
                <div style={{ fontSize: "10px", color: "rgba(255,255,255,0.35)" }}>@{brand.username}</div>
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px", marginTop: "8px" }}>
              {[
                { label: "Followers", value: fmt(brand.stats?.followers) },
                { label: "Median Views", value: fmt(brand.stats?.avgViews) },
                { label: "Eng. Rate", value: brand.stats ? engRateStr(brand.stats.followers, brand.stats.totalLikes, brand.stats.totalComments) : "—" },
                { label: "Posts", value: fmt(brand.stats?.postsCount) },
              ].map(s => (
                <div key={s.label} style={{ background: "rgba(255,255,255,0.04)", borderRadius: "8px", padding: "7px 10px" }}>
                  <div style={{ fontSize: "9px", color: "rgba(255,255,255,0.3)", textTransform: "uppercase", letterSpacing: "0.8px", marginBottom: "2px" }}>{s.label}</div>
                  <div style={{ fontSize: "13px", fontWeight: 800, color }}>{s.value}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div style={{
      flex: 1, minWidth: "220px",
      background: "rgba(255,255,255,0.025)",
      border: `1px dashed ${color}44`,
      borderRadius: "14px", padding: "14px 16px",
      display: "flex", flexDirection: "column", gap: "10px",
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.3)", fontWeight: 600 }}>Brand {index + 1}</div>
        <div style={{ display: "flex", background: "rgba(255,255,255,0.04)", borderRadius: "6px", padding: "2px", gap: "2px" }}>
          {[{ id: "keyword", label: "🔍" }, { id: "exact", label: "@" }].map(m => (
            <button key={m.id} onClick={() => setMode(m.id)} style={{
              padding: "3px 8px", borderRadius: "4px", fontSize: "11px", fontWeight: 600,
              cursor: "pointer", fontFamily: "inherit", border: "none",
              background: mode === m.id ? `${color}25` : "transparent",
              color: mode === m.id ? color : "rgba(255,255,255,0.3)",
            }}>{m.label}</button>
          ))}
        </div>
      </div>

      {mode === "keyword" ? (
        <BrandSearch
          onSelect={(username) => onAdd(index, username)}
          color={color}
          placeholder='e.g. "hair care india"…'
          selectedUsernames={[]}
        />
      ) : (
        <div style={{ display: "flex", gap: "6px" }}>
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === "Enter" && input.trim() && onAdd(index, input.trim().replace(/^@/, ""))}
            placeholder="@username"
            style={{
              flex: 1, background: "rgba(255,255,255,0.05)", border: `1px solid ${color}33`,
              borderRadius: "8px", padding: "7px 10px", color: "#fff", fontSize: "12px",
              fontFamily: "inherit",
            }}
          />
          <button
            onClick={() => input.trim() && onAdd(index, input.trim().replace(/^@/, ""))}
            disabled={!input.trim()}
            style={{
              padding: "7px 12px", borderRadius: "8px", fontSize: "12px", fontWeight: 700,
              cursor: input.trim() ? "pointer" : "not-allowed", fontFamily: "inherit",
              background: `${color}20`, border: `1px solid ${color}44`, color,
            }}
          >+</button>
        </div>
      )}

      {/* Quick presets */}
      <div>
        <div style={{ fontSize: "9px", color: "rgba(255,255,255,0.2)", textTransform: "uppercase", letterSpacing: "1px", marginBottom: "5px" }}>Quick add</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "4px" }}>
          {PRESETS.slice(0, 4).map(p => (
            <button key={p} onClick={() => onAdd(index, p)} style={{
              fontSize: "10px", padding: "3px 8px", borderRadius: "20px", cursor: "pointer",
              background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
              color: "rgba(255,255,255,0.35)", fontFamily: "inherit",
            }}
              onMouseEnter={e => { e.currentTarget.style.color = color; e.currentTarget.style.borderColor = `${color}44`; }}
              onMouseLeave={e => { e.currentTarget.style.color = "rgba(255,255,255,0.35)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)"; }}
            >{p.replace(/_/g, " ")}</button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Main CompareBrands ────────────────────────────────────────────

const METRIC_TABS = [
  { id: "overview",  label: "📊 Overview" },
  { id: "reels",     label: "🎬 Top Reels" },
  { id: "engagement",label: "💡 Engagement" },
];

export default function CompareBrands() {
  const [brands, setBrands]   = useState([null, null, null]);
  const [metricTab, setMetricTab] = useState("overview");

  const loadedBrands = brands.filter(Boolean);
  const readyBrands  = loadedBrands.filter(b => !b.loading && !b.error && b.stats);

  // ── Add a brand slot ──────────────────────────────────────────

  const addBrand = useCallback(async (slotIndex, username) => {
    // Mark slot as loading
    setBrands(prev => {
      const next = [...prev];
      next[slotIndex] = { username, loading: true, error: null, profile: null, posts: [], stats: null };
      return next;
    });

    try {
      // Fetch profile + posts in parallel
      const [profileData, postsData] = await Promise.all([
        apifyRun("apify~instagram-profile-scraper", { usernames: [username] }),
        apifyRun("apify~instagram-scraper", {
          directUrls: [`https://www.instagram.com/${username}/`],
          resultsType: "posts",
          resultsLimit: 20,
        }),
      ]);

      const profile = profileData?.[0] ?? null;
      if (!profile) throw new Error("Account not found or private");

      const posts = Array.isArray(postsData) ? postsData : [];
      const stats = extractStats(profile, posts);

      setBrands(prev => {
        const next = [...prev];
        next[slotIndex] = { username, loading: false, error: null, profile, posts, stats };
        return next;
      });
    } catch (err) {
      setBrands(prev => {
        const next = [...prev];
        next[slotIndex] = { username, loading: false, error: err.message, profile: null, posts: [], stats: null };
        return next;
      });
    }
  }, []);

  const removeBrand = useCallback((slotIndex) => {
    setBrands(prev => {
      const next = [...prev];
      next[slotIndex] = null;
      return next;
    });
  }, []);

  // ── Derived comparison data ───────────────────────────────────

  const colors        = readyBrands.map((_, i) => SLOT_COLORS[brands.findIndex(b => b === readyBrands[i]) % SLOT_COLORS.length]);
  const followerVals  = readyBrands.map(b => b.stats.followers);
  const avgViewVals   = readyBrands.map(b => b.stats.avgViews);
  const avgLikeVals   = readyBrands.map(b => b.stats.avgLikes);
  const erVals        = readyBrands.map(b => b.stats.er);
  const totalViewVals = readyBrands.map(b => b.stats.totalViews);
  const postCountVals = readyBrands.map(b => b.stats.postsCount);

  // Winner logic
  function winner(vals) {
    const max = Math.max(...vals);
    const idx = vals.indexOf(max);
    return readyBrands[idx]?.username ?? "—";
  }

  return (
    <div style={{ animation: "fadeIn .3s ease" }}>

      {/* ── Brand slots ── */}
      <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", marginBottom: "24px" }}>
        {brands.map((brand, i) => (
          <BrandSlot
            key={i}
            index={i}
            color={SLOT_COLORS[i]}
            brand={brand}
            onAdd={addBrand}
            onRemove={removeBrand}
          />
        ))}
      </div>

      {/* ── Loading states ── */}
      {loadedBrands.some(b => b?.loading) && (
        <div style={{ marginBottom: "20px" }}>
          <Shimmer message={`Fetching data for ${loadedBrands.filter(b => b?.loading).map(b => "@" + b.username).join(", ")}… this takes ~30s`} />
        </div>
      )}

      {/* ── Comparison panel (only when 2+ ready) ── */}
      {readyBrands.length >= 2 && (
        <div style={{ animation: "fadeIn .4s ease" }}>

          {/* Legend */}
          <div style={{ display: "flex", gap: "16px", flexWrap: "wrap", marginBottom: "20px", padding: "12px 16px", background: "rgba(255,255,255,0.03)", borderRadius: "12px", border: "1px solid rgba(255,255,255,0.06)" }}>
            {readyBrands.map((b, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: "7px" }}>
                <div style={{ width: 10, height: 10, borderRadius: "50%", background: colors[i], flexShrink: 0 }} />
                <span style={{ fontSize: "12px", fontWeight: 600, color: "#fff" }}>@{b.username}</span>
              </div>
            ))}
          </div>

          {/* Metric tabs */}
          <div style={{ display: "flex", gap: "6px", marginBottom: "20px" }}>
            {METRIC_TABS.map(t => (
              <button key={t.id} onClick={() => setMetricTab(t.id)} style={{
                padding: "8px 15px", borderRadius: "10px", fontSize: "12.5px",
                fontWeight: metricTab === t.id ? 700 : 500, cursor: "pointer",
                fontFamily: "inherit", transition: "all .15s",
                background: metricTab === t.id ? "rgba(255,59,92,0.12)" : "rgba(255,255,255,0.04)",
                border: `1px solid ${metricTab === t.id ? "rgba(255,59,92,0.3)" : "rgba(255,255,255,0.07)"}`,
                color: metricTab === t.id ? "#fff" : "rgba(255,255,255,0.38)",
              }}>{t.label}</button>
            ))}
          </div>

          {/* ── OVERVIEW TAB ── */}
          {metricTab === "overview" && (
            <div style={{ animation: "fadeIn .3s ease" }}>

              {/* Winner summary cards */}
              <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", marginBottom: "24px" }}>
                {[
                  { label: "Most Followers",    val: followerVals,  icon: "👥" },
                  { label: "Highest Median Views", val: avgViewVals,   icon: "👁️" },
                  { label: "Best Eng. Rate",    val: erVals,        icon: "💬" },
                  { label: "Most Posts",        val: postCountVals, icon: "📸" },
                ].map(({ label, val, icon }) => {
                  const w = winner(val);
                  const wi = readyBrands.findIndex(b => b.username === w);
                  return (
                    <div key={label} style={{
                      flex: 1, minWidth: "130px",
                      background: `${colors[wi]}10`, border: `1px solid ${colors[wi]}30`,
                      borderRadius: "12px", padding: "12px 14px",
                    }}>
                      <div style={{ fontSize: "18px", marginBottom: "5px" }}>{icon}</div>
                      <div style={{ fontSize: "10px", color: "rgba(255,255,255,0.35)", textTransform: "uppercase", letterSpacing: "1px", marginBottom: "4px" }}>{label}</div>
                      <div style={{ fontSize: "13px", fontWeight: 800, color: colors[wi] }}>@{w}</div>
                    </div>
                  );
                })}
              </div>

              {/* Bar charts */}
              <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: "16px", padding: "20px" }}>
                <CompareBar label="Followers"           values={followerVals}  colors={colors} />
                <CompareBar label="Avg Reel Views"      values={avgViewVals}   colors={colors} />
                <CompareBar label="Total Views (last 20 posts)" values={totalViewVals} colors={colors} />
                <CompareBar label="Avg Likes / Post"    values={avgLikeVals}   colors={colors} />
                <CompareBar label="Total Posts"         values={postCountVals} colors={colors} />
                <CompareBar
                  label="Engagement Rate (%)"
                  values={erVals}
                  colors={colors}
                  fmt={v => v ? v.toFixed(2) + "%" : "—"}
                />
              </div>

              {/* Data table */}
              <div style={{ marginTop: "20px", overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12.5px" }}>
                  <thead>
                    <tr>
                      <th style={{ textAlign: "left", padding: "10px 12px", color: "rgba(255,255,255,0.3)", fontWeight: 600, fontSize: "10px", textTransform: "uppercase", letterSpacing: "1px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>Metric</th>
                      {readyBrands.map((b, i) => (
                        <th key={i} style={{ textAlign: "right", padding: "10px 12px", color: colors[i], fontWeight: 700, borderBottom: "1px solid rgba(255,255,255,0.06)" }}>@{b.username}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { label: "Followers",          vals: followerVals.map(fmt) },
                      { label: "Following",          vals: readyBrands.map(b => fmt(b.stats.following)) },
                      { label: "Total Posts",        vals: postCountVals.map(fmt) },
                      { label: "Posts Analysed",     vals: readyBrands.map(b => b.stats.postsAnalysed) },
                      { label: "Total Reel Views",   vals: totalViewVals.map(fmt) },
                      { label: "Median Views / Post",   vals: avgViewVals.map(fmt) },
                      { label: "Median Likes / Post",   vals: avgLikeVals.map(fmt) },
                      { label: "Median Comments / Post",vals: readyBrands.map(b => fmt(b.stats.avgComments)) },
                      { label: "Engagement Rate",    vals: readyBrands.map(b => engRateStr(b.stats.followers, b.stats.totalLikes, b.stats.totalComments)) },
                    ].map((row, ri) => {
                      // Highlight winner cell
                      const numVals = row.vals.map(v => parseFloat(String(v).replace(/[^0-9.]/g, "")) || 0);
                      const maxVal  = Math.max(...numVals);
                      return (
                        <tr key={ri} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                          <td style={{ padding: "10px 12px", color: "rgba(255,255,255,0.45)", fontWeight: 500 }}>{row.label}</td>
                          {row.vals.map((v, ci) => {
                            const isTop = parseFloat(String(v).replace(/[^0-9.]/g, "")) === maxVal && maxVal > 0;
                            return (
                              <td key={ci} style={{ padding: "10px 12px", textAlign: "right", fontWeight: isTop ? 800 : 500, color: isTop ? colors[ci] : "rgba(255,255,255,0.7)" }}>
                                {v}{isTop ? " 🏆" : ""}
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── TOP REELS TAB ── */}
          {metricTab === "reels" && (
            <div style={{ animation: "fadeIn .3s ease" }}>
              <div style={{ display: "flex", gap: "14px", flexWrap: "wrap" }}>
                {readyBrands.map((b, i) => (
                  <div key={i} style={{ flex: 1, minWidth: "260px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px", paddingBottom: "10px", borderBottom: `2px solid ${colors[i]}44` }}>
                      <div style={{ width: 8, height: 8, borderRadius: "50%", background: colors[i] }} />
                      <span style={{ fontSize: "14px", fontWeight: 800, color: colors[i] }}>@{b.username}</span>
                      <span style={{ fontSize: "11px", color: "rgba(255,255,255,0.3)", marginLeft: "auto" }}>{fmt(b.stats.totalViews)} total views</span>
                    </div>
                    <MiniReelList posts={b.posts} color={colors[i]} />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── ENGAGEMENT TAB ── */}
          {metricTab === "engagement" && (
            <div style={{ animation: "fadeIn .3s ease" }}>

              {/* Engagement summary per brand */}
              <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", marginBottom: "24px" }}>
                {readyBrands.map((b, i) => {
                  const er = engRateStr(b.stats.followers, b.stats.totalLikes, b.stats.totalComments);
                  const erNum = parseFloat(er) || 0;
                  const erColor = erNum > 3 ? "#34d399" : erNum > 1 ? "#ff8c42" : "#ff3b5c";
                  return (
                    <div key={i} style={{
                      flex: 1, minWidth: "160px",
                      background: `${colors[i]}08`, border: `1px solid ${colors[i]}25`,
                      borderRadius: "14px", padding: "16px",
                    }}>
                      <div style={{ fontSize: "12px", fontWeight: 700, color: colors[i], marginBottom: "12px" }}>@{b.username}</div>
                      <div style={{ fontSize: "32px", fontWeight: 800, color: erColor, letterSpacing: "-1px", marginBottom: "4px" }}>{er}</div>
                      <div style={{ fontSize: "10px", color: "rgba(255,255,255,0.3)", marginBottom: "14px" }}>engagement rate</div>
                      <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                        {[
                          { label: "Median Likes",    val: fmt(b.stats.avgLikes) },
                          { label: "Median Comments", val: fmt(b.stats.avgComments) },
                          { label: "Median Views",    val: fmt(b.stats.avgViews) },
                        ].map(s => (
                          <div key={s.label} style={{ display: "flex", justifyContent: "space-between", fontSize: "12px" }}>
                            <span style={{ color: "rgba(255,255,255,0.35)" }}>{s.label}</span>
                            <span style={{ fontWeight: 700, color: "#fff" }}>{s.val}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Engagement bar charts */}
              <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: "16px", padding: "20px" }}>
                <CompareBar label="Engagement Rate (%)" values={erVals}      colors={colors} fmt={v => v ? v.toFixed(2) + "%" : "—"} />
                <CompareBar label="Avg Likes / Post"     values={avgLikeVals} colors={colors} />
                <CompareBar label="Avg Comments / Post"  values={readyBrands.map(b => b.stats.avgComments)} colors={colors} />
                <CompareBar label="Avg Views / Reel"     values={avgViewVals} colors={colors} />
              </div>

              {/* Engagement insight */}
              <div style={{ marginTop: "16px", padding: "14px 16px", background: "rgba(99,179,237,0.06)", border: "1px solid rgba(99,179,237,0.15)", borderRadius: "12px" }}>
                <p style={{ fontSize: "11px", color: "#63b3ed", fontWeight: 700, textTransform: "uppercase", letterSpacing: "1px", marginBottom: "6px" }}>💡 What this means</p>
                <p style={{ fontSize: "12.5px", color: "rgba(255,255,255,0.5)", lineHeight: 1.6, margin: 0 }}>
                  Engagement rate = (likes + comments) ÷ followers × 100. A rate above <strong style={{ color: "#34d399" }}>3%</strong> is excellent for Instagram. Between <strong style={{ color: "#ff8c42" }}>1–3%</strong> is average. Below <strong style={{ color: "#ff3b5c" }}>1%</strong> suggests the audience is passive or the content isn't resonating.
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Prompt to add more */}
      {readyBrands.length === 1 && !loadedBrands.some(b => b?.loading) && (
        <div style={{ textAlign: "center", padding: "20px", color: "rgba(255,255,255,0.25)", fontSize: "13px" }}>
          Add at least one more brand to start comparing ↑
        </div>
      )}

      {/* Empty state */}
      {loadedBrands.length === 0 && (
        <div style={{ textAlign: "center", padding: "40px 20px" }}>
          <div style={{ fontSize: "36px", marginBottom: "10px" }}>⚡</div>
          <p style={{ fontSize: "14px", color: "rgba(255,255,255,0.4)", marginBottom: "5px" }}>Compare up to 3 brands side by side</p>
          <p style={{ fontSize: "12px", color: "rgba(255,255,255,0.2)" }}>Followers, Reel views, engagement rate, top content — all in one view</p>
        </div>
      )}
    </div>
  );
}
