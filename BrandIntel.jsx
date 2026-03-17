import { useState, useCallback } from "react";

// ── Helpers ──────────────────────────────────────────────────────

function fmt(n) {
  if (n == null || isNaN(n)) return "—";
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "K";
  return String(n);
}

function engRate(followers, likes, comments) {
  if (!followers || followers === 0) return "—";
  return (((likes + comments) / followers) * 100).toFixed(2) + "%";
}

async function fetchInstagram(endpoint, params = {}) {
  const qs = new URLSearchParams({ endpoint, ...params }).toString();
  const res = await fetch(`/api/instagram?${qs}`);
  if (!res.ok) throw new Error(`API ${res.status}: ${await res.text()}`);
  const data = await res.json();
  if (data.detail) throw new Error(data.detail); // EnsembleData error format
  return data;
}

// ── Sub-components ───────────────────────────────────────────────

function StatBox({ label, value, sub, color = "#fff" }) {
  return (
    <div style={{
      background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
      borderRadius: "12px", padding: "14px 16px", flex: 1, minWidth: "110px",
    }}>
      <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.35)", marginBottom: "6px", textTransform: "uppercase", letterSpacing: "1px", fontWeight: 600 }}>{label}</div>
      <div style={{ fontSize: "20px", fontWeight: 800, color, letterSpacing: "-0.5px" }}>{value}</div>
      {sub && <div style={{ fontSize: "10px", color: "rgba(255,255,255,0.25)", marginTop: "3px" }}>{sub}</div>}
    </div>
  );
}

function ReelCard({ reel, index }) {
  const [open, setOpen] = useState(false);
  const views = reel.play_count ?? reel.view_count ?? reel.video_view_count ?? 0;
  const likes = reel.like_count ?? 0;
  const comments = reel.comment_count ?? 0;
  const caption = reel.caption?.text ?? reel.caption ?? "";
  const date = reel.taken_at
    ? new Date(reel.taken_at * 1000).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
    : "—";
  const thumbUrl = reel.thumbnail_url ?? reel.image_versions?.candidates?.[0]?.url ?? null;

  return (
    <div
      onClick={() => setOpen(o => !o)}
      style={{
        background: "rgba(255,255,255,0.035)", border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: "14px", padding: "14px 16px", cursor: "pointer",
        transition: "all .18s", position: "relative", overflow: "hidden",
      }}
      onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.06)"; e.currentTarget.style.borderColor = "rgba(255,59,92,.25)"; }}
      onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.035)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)"; }}
    >
      <div style={{ position: "absolute", top: 0, left: 0, height: "2px", width: `${Math.min(views / 50000, 100)}%`, background: "linear-gradient(90deg,#ff3b5c,transparent)" }} />

      <div style={{ display: "flex", gap: "12px", alignItems: "flex-start" }}>
        {/* Thumbnail */}
        <div style={{ width: "48px", height: "48px", borderRadius: "8px", background: "rgba(255,255,255,0.06)", flexShrink: 0, overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center" }}>
          {thumbUrl
            ? <img src={thumbUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} onError={e => { e.target.style.display = "none"; }} />
            : <span style={{ fontSize: "18px" }}>🎬</span>
          }
        </div>

        {/* Content */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "5px", flexWrap: "wrap" }}>
            <span style={{ fontSize: "11px", color: "rgba(255,255,255,0.25)" }}>#{index + 1}</span>
            <span style={{ fontSize: "11px", color: "rgba(255,255,255,0.3)" }}>{date}</span>
          </div>
          <p style={{ margin: 0, fontSize: "12px", color: "rgba(255,255,255,0.5)", lineHeight: 1.4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: open ? "normal" : "nowrap" }}>
            {caption || "(no caption)"}
          </p>
        </div>

        {/* Stats */}
        <div style={{ textAlign: "right", flexShrink: 0 }}>
          <div style={{ fontSize: "15px", fontWeight: 800, color: "#ff3b5c" }}>{fmt(views)}</div>
          <div style={{ fontSize: "10px", color: "rgba(255,255,255,0.28)" }}>views</div>
        </div>
      </div>

      {open && (
        <div style={{ marginTop: "12px", paddingTop: "12px", borderTop: "1px solid rgba(255,255,255,0.06)", display: "flex", gap: "10px", flexWrap: "wrap" }}>
          <div style={{ fontSize: "12px", color: "rgba(255,255,255,0.45)" }}>❤️ <strong style={{ color: "#fff" }}>{fmt(likes)}</strong> likes</div>
          <div style={{ fontSize: "12px", color: "rgba(255,255,255,0.45)" }}>💬 <strong style={{ color: "#fff" }}>{fmt(comments)}</strong> comments</div>
          {reel.code && (
            <a href={`https://instagram.com/reel/${reel.code}`} target="_blank" rel="noopener noreferrer"
              onClick={e => e.stopPropagation()}
              style={{ fontSize: "12px", color: "#63b3ed", textDecoration: "none" }}>
              ↗ View on Instagram
            </a>
          )}
        </div>
      )}
    </div>
  );
}

function Shimmer({ count = 4 }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
      {[...Array(count)].map((_, i) => (
        <div key={i} style={{ height: "80px", borderRadius: "14px", background: "rgba(255,255,255,0.04)", position: "relative", overflow: "hidden" }}>
          <div style={{ position: "absolute", inset: 0, background: "linear-gradient(90deg,transparent,rgba(255,255,255,0.07),transparent)", animation: "sweep 1.5s ease infinite", animationDelay: `${i * 0.12}s` }} />
        </div>
      ))}
    </div>
  );
}

// ── Main BrandIntel Component ────────────────────────────────────

const TABS = [
  { id: "profile",  label: "👤 Profile" },
  { id: "reels",    label: "🎬 Reels" },
  { id: "hashtag",  label: "#  Hashtag" },
];

export default function BrandIntel() {
  const [username, setUsername]     = useState("");
  const [hashtag,  setHashtag]      = useState("");
  const [input,    setInput]        = useState("");
  const [hashInput, setHashInput]   = useState("");
  const [tab,      setTab]          = useState("profile");

  const [profile,  setProfile]  = useState(null);
  const [reels,    setReels]    = useState([]);
  const [hashData, setHashData] = useState(null);

  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState(null);
  const [reelSort, setReelSort] = useState("views");

  // ── Fetch profile + reels ──────────────────────────────────────

  const lookupBrand = useCallback(async (u) => {
    if (!u.trim()) return;
    const handle = u.trim().replace(/^@/, "");
    setUsername(handle);
    setLoading(true);
    setError(null);
    setProfile(null);
    setReels([]);

    try {
      // 1. Get user info
      const info = await fetchInstagram("/instagram/user/info", { username: handle });
      const user = info.data ?? info;
      setProfile(user);

      // 2. Get user ID for reels
      const userId = user.id ?? user.pk ?? user.user_id;
      if (userId) {
        try {
          const reelsData = await fetchInstagram("/instagram/user/reels", { user_id: String(userId), depth: "1" });
          const list = reelsData.data ?? reelsData.reels ?? reelsData ?? [];
          setReels(Array.isArray(list) ? list : []);
        } catch {
          // reels optional — don't fail whole lookup
        }
      }
      setTab("profile");
    } catch (err) {
      setError(err.message || "Could not find that account. Check the username and try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  // ── Fetch hashtag ──────────────────────────────────────────────

  const lookupHashtag = useCallback(async (h) => {
    if (!h.trim()) return;
    const tag = h.trim().replace(/^#/, "");
    setHashtag(tag);
    setLoading(true);
    setError(null);
    setHashData(null);

    try {
      const data = await fetchInstagram("/instagram/hashtag/search", { hashtag: tag });
      setHashData(data.data ?? data);
      setTab("hashtag");
    } catch (err) {
      setError(err.message || "Could not fetch hashtag data.");
    } finally {
      setLoading(false);
    }
  }, []);

  // ── Derived data ──────────────────────────────────────────────

  const sortedReels = [...reels].sort((a, b) => {
    if (reelSort === "views") return ((b.play_count ?? b.view_count ?? 0) - (a.play_count ?? a.view_count ?? 0));
    if (reelSort === "likes") return ((b.like_count ?? 0) - (a.like_count ?? 0));
    if (reelSort === "comments") return ((b.comment_count ?? 0) - (a.comment_count ?? 0));
    if (reelSort === "date") return ((b.taken_at ?? 0) - (a.taken_at ?? 0));
    return 0;
  });

  const totalViews   = reels.reduce((s, r) => s + (r.play_count ?? r.view_count ?? 0), 0);
  const avgViews     = reels.length ? Math.round(totalViews / reels.length) : 0;
  const totalLikes   = reels.reduce((s, r) => s + (r.like_count ?? 0), 0);
  const avgLikes     = reels.length ? Math.round(totalLikes / reels.length) : 0;
  const followers    = profile?.follower_count ?? profile?.followers ?? 0;

  return (
    <div style={{ animation: "fadeIn .3s ease" }}>

      {/* ── Search bars ── */}
      <div style={{ display: "flex", gap: "10px", marginBottom: "20px", flexWrap: "wrap" }}>

        {/* Username search */}
        <div style={{ flex: 2, minWidth: "220px", display: "flex", gap: "8px" }}>
          <div style={{
            flex: 1, display: "flex", alignItems: "center", gap: "8px",
            background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: "10px", padding: "10px 14px",
          }}>
            <span style={{ opacity: 0.4 }}>👤</span>
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && lookupBrand(input)}
              placeholder="Brand username e.g. traya_health"
              style={{ flex: 1, background: "none", border: "none", color: "#fff", fontSize: "13px", fontFamily: "inherit" }}
            />
          </div>
          <button onClick={() => lookupBrand(input)} disabled={loading || !input.trim()} style={{
            padding: "10px 16px", borderRadius: "10px", fontSize: "12px", fontWeight: 700,
            cursor: loading || !input.trim() ? "not-allowed" : "pointer", fontFamily: "inherit",
            background: "rgba(255,59,92,0.15)", border: "1px solid rgba(255,59,92,0.3)",
            color: input.trim() ? "#ff3b5c" : "rgba(255,255,255,0.2)", whiteSpace: "nowrap",
          }}>Look up</button>
        </div>

        {/* Hashtag search */}
        <div style={{ flex: 1, minWidth: "180px", display: "flex", gap: "8px" }}>
          <div style={{
            flex: 1, display: "flex", alignItems: "center", gap: "8px",
            background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: "10px", padding: "10px 14px",
          }}>
            <span style={{ opacity: 0.4, fontWeight: 700 }}>#</span>
            <input
              value={hashInput}
              onChange={e => setHashInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && lookupHashtag(hashInput)}
              placeholder="hairfall, skincare…"
              style={{ flex: 1, background: "none", border: "none", color: "#fff", fontSize: "13px", fontFamily: "inherit" }}
            />
          </div>
          <button onClick={() => lookupHashtag(hashInput)} disabled={loading || !hashInput.trim()} style={{
            padding: "10px 16px", borderRadius: "10px", fontSize: "12px", fontWeight: 700,
            cursor: loading || !hashInput.trim() ? "not-allowed" : "pointer", fontFamily: "inherit",
            background: "rgba(99,179,237,0.12)", border: "1px solid rgba(99,179,237,0.3)",
            color: hashInput.trim() ? "#63b3ed" : "rgba(255,255,255,0.2)", whiteSpace: "nowrap",
          }}>Search</button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div style={{ padding: "12px 15px", background: "rgba(255,59,92,0.08)", border: "1px solid rgba(255,59,92,0.2)", borderRadius: "10px", color: "#ff8080", fontSize: "13px", marginBottom: "16px" }}>
          ⚠️ {error}
        </div>
      )}

      {/* Loading */}
      {loading && <Shimmer count={5} />}

      {/* ── Results ── */}
      {!loading && (profile || hashData) && (

        <div>
          {/* Tabs */}
          <div style={{ display: "flex", gap: "6px", marginBottom: "16px" }}>
            {TABS.filter(t => t.id !== "hashtag" || hashData).map(t => (
              <button key={t.id} onClick={() => setTab(t.id)} style={{
                padding: "8px 14px", borderRadius: "10px", fontSize: "12.5px",
                fontWeight: tab === t.id ? 700 : 500, cursor: "pointer",
                fontFamily: "inherit", transition: "all .15s",
                background: tab === t.id ? "rgba(255,59,92,0.12)" : "rgba(255,255,255,0.04)",
                border: `1px solid ${tab === t.id ? "rgba(255,59,92,0.3)" : "rgba(255,255,255,0.07)"}`,
                color: tab === t.id ? "#fff" : "rgba(255,255,255,0.38)",
              }}>{t.label}</button>
            ))}
          </div>

          {/* ── PROFILE TAB ── */}
          {tab === "profile" && profile && (() => {
            const name     = profile.full_name ?? profile.name ?? username;
            const bio      = profile.biography ?? profile.bio ?? "";
            const posts    = profile.media_count ?? profile.posts ?? 0;
            const following = profile.following_count ?? profile.following ?? 0;
            const isVerified = profile.is_verified ?? false;
            const avatarUrl  = profile.profile_pic_url ?? profile.avatar ?? null;
            const category   = profile.category ?? profile.account_type ?? "";

            return (
              <div style={{ animation: "fadeIn .3s ease" }}>
                {/* Profile header */}
                <div style={{ display: "flex", gap: "16px", alignItems: "flex-start", marginBottom: "20px", padding: "18px", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: "16px" }}>
                  <div style={{ width: "64px", height: "64px", borderRadius: "50%", background: "rgba(255,255,255,0.08)", flexShrink: 0, overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "26px" }}>
                    {avatarUrl
                      ? <img src={avatarUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} onError={e => { e.target.style.display = "none"; e.target.parentNode.innerHTML = "👤"; }} />
                      : "👤"
                    }
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "3px", flexWrap: "wrap" }}>
                      <span style={{ fontSize: "17px", fontWeight: 800, color: "#fff" }}>{name}</span>
                      {isVerified && <span style={{ fontSize: "14px" }} title="Verified">✅</span>}
                      {category && <span style={{ fontSize: "11px", color: "rgba(255,255,255,0.35)", background: "rgba(255,255,255,0.06)", padding: "2px 8px", borderRadius: "20px" }}>{category}</span>}
                    </div>
                    <div style={{ fontSize: "12px", color: "rgba(255,255,255,0.4)", marginBottom: "6px" }}>@{username}</div>
                    {bio && <p style={{ fontSize: "12.5px", color: "rgba(255,255,255,0.5)", lineHeight: 1.5, margin: 0 }}>{bio}</p>}
                  </div>
                </div>

                {/* Stats row */}
                <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", marginBottom: "20px" }}>
                  <StatBox label="Followers"   value={fmt(followers)}   color="#ff3b5c" />
                  <StatBox label="Following"   value={fmt(following)}   color="#fff" />
                  <StatBox label="Posts"       value={fmt(posts)}       color="#fff" />
                  {reels.length > 0 && <>
                    <StatBox label="Total Reel Views" value={fmt(totalViews)} color="#ff8c42" sub={`${reels.length} reels analysed`} />
                    <StatBox label="Avg Views/Reel"   value={fmt(avgViews)}   color="#ff8c42" />
                    <StatBox label="Avg Likes/Reel"   value={fmt(avgLikes)}   color="#00d4a0"
                      sub={`${engRate(followers, totalLikes, reels.reduce((s,r)=>s+(r.comment_count??0),0))} eng. rate`} />
                  </>}
                </div>

                {/* Top reels preview */}
                {reels.length > 0 && (
                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
                      <p style={{ fontSize: "12px", fontWeight: 700, color: "rgba(255,255,255,0.5)", textTransform: "uppercase", letterSpacing: "1px" }}>Top 3 Reels by Views</p>
                      <button onClick={() => setTab("reels")} style={{ fontSize: "11px", color: "#63b3ed", background: "none", border: "none", cursor: "pointer", fontFamily: "inherit" }}>See all →</button>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                      {[...reels].sort((a,b) => ((b.play_count??b.view_count??0)-(a.play_count??a.view_count??0))).slice(0,3).map((r,i) => (
                        <ReelCard key={i} reel={r} index={i} />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })()}

          {/* ── REELS TAB ── */}
          {tab === "reels" && (
            <div style={{ animation: "fadeIn .3s ease" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px", flexWrap: "wrap", gap: "8px" }}>
                <p style={{ fontSize: "13px", color: "rgba(255,255,255,0.4)" }}>{reels.length} reels fetched for <strong style={{ color: "#fff" }}>@{username}</strong></p>
                <div style={{ display: "flex", gap: "5px" }}>
                  {["views", "likes", "comments", "date"].map(s => (
                    <button key={s} onClick={() => setReelSort(s)} style={{
                      padding: "5px 11px", borderRadius: "8px", fontSize: "11px", fontWeight: 600,
                      cursor: "pointer", fontFamily: "inherit", transition: "all .15s",
                      background: reelSort === s ? "rgba(255,59,92,0.15)" : "rgba(255,255,255,0.05)",
                      border: `1px solid ${reelSort === s ? "rgba(255,59,92,0.3)" : "rgba(255,255,255,0.07)"}`,
                      color: reelSort === s ? "#ff3b5c" : "rgba(255,255,255,0.4)",
                    }}>{s}</button>
                  ))}
                </div>
              </div>
              {reels.length > 0
                ? <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                    {sortedReels.map((r, i) => <ReelCard key={i} reel={r} index={i} />)}
                  </div>
                : <div style={{ textAlign: "center", padding: "40px", color: "rgba(255,255,255,0.2)", fontSize: "13px" }}>No reels data available for this account</div>
              }
            </div>
          )}

          {/* ── HASHTAG TAB ── */}
          {tab === "hashtag" && hashData && (() => {
            const posts = hashData.top_posts ?? hashData.recent_posts ?? hashData.posts ?? [];
            const postCount = hashData.media_count ?? hashData.post_count ?? null;

            return (
              <div style={{ animation: "fadeIn .3s ease" }}>
                <div style={{ padding: "16px 18px", background: "rgba(99,179,237,0.06)", border: "1px solid rgba(99,179,237,0.15)", borderRadius: "12px", marginBottom: "16px" }}>
                  <div style={{ fontSize: "20px", fontWeight: 800, color: "#63b3ed", marginBottom: "4px" }}>#{hashtag}</div>
                  {postCount && <div style={{ fontSize: "13px", color: "rgba(255,255,255,0.45)" }}><strong style={{ color: "#fff" }}>{fmt(postCount)}</strong> posts using this hashtag</div>}
                </div>
                {Array.isArray(posts) && posts.length > 0 && (
                  <div>
                    <p style={{ fontSize: "12px", color: "rgba(255,255,255,0.4)", marginBottom: "10px", textTransform: "uppercase", letterSpacing: "1px", fontWeight: 600 }}>Top Posts</p>
                    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                      {posts.slice(0, 10).map((p, i) => <ReelCard key={i} reel={p} index={i} />)}
                    </div>
                  </div>
                )}
                {(!posts || posts.length === 0) && (
                  <div style={{ textAlign: "center", padding: "40px", color: "rgba(255,255,255,0.2)", fontSize: "13px" }}>
                    Hashtag found — no post details available from this endpoint
                  </div>
                )}
              </div>
            );
          })()}

        </div>
      )}

      {/* Empty state */}
      {!loading && !profile && !hashData && !error && (
        <div style={{ textAlign: "center", padding: "60px 20px" }}>
          <div style={{ fontSize: "40px", marginBottom: "12px" }}>📊</div>
          <p style={{ fontSize: "15px", color: "rgba(255,255,255,0.4)", marginBottom: "6px" }}>Look up any brand or hashtag</p>
          <p style={{ fontSize: "13px", color: "rgba(255,255,255,0.2)", marginBottom: "24px" }}>Get real follower counts, Reel view totals, engagement rates and more</p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", justifyContent: "center" }}>
            {["traya_health", "mamaearth", "nykaabeauty", "myglamm", "plumgoodness"].map(b => (
              <button key={b} onClick={() => { setInput(b); lookupBrand(b); }} style={{
                padding: "7px 14px", borderRadius: "20px", fontSize: "12px", fontWeight: 600,
                cursor: "pointer", fontFamily: "inherit",
                background: "rgba(255,59,92,0.08)", border: "1px solid rgba(255,59,92,0.2)", color: "rgba(255,255,255,0.45)",
              }}
                onMouseEnter={e => { e.currentTarget.style.color = "#ff3b5c"; }}
                onMouseLeave={e => { e.currentTarget.style.color = "rgba(255,255,255,0.45)"; }}
              >@{b}</button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
