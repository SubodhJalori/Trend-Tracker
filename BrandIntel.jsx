import { useState, useCallback } from "react";

// ── Helpers ──────────────────────────────────────────────────────

function fmt(n) {
  if (n == null || isNaN(Number(n))) return "—";
  n = Number(n);
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000)     return (n / 1_000).toFixed(1) + "K";
  return String(n);
}

function engRate(followers, likes, comments) {
  if (!followers || followers === 0) return "—";
  return (((likes + comments) / followers) * 100).toFixed(2) + "%";
}

// All calls go through our Vercel proxy at /api/instagram
// which injects the token server-side
async function igFetch(path, params = {}) {
  const qs = new URLSearchParams({ path, ...params }).toString();
  const res = await fetch(`/api/instagram?${qs}`);
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data?.detail || data?.error || `API error ${res.status}`);
  }
  if (data.detail && typeof data.detail === "string" && data.detail.toLowerCase().includes("error")) {
    throw new Error(data.detail);
  }
  return data;
}

// ── Sub-components ───────────────────────────────────────────────

function StatBox({ label, value, sub, color = "#fff" }) {
  return (
    <div style={{
      background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
      borderRadius: "12px", padding: "14px 16px", flex: 1, minWidth: "110px",
    }}>
      <div style={{ fontSize: "10px", color: "rgba(255,255,255,0.35)", marginBottom: "6px", textTransform: "uppercase", letterSpacing: "1px", fontWeight: 600 }}>{label}</div>
      <div style={{ fontSize: "20px", fontWeight: 800, color, letterSpacing: "-0.5px" }}>{value}</div>
      {sub && <div style={{ fontSize: "10px", color: "rgba(255,255,255,0.25)", marginTop: "3px" }}>{sub}</div>}
    </div>
  );
}

function ReelCard({ reel, index }) {
  const [open, setOpen] = useState(false);

  // EnsembleData returns different field names — handle all variants
  const views    = reel.play_count ?? reel.view_count ?? reel.video_view_count ?? reel.playCount ?? 0;
  const likes    = reel.like_count ?? reel.likeCount ?? 0;
  const comments = reel.comment_count ?? reel.commentCount ?? 0;
  const caption  = reel.caption?.text ?? reel.caption ?? reel.text ?? "";
  const takenAt  = reel.taken_at ?? reel.takenAt ?? reel.timestamp ?? null;
  const date     = takenAt
    ? new Date(takenAt * 1000).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
    : "—";
  const code     = reel.code ?? reel.shortcode ?? reel.id ?? null;
  const thumb    = reel.thumbnail_url ?? reel.display_url
    ?? reel.image_versions?.candidates?.[0]?.url
    ?? reel.image_versions2?.candidates?.[0]?.url
    ?? null;

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
      {/* Growth bar based on views */}
      <div style={{ position: "absolute", top: 0, left: 0, height: "2px", width: `${Math.min(views / 30000, 100)}%`, background: "linear-gradient(90deg,#ff3b5c,transparent)" }} />

      <div style={{ display: "flex", gap: "12px", alignItems: "flex-start" }}>
        {/* Thumbnail */}
        <div style={{ width: "48px", height: "48px", borderRadius: "8px", background: "rgba(255,255,255,0.06)", flexShrink: 0, overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center" }}>
          {thumb
            ? <img src={thumb} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} onError={e => { e.target.style.display = "none"; }} />
            : <span style={{ fontSize: "20px" }}>🎬</span>
          }
        </div>

        {/* Text */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
            <span style={{ fontSize: "11px", color: "rgba(255,255,255,0.25)" }}>#{index + 1}</span>
            <span style={{ fontSize: "11px", color: "rgba(255,255,255,0.3)" }}>{date}</span>
          </div>
          <p style={{ margin: 0, fontSize: "12px", color: "rgba(255,255,255,0.45)", lineHeight: 1.4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: open ? "normal" : "nowrap" }}>
            {caption || "(no caption)"}
          </p>
        </div>

        {/* Views */}
        <div style={{ textAlign: "right", flexShrink: 0 }}>
          <div style={{ fontSize: "16px", fontWeight: 800, color: "#ff3b5c" }}>{fmt(views)}</div>
          <div style={{ fontSize: "10px", color: "rgba(255,255,255,0.28)" }}>views</div>
        </div>
      </div>

      {/* Expanded row */}
      {open && (
        <div style={{ marginTop: "12px", paddingTop: "12px", borderTop: "1px solid rgba(255,255,255,0.06)", display: "flex", gap: "14px", flexWrap: "wrap", alignItems: "center" }}>
          <span style={{ fontSize: "12px", color: "rgba(255,255,255,0.45)" }}>❤️ <strong style={{ color: "#fff" }}>{fmt(likes)}</strong></span>
          <span style={{ fontSize: "12px", color: "rgba(255,255,255,0.45)" }}>💬 <strong style={{ color: "#fff" }}>{fmt(comments)}</strong></span>
          {code && (
            <a
              href={`https://www.instagram.com/reel/${code}/`}
              target="_blank" rel="noopener noreferrer"
              onClick={e => e.stopPropagation()}
              style={{ fontSize: "12px", color: "#63b3ed", textDecoration: "none", marginLeft: "auto" }}
            >↗ View on Instagram</a>
          )}
        </div>
      )}
    </div>
  );
}

function Shimmer({ count = 5 }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
      {[...Array(count)].map((_, i) => (
        <div key={i} style={{ height: "76px", borderRadius: "14px", background: "rgba(255,255,255,0.04)", position: "relative", overflow: "hidden" }}>
          <div style={{ position: "absolute", inset: 0, background: "linear-gradient(90deg,transparent,rgba(255,255,255,0.07),transparent)", animation: "sweep 1.5s ease infinite", animationDelay: `${i * 0.12}s` }} />
        </div>
      ))}
      <style>{`@keyframes sweep{0%{transform:translateX(-100%)}100%{transform:translateX(100%)}}`}</style>
    </div>
  );
}

// ── Main BrandIntel Component ─────────────────────────────────────

const TABS = [
  { id: "profile",  label: "👤 Profile" },
  { id: "reels",    label: "🎬 Reels" },
  { id: "hashtag",  label: "#  Hashtag" },
];

const SAMPLE_BRANDS = ["traya_health", "mamaearth", "nykaabeauty", "myglamm", "plumgoodness", "mcaffeine"];

export default function BrandIntel() {
  const [usernameInput, setUsernameInput] = useState("");
  const [hashInput,     setHashInput]     = useState("");
  const [tab,           setTab]           = useState("profile");

  // Data
  const [profile,   setProfile]   = useState(null);
  const [reels,     setReels]     = useState([]);
  const [hashData,  setHashData]  = useState(null);
  const [loadedUser, setLoadedUser] = useState("");

  // Loading / error states
  const [profileLoading, setProfileLoading] = useState(false);
  const [reelsLoading,   setReelsLoading]   = useState(false);
  const [hashLoading,    setHashLoading]    = useState(false);
  const [profileError,   setProfileError]   = useState(null);
  const [reelsError,     setReelsError]     = useState(null);
  const [hashError,      setHashError]      = useState(null);

  const [reelSort, setReelSort] = useState("views");

  // ── Step 1: look up username → get profile + user_id ──────────
  const lookupBrand = useCallback(async (raw) => {
    const handle = (raw || usernameInput).trim().replace(/^@/, "");
    if (!handle) return;

    setProfile(null);
    setReels([]);
    setLoadedUser(handle);
    setProfileError(null);
    setReelsError(null);
    setProfileLoading(true);
    setTab("profile");

    try {
      // Correct endpoint: /instagram/user/info?username=...
      const data = await igFetch("/instagram/user/info", { username: handle });

      // EnsembleData wraps response in data.data
      const user = data?.data ?? data;
      setProfile(user);
      setProfileLoading(false);

      // ── Step 2: fetch reels using numeric user ID ──────────────
      const userId = user?.id ?? user?.pk ?? user?.user?.pk ?? user?.user?.id;
      if (userId) {
        setReelsLoading(true);
        try {
          const reelsData = await igFetch("/instagram/user/reels", {
            user_id: String(userId),
            depth: "1",
            include_feed_video: "true",
          });
          // Response can be nested in various ways
          const list =
            reelsData?.data?.reels ??
            reelsData?.data ??
            reelsData?.reels ??
            reelsData?.items ??
            (Array.isArray(reelsData) ? reelsData : []);
          setReels(Array.isArray(list) ? list : []);
        } catch (err) {
          setReelsError(err.message);
        } finally {
          setReelsLoading(false);
        }
      } else {
        setReelsError("Could not find user ID to fetch reels.");
        setReelsLoading(false);
      }
    } catch (err) {
      setProfileError(err.message || "Account not found. Check the username and try again.");
      setProfileLoading(false);
    }
  }, [usernameInput]);

  // ── Hashtag lookup ─────────────────────────────────────────────
  const lookupHashtag = useCallback(async () => {
    const tag = hashInput.trim().replace(/^#/, "");
    if (!tag) return;
    setHashData(null);
    setHashError(null);
    setHashLoading(true);
    setTab("hashtag");
    try {
      const data = await igFetch("/instagram/hashtag/search", { hashtag: tag });
      setHashData(data?.data ?? data);
    } catch (err) {
      setHashError(err.message || "Could not fetch hashtag data.");
    } finally {
      setHashLoading(false);
    }
  }, [hashInput]);

  // ── Derived stats ──────────────────────────────────────────────
  const followers  = profile?.follower_count ?? profile?.user?.follower_count ?? 0;
  const following  = profile?.following_count ?? profile?.user?.following_count ?? 0;
  const posts      = profile?.media_count ?? profile?.user?.media_count ?? 0;
  const fullName   = profile?.full_name ?? profile?.user?.full_name ?? loadedUser;
  const bio        = profile?.biography ?? profile?.user?.biography ?? "";
  const isVerified = profile?.is_verified ?? profile?.user?.is_verified ?? false;
  const category   = profile?.category ?? profile?.user?.category ?? "";
  const avatar     = profile?.profile_pic_url ?? profile?.user?.profile_pic_url ?? null;

  const totalViews   = reels.reduce((s, r) => s + (r.play_count ?? r.view_count ?? r.video_view_count ?? 0), 0);
  const totalLikes   = reels.reduce((s, r) => s + (r.like_count ?? 0), 0);
  const totalComments = reels.reduce((s, r) => s + (r.comment_count ?? 0), 0);
  const avgViews     = reels.length ? Math.round(totalViews / reels.length) : 0;
  const avgLikes     = reels.length ? Math.round(totalLikes / reels.length) : 0;

  const sortedReels = [...reels].sort((a, b) => {
    const getV = r => r.play_count ?? r.view_count ?? r.video_view_count ?? 0;
    const getL = r => r.like_count ?? 0;
    const getC = r => r.comment_count ?? 0;
    const getD = r => r.taken_at ?? r.timestamp ?? 0;
    if (reelSort === "views")    return getV(b) - getV(a);
    if (reelSort === "likes")    return getL(b) - getL(a);
    if (reelSort === "comments") return getC(b) - getC(a);
    if (reelSort === "date")     return getD(b) - getD(a);
    return 0;
  });

  const loading = profileLoading || reelsLoading || hashLoading;

  return (
    <div style={{ animation: "fadeIn .3s ease" }}>

      {/* ── Search bars ── */}
      <div style={{ display: "flex", gap: "10px", marginBottom: "20px", flexWrap: "wrap" }}>

        {/* Username */}
        <div style={{ flex: 2, minWidth: "220px", display: "flex", gap: "8px" }}>
          <div style={{
            flex: 1, display: "flex", alignItems: "center", gap: "8px",
            background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: "10px", padding: "10px 14px",
          }}>
            <span style={{ opacity: 0.4 }}>👤</span>
            <input
              value={usernameInput}
              onChange={e => setUsernameInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && lookupBrand()}
              placeholder="e.g. traya_health"
              style={{ flex: 1, background: "none", border: "none", color: "#fff", fontSize: "13px", fontFamily: "inherit" }}
            />
          </div>
          <button onClick={() => lookupBrand()} disabled={profileLoading || !usernameInput.trim()} style={{
            padding: "10px 16px", borderRadius: "10px", fontSize: "12px", fontWeight: 700,
            cursor: profileLoading || !usernameInput.trim() ? "not-allowed" : "pointer", fontFamily: "inherit",
            background: "rgba(255,59,92,0.15)", border: "1px solid rgba(255,59,92,0.3)",
            color: usernameInput.trim() ? "#ff3b5c" : "rgba(255,255,255,0.2)", whiteSpace: "nowrap",
          }}>{profileLoading ? "Looking up…" : "Look up"}</button>
        </div>

        {/* Hashtag */}
        <div style={{ flex: 1, minWidth: "180px", display: "flex", gap: "8px" }}>
          <div style={{
            flex: 1, display: "flex", alignItems: "center", gap: "8px",
            background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: "10px", padding: "10px 14px",
          }}>
            <span style={{ opacity: 0.5, fontWeight: 700, fontSize: "14px" }}>#</span>
            <input
              value={hashInput}
              onChange={e => setHashInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && lookupHashtag()}
              placeholder="hairfall, skincare…"
              style={{ flex: 1, background: "none", border: "none", color: "#fff", fontSize: "13px", fontFamily: "inherit" }}
            />
          </div>
          <button onClick={lookupHashtag} disabled={hashLoading || !hashInput.trim()} style={{
            padding: "10px 16px", borderRadius: "10px", fontSize: "12px", fontWeight: 700,
            cursor: hashLoading || !hashInput.trim() ? "not-allowed" : "pointer", fontFamily: "inherit",
            background: "rgba(99,179,237,0.12)", border: "1px solid rgba(99,179,237,0.3)",
            color: hashInput.trim() ? "#63b3ed" : "rgba(255,255,255,0.2)", whiteSpace: "nowrap",
          }}>{hashLoading ? "Searching…" : "Search"}</button>
        </div>
      </div>

      {/* ── Results ── */}
      {(profile || hashData || loading || profileError) ? (
        <div>
          {/* Tabs */}
          <div style={{ display: "flex", gap: "6px", marginBottom: "16px" }}>
            {TABS.filter(t => !(t.id === "hashtag" && !hashData && !hashLoading)).map(t => (
              <button key={t.id} onClick={() => setTab(t.id)} style={{
                padding: "8px 14px", borderRadius: "10px", fontSize: "12.5px",
                fontWeight: tab === t.id ? 700 : 500, cursor: "pointer",
                fontFamily: "inherit", transition: "all .15s",
                background: tab === t.id ? "rgba(255,59,92,0.12)" : "rgba(255,255,255,0.04)",
                border: `1px solid ${tab === t.id ? "rgba(255,59,92,0.3)" : "rgba(255,255,255,0.07)"}`,
                color: tab === t.id ? "#fff" : "rgba(255,255,255,0.38)",
              }}>{t.label}{t.id === "reels" && reels.length > 0 ? ` (${reels.length})` : ""}</button>
            ))}
          </div>

          {/* ── PROFILE TAB ── */}
          {tab === "profile" && (
            <div style={{ animation: "fadeIn .3s ease" }}>
              {profileLoading && <Shimmer count={3} />}
              {profileError && <div style={{ padding: "12px 15px", background: "rgba(255,59,92,0.08)", border: "1px solid rgba(255,59,92,0.2)", borderRadius: "10px", color: "#ff8080", fontSize: "13px" }}>⚠️ {profileError}</div>}

              {profile && !profileLoading && (
                <>
                  {/* Profile card */}
                  <div style={{ display: "flex", gap: "16px", alignItems: "flex-start", marginBottom: "16px", padding: "18px", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: "16px" }}>
                    <div style={{ width: "60px", height: "60px", borderRadius: "50%", background: "rgba(255,255,255,0.08)", flexShrink: 0, overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "24px" }}>
                      {avatar
                        ? <img src={avatar} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} onError={e => e.target.style.display = "none"} />
                        : "👤"}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "3px", flexWrap: "wrap" }}>
                        <span style={{ fontSize: "16px", fontWeight: 800, color: "#fff" }}>{fullName}</span>
                        {isVerified && <span title="Verified">✅</span>}
                        {category && <span style={{ fontSize: "11px", color: "rgba(255,255,255,0.35)", background: "rgba(255,255,255,0.06)", padding: "2px 8px", borderRadius: "20px" }}>{category}</span>}
                      </div>
                      <div style={{ fontSize: "12px", color: "rgba(255,255,255,0.4)", marginBottom: "6px" }}>@{loadedUser}</div>
                      {bio && <p style={{ fontSize: "12.5px", color: "rgba(255,255,255,0.5)", lineHeight: 1.5, margin: 0 }}>{bio}</p>}
                    </div>
                  </div>

                  {/* Stats */}
                  <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", marginBottom: "20px" }}>
                    <StatBox label="Followers"  value={fmt(followers)} color="#ff3b5c" />
                    <StatBox label="Following"  value={fmt(following)} />
                    <StatBox label="Posts"      value={fmt(posts)} />
                    {reels.length > 0 && <>
                      <StatBox label="Total Reel Views" value={fmt(totalViews)} color="#ff8c42" sub={`${reels.length} reels`} />
                      <StatBox label="Avg Views / Reel" value={fmt(avgViews)}   color="#ff8c42" />
                      <StatBox label="Avg Likes / Reel" value={fmt(avgLikes)}   color="#00d4a0" sub={engRate(followers, totalLikes, totalComments) + " eng."} />
                    </>}
                  </div>

                  {/* Reels loading inline */}
                  {reelsLoading && (
                    <div style={{ marginBottom: "16px" }}>
                      <p style={{ fontSize: "11px", color: "rgba(255,255,255,0.3)", marginBottom: "8px", textTransform: "uppercase", letterSpacing: "1px" }}>Loading reels…</p>
                      <Shimmer count={3} />
                    </div>
                  )}

                  {/* Top 3 reels preview */}
                  {!reelsLoading && reels.length > 0 && (
                    <div>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
                        <p style={{ fontSize: "11px", fontWeight: 700, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "1px" }}>Top 3 Reels by Views</p>
                        <button onClick={() => setTab("reels")} style={{ fontSize: "11px", color: "#63b3ed", background: "none", border: "none", cursor: "pointer", fontFamily: "inherit" }}>See all {reels.length} →</button>
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                        {sortedReels.slice(0, 3).map((r, i) => <ReelCard key={i} reel={r} index={i} />)}
                      </div>
                    </div>
                  )}

                  {/* Reels error */}
                  {!reelsLoading && reelsError && (
                    <div style={{ padding: "10px 14px", background: "rgba(255,59,92,0.06)", border: "1px solid rgba(255,59,92,0.15)", borderRadius: "10px", color: "#ff8080", fontSize: "12px" }}>
                      ⚠️ Reels: {reelsError}
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* ── REELS TAB ── */}
          {tab === "reels" && (
            <div style={{ animation: "fadeIn .3s ease" }}>
              {reelsLoading && <Shimmer count={6} />}
              {reelsError && !reelsLoading && <div style={{ padding: "12px 15px", background: "rgba(255,59,92,0.08)", border: "1px solid rgba(255,59,92,0.2)", borderRadius: "10px", color: "#ff8080", fontSize: "13px" }}>⚠️ {reelsError}</div>}
              {!reelsLoading && reels.length > 0 && (
                <>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px", flexWrap: "wrap", gap: "8px" }}>
                    <p style={{ fontSize: "13px", color: "rgba(255,255,255,0.4)" }}>
                      <strong style={{ color: "#fff" }}>{reels.length}</strong> reels for <strong style={{ color: "#fff" }}>@{loadedUser}</strong>
                    </p>
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
                  <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                    {sortedReels.map((r, i) => <ReelCard key={i} reel={r} index={i} />)}
                  </div>
                </>
              )}
              {!reelsLoading && !reelsError && reels.length === 0 && (
                <div style={{ textAlign: "center", padding: "40px", color: "rgba(255,255,255,0.2)", fontSize: "13px" }}>No reels found for this account</div>
              )}
            </div>
          )}

          {/* ── HASHTAG TAB ── */}
          {tab === "hashtag" && (
            <div style={{ animation: "fadeIn .3s ease" }}>
              {hashLoading && <Shimmer count={5} />}
              {hashError && <div style={{ padding: "12px 15px", background: "rgba(255,59,92,0.08)", border: "1px solid rgba(255,59,92,0.2)", borderRadius: "10px", color: "#ff8080", fontSize: "13px" }}>⚠️ {hashError}</div>}
              {hashData && !hashLoading && (() => {
                const tag       = hashInput.replace(/^#/, "");
                const postCount = hashData.media_count ?? hashData.post_count ?? hashData.edge_hashtag_to_media?.count ?? null;
                const posts     = hashData.top_posts ?? hashData.recent_posts ?? hashData.posts ?? hashData.edge_hashtag_to_media?.edges?.map(e => e.node) ?? [];

                return (
                  <>
                    <div style={{ padding: "16px 18px", background: "rgba(99,179,237,0.06)", border: "1px solid rgba(99,179,237,0.15)", borderRadius: "12px", marginBottom: "16px" }}>
                      <div style={{ fontSize: "20px", fontWeight: 800, color: "#63b3ed", marginBottom: "4px" }}>#{tag}</div>
                      {postCount != null
                        ? <div style={{ fontSize: "13px", color: "rgba(255,255,255,0.45)" }}><strong style={{ color: "#fff", fontSize: "16px" }}>{fmt(postCount)}</strong> posts</div>
                        : <div style={{ fontSize: "13px", color: "rgba(255,255,255,0.3)" }}>Post count unavailable</div>
                      }
                    </div>
                    {Array.isArray(posts) && posts.length > 0 && (
                      <>
                        <p style={{ fontSize: "11px", color: "rgba(255,255,255,0.35)", marginBottom: "10px", textTransform: "uppercase", letterSpacing: "1px", fontWeight: 600 }}>Top Posts</p>
                        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                          {posts.slice(0, 10).map((p, i) => <ReelCard key={i} reel={p} index={i} />)}
                        </div>
                      </>
                    )}
                  </>
                );
              })()}
            </div>
          )}
        </div>
      ) : (
        /* ── Empty state ── */
        <div style={{ textAlign: "center", padding: "50px 20px" }}>
          <div style={{ fontSize: "38px", marginBottom: "12px" }}>📊</div>
          <p style={{ fontSize: "15px", color: "rgba(255,255,255,0.4)", marginBottom: "6px" }}>Look up any brand or hashtag</p>
          <p style={{ fontSize: "13px", color: "rgba(255,255,255,0.2)", marginBottom: "24px" }}>Get real follower counts, Reel view totals, engagement rates and more</p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", justifyContent: "center" }}>
            {SAMPLE_BRANDS.map(b => (
              <button key={b} onClick={() => { setUsernameInput(b); lookupBrand(b); }} style={{
                padding: "7px 14px", borderRadius: "20px", fontSize: "12px", fontWeight: 600,
                cursor: "pointer", fontFamily: "inherit", transition: "all .15s",
                background: "rgba(255,59,92,0.07)", border: "1px solid rgba(255,59,92,0.18)",
                color: "rgba(255,255,255,0.4)",
              }}
                onMouseEnter={e => { e.currentTarget.style.color = "#ff3b5c"; e.currentTarget.style.background = "rgba(255,59,92,0.14)"; }}
                onMouseLeave={e => { e.currentTarget.style.color = "rgba(255,255,255,0.4)"; e.currentTarget.style.background = "rgba(255,59,92,0.07)"; }}
              >@{b}</button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
