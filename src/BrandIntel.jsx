import { useState, useCallback } from "react";
import BrandSearch from "./BrandSearch.jsx";

// ── Helpers ──────────────────────────────────────────────────────

function fmt(n) {
  if (n == null || isNaN(Number(n))) return "—";
  n = Number(n);
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000)     return (n / 1_000).toFixed(1) + "K";
  return n.toLocaleString();
}

function engRate(followers, likes, comments) {
  if (!followers) return "—";
  return (((likes + comments) / followers) * 100).toFixed(2) + "%";
}

// All calls POST to /api/instagram which injects the Apify token server-side
async function apifyRun(actor, input) {
  const res = await fetch("/api/instagram", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ actor, input }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error || `API error ${res.status}`);
  if (!Array.isArray(data)) throw new Error("Unexpected response format from Apify");
  return data;
}

// ── Sub-components ───────────────────────────────────────────────

function StatBox({ label, value, sub, color = "#fff" }) {
  return (
    <div style={{
      background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
      borderRadius: "12px", padding: "14px 16px", flex: 1, minWidth: "120px",
    }}>
      <div style={{ fontSize: "10px", color: "rgba(255,255,255,0.35)", marginBottom: "6px", textTransform: "uppercase", letterSpacing: "1px", fontWeight: 600 }}>{label}</div>
      <div style={{ fontSize: "20px", fontWeight: 800, color, letterSpacing: "-0.5px", lineHeight: 1.1 }}>{value}</div>
      {sub && <div style={{ fontSize: "10px", color: "rgba(255,255,255,0.25)", marginTop: "4px" }}>{sub}</div>}
    </div>
  );
}

function ReelCard({ reel, index }) {
  const [open, setOpen] = useState(false);

  const views    = reel.videoPlayCount ?? reel.videoViewCount ?? reel.playsCount ?? reel.play_count ?? 0;
  const likes    = reel.likesCount ?? reel.like_count ?? 0;
  const comments = reel.commentsCount ?? reel.comment_count ?? 0;
  const caption  = reel.caption ?? reel.text ?? reel.description ?? "";
  const timestamp = reel.timestamp ?? reel.takenAt ?? reel.taken_at ?? null;
  const date     = timestamp
    ? new Date(typeof timestamp === "number" && timestamp < 1e12 ? timestamp * 1000 : timestamp).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
    : "—";
  const url      = reel.url ?? reel.shortCode ? `https://www.instagram.com/reel/${reel.shortCode}/` : null;
  const thumb    = reel.displayUrl ?? reel.thumbnailUrl ?? reel.previewUrl ?? null;

  const viewColor = views > 500000 ? "#ff3b5c" : views > 100000 ? "#ff8c42" : "#00d4a0";

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
      <div style={{ position: "absolute", top: 0, left: 0, height: "2px", width: `${Math.min(views / 10000, 100)}%`, background: `linear-gradient(90deg,${viewColor},transparent)` }} />

      <div style={{ display: "flex", gap: "12px", alignItems: "flex-start" }}>
        {/* Thumbnail */}
        <div style={{ width: "52px", height: "52px", borderRadius: "8px", background: "rgba(255,255,255,0.06)", flexShrink: 0, overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center" }}>
          {thumb
            ? <img src={thumb} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} onError={e => { e.target.style.display = "none"; e.target.parentNode.textContent = "🎬"; }} />
            : <span style={{ fontSize: "22px" }}>🎬</span>
          }
        </div>

        {/* Text */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
            <span style={{ fontSize: "11px", color: "rgba(255,255,255,0.25)" }}>#{index + 1}</span>
            <span style={{ fontSize: "11px", color: "rgba(255,255,255,0.35)" }}>{date}</span>
          </div>
          <p style={{ margin: 0, fontSize: "12px", color: "rgba(255,255,255,0.48)", lineHeight: 1.4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: open ? "normal" : "nowrap" }}>
            {caption || "(no caption)"}
          </p>
        </div>

        {/* Views */}
        <div style={{ textAlign: "right", flexShrink: 0 }}>
          <div style={{ fontSize: "17px", fontWeight: 800, color: viewColor, letterSpacing: "-0.5px" }}>{fmt(views)}</div>
          <div style={{ fontSize: "10px", color: "rgba(255,255,255,0.28)" }}>views</div>
        </div>
      </div>

      {open && (
        <div style={{ marginTop: "12px", paddingTop: "12px", borderTop: "1px solid rgba(255,255,255,0.06)", display: "flex", gap: "16px", flexWrap: "wrap", alignItems: "center" }}>
          <span style={{ fontSize: "12px", color: "rgba(255,255,255,0.45)" }}>❤️ <strong style={{ color: "#fff" }}>{fmt(likes)}</strong></span>
          <span style={{ fontSize: "12px", color: "rgba(255,255,255,0.45)" }}>💬 <strong style={{ color: "#fff" }}>{fmt(comments)}</strong></span>
          {reel.videoPlayCount && (
            <span style={{ fontSize: "12px", color: "rgba(255,255,255,0.45)" }}>▶️ <strong style={{ color: "#fff" }}>{fmt(reel.videoPlayCount)}</strong> plays</span>
          )}
          {url && (
            <a href={url} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}
              style={{ fontSize: "12px", color: "#63b3ed", textDecoration: "none", marginLeft: "auto" }}>
              ↗ View on Instagram
            </a>
          )}
        </div>
      )}
    </div>
  );
}

function HashtagPostCard({ post, index }) {
  const views    = post.videoViewCount ?? post.videoPlayCount ?? 0;
  const likes    = post.likesCount ?? 0;
  const comments = post.commentsCount ?? 0;
  const caption  = post.caption ?? post.text ?? "";
  const owner    = post.ownerUsername ?? post.ownerId ?? "";
  const url      = post.url ?? (post.shortCode ? `https://www.instagram.com/p/${post.shortCode}/` : null);

  return (
    <div style={{
      background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)",
      borderRadius: "12px", padding: "12px 16px",
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "12px" }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", gap: "8px", alignItems: "center", marginBottom: "4px" }}>
            <span style={{ fontSize: "11px", color: "rgba(255,255,255,0.25)" }}>#{index + 1}</span>
            {owner && <span style={{ fontSize: "11px", fontWeight: 600, color: "#63b3ed" }}>@{owner}</span>}
          </div>
          <p style={{ margin: 0, fontSize: "12px", color: "rgba(255,255,255,0.42)", lineHeight: 1.4, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>
            {caption || "(no caption)"}
          </p>
        </div>
        <div style={{ display: "flex", gap: "12px", flexShrink: 0, alignItems: "center" }}>
          {views > 0 && <div style={{ textAlign: "center" }}><div style={{ fontSize: "13px", fontWeight: 800, color: "#ff3b5c" }}>{fmt(views)}</div><div style={{ fontSize: "9px", color: "rgba(255,255,255,0.25)" }}>views</div></div>}
          <div style={{ textAlign: "center" }}><div style={{ fontSize: "13px", fontWeight: 800, color: "#ff8c42" }}>{fmt(likes)}</div><div style={{ fontSize: "9px", color: "rgba(255,255,255,0.25)" }}>likes</div></div>
          <div style={{ textAlign: "center" }}><div style={{ fontSize: "13px", fontWeight: 800, color: "#00d4a0" }}>{fmt(comments)}</div><div style={{ fontSize: "9px", color: "rgba(255,255,255,0.25)" }}>comments</div></div>
          {url && <a href={url} target="_blank" rel="noopener noreferrer" style={{ fontSize: "11px", color: "#63b3ed", textDecoration: "none" }}>↗</a>}
        </div>
      </div>
    </div>
  );
}

function Shimmer({ count = 5, message = "" }) {
  return (
    <div>
      {message && (
        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px" }}>
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#ff3b5c", animation: "pulse 1s infinite" }} />
          <span style={{ fontSize: "12px", color: "rgba(255,255,255,0.35)" }}>{message}</span>
        </div>
      )}
      <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
        {[...Array(count)].map((_, i) => (
          <div key={i} style={{ height: "76px", borderRadius: "14px", background: "rgba(255,255,255,0.04)", position: "relative", overflow: "hidden" }}>
            <div style={{ position: "absolute", inset: 0, background: "linear-gradient(90deg,transparent,rgba(255,255,255,0.07),transparent)", animation: "sweep 1.5s ease infinite", animationDelay: `${i * 0.12}s` }} />
          </div>
        ))}
      </div>
      <style>{`@keyframes sweep{0%{transform:translateX(-100%)}100%{transform:translateX(100%)}}`}</style>
    </div>
  );
}

// ── Main BrandIntel ──────────────────────────────────────────────

const SAMPLE_BRANDS = ["traya_health", "mamaearth", "nykaabeauty", "myglamm", "plumgoodness", "mcaffeine"];
const SAMPLE_TAGS   = ["hairfall", "skincare", "naturalbeauty", "ootd", "makeuptutorial"];

export default function BrandIntel() {
  const [usernameInput, setUsernameInput] = useState("");
  const [hashInput,     setHashInput]     = useState("");
  const [tab,           setTab]           = useState("profile");

  const [profile,     setProfile]     = useState(null);
  const [reels,       setReels]       = useState([]);
  const [hashPosts,   setHashPosts]   = useState([]);
  const [hashTag,     setHashTag]     = useState("");
  const [loadedUser,  setLoadedUser]  = useState("");

  const [profileLoading, setProfileLoading] = useState(false);
  const [reelsLoading,   setReelsLoading]   = useState(false);
  const [hashLoading,    setHashLoading]    = useState(false);
  const [profileError,   setProfileError]   = useState(null);
  const [reelsError,     setReelsError]     = useState(null);
  const [hashError,      setHashError]      = useState(null);

  const [reelSort,    setReelSort]    = useState("views");
  const [searchMode,  setSearchMode]  = useState("keyword");

  // ── Brand lookup ─────────────────────────────────────────────

  const lookupBrand = useCallback(async (raw) => {
    const handle = (raw || usernameInput).trim().replace(/^@/, "");
    if (!handle) return;

    setProfile(null); setReels([]);
    setLoadedUser(handle);
    setProfileError(null); setReelsError(null);
    setProfileLoading(true); setReelsLoading(true);
    setTab("profile");

    // Run both actors in parallel
    const profilePromise = apifyRun("apify~instagram-profile-scraper", {
      usernames: [handle],
    });

    // Reels: use the instagram-scraper with resultsType=posts and filtering
    const reelsPromise = apifyRun("apify~instagram-scraper", {
      directUrls: [`https://www.instagram.com/${handle}/`],
      resultsType: "posts",
      resultsLimit: 20,
      addParentData: false,
    });

    // Profile
    profilePromise
      .then(data => {
        const user = data?.[0] ?? null;
        if (!user) throw new Error(`Account "@${handle}" not found or is private`);
        setProfile(user);
      })
      .catch(err => setProfileError(err.message))
      .finally(() => setProfileLoading(false));

    // Reels
    reelsPromise
      .then(data => {
        const list = Array.isArray(data) ? data.filter(p => p.type === "Video" || p.videoPlayCount != null || p.videoViewCount != null) : [];
        setReels(list.length > 0 ? list : data ?? []);
      })
      .catch(err => setReelsError(err.message))
      .finally(() => setReelsLoading(false));
  }, [usernameInput]);

  // ── handleBrandSelect — must come after lookupBrand ──────────
  const handleBrandSelect = useCallback((username) => {
    setUsernameInput(username);
    lookupBrand(username);
  }, [lookupBrand]);

  // ── Hashtag lookup ────────────────────────────────────────────

  const lookupHashtag = useCallback(async () => {
    const tag = hashInput.trim().replace(/^#/, "");
    if (!tag) return;

    setHashPosts([]); setHashTag(tag);
    setHashError(null); setHashLoading(true);
    setTab("hashtag");

    try {
      const data = await apifyRun("apify~instagram-scraper", {
        directUrls: [`https://www.instagram.com/explore/tags/${tag}/`],
        resultsType: "posts",
        resultsLimit: 15,
      });
      setHashPosts(Array.isArray(data) ? data : []);
    } catch (err) {
      setHashError(err.message || "Could not fetch hashtag posts.");
    } finally {
      setHashLoading(false);
    }
  }, [hashInput]);

  // ── Derived stats ─────────────────────────────────────────────

  const followers   = profile?.followersCount ?? profile?.followersCount ?? 0;
  const following   = profile?.followsCount ?? profile?.followingCount ?? 0;
  const postsCount  = profile?.postsCount ?? profile?.mediaCount ?? 0;
  const fullName    = profile?.fullName ?? profile?.name ?? loadedUser;
  const bio         = profile?.biography ?? profile?.bio ?? "";
  const isVerified  = profile?.verified ?? profile?.isVerified ?? false;
  const category    = profile?.businessCategoryName ?? profile?.category ?? "";
  const avatar      = profile?.profilePicUrl ?? profile?.profilePicUrlHD ?? null;
  const website     = profile?.externalUrl ?? profile?.website ?? null;

  const videoReels  = reels.filter(r => r.videoPlayCount != null || r.videoViewCount != null || r.type === "Video");
  const allReels    = videoReels.length > 0 ? videoReels : reels;

  const totalViews    = allReels.reduce((s, r) => s + (r.videoPlayCount ?? r.videoViewCount ?? 0), 0);
  const totalLikes    = allReels.reduce((s, r) => s + (r.likesCount ?? 0), 0);
  const totalComments = allReels.reduce((s, r) => s + (r.commentsCount ?? 0), 0);
  const avgViews      = allReels.length ? Math.round(totalViews / allReels.length) : 0;
  const avgLikes      = allReels.length ? Math.round(totalLikes / allReels.length) : 0;
  const topReel       = [...allReels].sort((a, b) => (b.videoPlayCount ?? b.videoViewCount ?? 0) - (a.videoPlayCount ?? a.videoViewCount ?? 0))[0];

  const sortedReels = [...allReels].sort((a, b) => {
    if (reelSort === "views")    return ((b.videoPlayCount ?? b.videoViewCount ?? 0) - (a.videoPlayCount ?? a.videoViewCount ?? 0));
    if (reelSort === "likes")    return ((b.likesCount ?? 0) - (a.likesCount ?? 0));
    if (reelSort === "comments") return ((b.commentsCount ?? 0) - (a.commentsCount ?? 0));
    if (reelSort === "date") {
      const ta = a.timestamp ?? a.takenAt ?? 0;
      const tb = b.timestamp ?? b.takenAt ?? 0;
      return (typeof tb === "string" ? new Date(tb) : tb) - (typeof ta === "string" ? new Date(ta) : ta);
    }
    return 0;
  });

  const hasResults = profile || hashPosts.length > 0 || profileLoading || reelsLoading || hashLoading || profileError;

  return (
    <div style={{ animation: "fadeIn .3s ease" }}>

      {/* ── Search mode toggle ── */}
      <div style={{ display: "flex", gap: "6px", marginBottom: "12px" }}>
        {[{ id: "keyword", label: "🔍 Search by keyword" }, { id: "exact", label: "@ Exact username" }].map(m => (
          <button key={m.id} onClick={() => setSearchMode(m.id)} style={{
            padding: "6px 14px", borderRadius: "8px", fontSize: "12px", fontWeight: 600,
            cursor: "pointer", fontFamily: "inherit", transition: "all .15s",
            background: searchMode === m.id ? "rgba(255,59,92,0.15)" : "rgba(255,255,255,0.05)",
            border: `1px solid ${searchMode === m.id ? "rgba(255,59,92,0.35)" : "rgba(255,255,255,0.08)"}`,
            color: searchMode === m.id ? "#ff3b5c" : "rgba(255,255,255,0.4)",
          }}>{m.label}</button>
        ))}
      </div>

      {/* ── Search bars ── */}
      <div style={{ display: "flex", gap: "10px", marginBottom: "20px", flexWrap: "wrap" }}>

        {/* Username / keyword search */}
        <div style={{ flex: 2, minWidth: "220px" }}>
          {searchMode === "keyword" ? (
            <BrandSearch
              onSelect={handleBrandSelect}
              selectedUsernames={loadedUser ? [loadedUser] : []}
              color="#ff3b5c"
              placeholder='Search by keyword e.g. "hair care india", "skincare brand"…'
            />
          ) : (
            <div style={{ display: "flex", gap: "8px" }}>
              <div style={{
                flex: 1, display: "flex", alignItems: "center", gap: "8px",
                background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: "10px", padding: "10px 14px",
              }}>
                <span style={{ opacity: 0.45, fontSize: "15px" }}>👤</span>
                <input
                  value={usernameInput}
                  onChange={e => setUsernameInput(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && lookupBrand()}
                  placeholder="e.g. traya_health"
                  style={{ flex: 1, background: "none", border: "none", color: "#fff", fontSize: "13px", fontFamily: "inherit" }}
                />
              </div>
              <button onClick={() => lookupBrand()} disabled={profileLoading || !usernameInput.trim()} style={{
                padding: "10px 18px", borderRadius: "10px", fontSize: "12px", fontWeight: 700,
                cursor: profileLoading || !usernameInput.trim() ? "not-allowed" : "pointer", fontFamily: "inherit",
                background: "rgba(255,59,92,0.15)", border: "1px solid rgba(255,59,92,0.3)",
                color: usernameInput.trim() ? "#ff3b5c" : "rgba(255,255,255,0.2)", whiteSpace: "nowrap",
                transition: "all .15s",
              }}>{profileLoading ? "Looking up…" : "Look up"}</button>
            </div>
          )}
        </div>

        {/* Hashtag */}
        <div style={{ flex: 1, minWidth: "180px", display: "flex", gap: "8px" }}>
          <div style={{
            flex: 1, display: "flex", alignItems: "center", gap: "8px",
            background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: "10px", padding: "10px 14px",
          }}>
            <span style={{ opacity: 0.5, fontWeight: 800, fontSize: "15px" }}>#</span>
            <input
              value={hashInput}
              onChange={e => setHashInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && lookupHashtag()}
              placeholder="hashtag e.g. hairfall"
              style={{ flex: 1, background: "none", border: "none", color: "#fff", fontSize: "13px", fontFamily: "inherit" }}
            />
          </div>
          <button onClick={lookupHashtag} disabled={hashLoading || !hashInput.trim()} style={{
            padding: "10px 18px", borderRadius: "10px", fontSize: "12px", fontWeight: 700,
            cursor: hashLoading || !hashInput.trim() ? "not-allowed" : "pointer", fontFamily: "inherit",
            background: "rgba(99,179,237,0.12)", border: "1px solid rgba(99,179,237,0.3)",
            color: hashInput.trim() ? "#63b3ed" : "rgba(255,255,255,0.2)", whiteSpace: "nowrap",
            transition: "all .15s",
          }}>{hashLoading ? "Searching…" : "Search"}</button>
        </div>
      </div>

      {/* ── Results ── */}
      {hasResults ? (
        <div>
          {/* Tabs */}
          <div style={{ display: "flex", gap: "6px", marginBottom: "18px" }}>
            {[
              { id: "profile",  label: "👤 Profile",           show: true },
              { id: "reels",    label: `🎬 Reels${allReels.length ? ` (${allReels.length})` : ""}`, show: !!loadedUser },
              { id: "hashtag",  label: `# ${hashTag || "Hashtag"}`, show: !!(hashTag || hashLoading) },
            ].filter(t => t.show).map(t => (
              <button key={t.id} onClick={() => setTab(t.id)} style={{
                padding: "8px 15px", borderRadius: "10px", fontSize: "12.5px",
                fontWeight: tab === t.id ? 700 : 500, cursor: "pointer",
                fontFamily: "inherit", transition: "all .15s",
                background: tab === t.id ? "rgba(255,59,92,0.12)" : "rgba(255,255,255,0.04)",
                border: `1px solid ${tab === t.id ? "rgba(255,59,92,0.3)" : "rgba(255,255,255,0.07)"}`,
                color: tab === t.id ? "#fff" : "rgba(255,255,255,0.38)",
              }}>{t.label}</button>
            ))}
          </div>

          {/* ── PROFILE TAB ── */}
          {tab === "profile" && (
            <div style={{ animation: "fadeIn .3s ease" }}>
              {profileLoading && <Shimmer count={4} message="Fetching profile from Instagram…" />}
              {profileError && !profileLoading && (
                <div style={{ padding: "12px 15px", background: "rgba(255,59,92,0.08)", border: "1px solid rgba(255,59,92,0.2)", borderRadius: "10px", color: "#ff8080", fontSize: "13px", marginBottom: "14px" }}>
                  ⚠️ {profileError}
                </div>
              )}
              {profile && !profileLoading && (
                <>
                  {/* Profile header */}
                  <div style={{ display: "flex", gap: "16px", alignItems: "flex-start", marginBottom: "16px", padding: "18px", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: "16px" }}>
                    <div style={{ width: "64px", height: "64px", borderRadius: "50%", background: "rgba(255,255,255,0.08)", flexShrink: 0, overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "26px" }}>
                      {avatar ? <img src={avatar} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} onError={e => { e.target.style.display = "none"; }} /> : "👤"}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "3px", flexWrap: "wrap" }}>
                        <span style={{ fontSize: "17px", fontWeight: 800 }}>{fullName}</span>
                        {isVerified && <span title="Verified">✅</span>}
                        {category && <span style={{ fontSize: "11px", color: "rgba(255,255,255,0.35)", background: "rgba(255,255,255,0.06)", padding: "2px 8px", borderRadius: "20px" }}>{category}</span>}
                      </div>
                      <div style={{ fontSize: "12px", color: "rgba(255,255,255,0.4)", marginBottom: "6px" }}>
                        @{loadedUser}
                        {website && <> · <a href={website} target="_blank" rel="noopener noreferrer" style={{ color: "#63b3ed", textDecoration: "none" }}>{website.replace(/^https?:\/\//, "")}</a></>}
                      </div>
                      {bio && <p style={{ fontSize: "12.5px", color: "rgba(255,255,255,0.5)", lineHeight: 1.55, margin: 0 }}>{bio}</p>}
                    </div>
                  </div>

                  {/* Stats grid */}
                  <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", marginBottom: "20px" }}>
                    <StatBox label="Followers"         value={fmt(followers)}   color="#ff3b5c" />
                    <StatBox label="Following"         value={fmt(following)} />
                    <StatBox label="Posts"             value={fmt(postsCount)} />
                    {allReels.length > 0 && <>
                      <StatBox label="Total Reel Views"  value={fmt(totalViews)}   color="#ff8c42" sub={`across ${allReels.length} reels`} />
                      <StatBox label="Avg Views / Reel"  value={fmt(avgViews)}     color="#ff8c42" />
                      <StatBox label="Avg Likes / Reel"  value={fmt(avgLikes)}     color="#00d4a0" sub={engRate(followers, totalLikes, totalComments) + " eng. rate"} />
                    </>}
                  </div>

                  {/* Top reel highlight */}
                  {topReel && (
                    <div style={{ padding: "14px 16px", background: "rgba(255,59,92,0.06)", border: "1px solid rgba(255,59,92,0.18)", borderRadius: "12px", marginBottom: "18px" }}>
                      <p style={{ fontSize: "10px", color: "#ff3b5c", fontWeight: 700, letterSpacing: "1px", textTransform: "uppercase", marginBottom: "8px" }}>🏆 Best Performing Reel</p>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
                        <p style={{ fontSize: "12.5px", color: "rgba(255,255,255,0.55)", lineHeight: 1.4, margin: 0, flex: 1 }}>
                          {(topReel.caption ?? "").slice(0, 120) || "(no caption)"}
                          {(topReel.caption ?? "").length > 120 ? "…" : ""}
                        </p>
                        <div style={{ textAlign: "right", flexShrink: 0 }}>
                          <div style={{ fontSize: "22px", fontWeight: 800, color: "#ff3b5c" }}>{fmt(topReel.videoPlayCount ?? topReel.videoViewCount ?? 0)}</div>
                          <div style={{ fontSize: "10px", color: "rgba(255,255,255,0.3)" }}>views</div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Reels loading inline */}
                  {reelsLoading && <Shimmer count={3} message="Fetching reels data…" />}

                  {/* Top 3 preview */}
                  {!reelsLoading && allReels.length > 0 && (
                    <>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
                        <p style={{ fontSize: "11px", fontWeight: 700, color: "rgba(255,255,255,0.35)", textTransform: "uppercase", letterSpacing: "1px" }}>Top Reels by Views</p>
                        <button onClick={() => setTab("reels")} style={{ fontSize: "11px", color: "#63b3ed", background: "none", border: "none", cursor: "pointer", fontFamily: "inherit" }}>See all {allReels.length} →</button>
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                        {sortedReels.slice(0, 3).map((r, i) => <ReelCard key={i} reel={r} index={i} />)}
                      </div>
                    </>
                  )}

                  {reelsError && !reelsLoading && (
                    <div style={{ padding: "10px 14px", background: "rgba(255,59,92,0.06)", border: "1px solid rgba(255,59,92,0.15)", borderRadius: "10px", color: "#ff8080", fontSize: "12px", marginTop: "12px" }}>
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
              {reelsLoading && <Shimmer count={6} message="Fetching reels from Instagram…" />}
              {reelsError && !reelsLoading && (
                <div style={{ padding: "12px 15px", background: "rgba(255,59,92,0.08)", border: "1px solid rgba(255,59,92,0.2)", borderRadius: "10px", color: "#ff8080", fontSize: "13px" }}>⚠️ {reelsError}</div>
              )}
              {!reelsLoading && allReels.length > 0 && (
                <>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px", flexWrap: "wrap", gap: "8px" }}>
                    <p style={{ fontSize: "13px", color: "rgba(255,255,255,0.4)" }}>
                      <strong style={{ color: "#fff" }}>{allReels.length}</strong> posts for <strong style={{ color: "#fff" }}>@{loadedUser}</strong>
                      {totalViews > 0 && <> · <strong style={{ color: "#ff3b5c" }}>{fmt(totalViews)}</strong> total views</>}
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
              {!reelsLoading && !reelsError && allReels.length === 0 && (
                <div style={{ textAlign: "center", padding: "40px", color: "rgba(255,255,255,0.2)", fontSize: "13px" }}>No video posts found for this account</div>
              )}
            </div>
          )}

          {/* ── HASHTAG TAB ── */}
          {tab === "hashtag" && (
            <div style={{ animation: "fadeIn .3s ease" }}>
              {hashLoading && <Shimmer count={6} message={`Scraping #${hashTag} from Instagram…`} />}
              {hashError && !hashLoading && (
                <div style={{ padding: "12px 15px", background: "rgba(255,59,92,0.08)", border: "1px solid rgba(255,59,92,0.2)", borderRadius: "10px", color: "#ff8080", fontSize: "13px" }}>⚠️ {hashError}</div>
              )}
              {!hashLoading && hashPosts.length > 0 && (
                <>
                  <div style={{ padding: "14px 18px", background: "rgba(99,179,237,0.06)", border: "1px solid rgba(99,179,237,0.15)", borderRadius: "12px", marginBottom: "16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <div style={{ fontSize: "20px", fontWeight: 800, color: "#63b3ed" }}>#{hashTag}</div>
                      <div style={{ fontSize: "12px", color: "rgba(255,255,255,0.4)", marginTop: "2px" }}>{hashPosts.length} top posts fetched</div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: "18px", fontWeight: 800, color: "#ff3b5c" }}>{fmt(hashPosts.reduce((s, p) => s + (p.videoViewCount ?? p.videoPlayCount ?? 0), 0))}</div>
                      <div style={{ fontSize: "10px", color: "rgba(255,255,255,0.3)" }}>total views in top posts</div>
                    </div>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                    {hashPosts.map((p, i) => <HashtagPostCard key={i} post={p} index={i} />)}
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      ) : (
        /* ── Empty state ── */
        <div style={{ textAlign: "center", padding: "50px 20px" }}>
          <div style={{ fontSize: "40px", marginBottom: "12px" }}>📊</div>
          <p style={{ fontSize: "15px", color: "rgba(255,255,255,0.4)", marginBottom: "5px" }}>Real data from any public Instagram account</p>
          <p style={{ fontSize: "13px", color: "rgba(255,255,255,0.22)", marginBottom: "28px" }}>Actual view counts, follower numbers, engagement rates — powered by Apify</p>
          <div style={{ marginBottom: "20px" }}>
            <p style={{ fontSize: "10px", color: "rgba(255,255,255,0.25)", letterSpacing: "1.5px", textTransform: "uppercase", marginBottom: "10px" }}>Try a brand</p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", justifyContent: "center" }}>
              {SAMPLE_BRANDS.map(b => (
                <button key={b} onClick={() => { setUsernameInput(b); lookupBrand(b); }} style={{
                  padding: "7px 14px", borderRadius: "20px", fontSize: "12px", fontWeight: 600,
                  cursor: "pointer", fontFamily: "inherit", transition: "all .15s",
                  background: "rgba(255,59,92,0.07)", border: "1px solid rgba(255,59,92,0.18)", color: "rgba(255,255,255,0.4)",
                }}
                  onMouseEnter={e => { e.currentTarget.style.color = "#ff3b5c"; e.currentTarget.style.background = "rgba(255,59,92,0.14)"; }}
                  onMouseLeave={e => { e.currentTarget.style.color = "rgba(255,255,255,0.4)"; e.currentTarget.style.background = "rgba(255,59,92,0.07)"; }}
                >@{b}</button>
              ))}
            </div>
          </div>
          <div>
            <p style={{ fontSize: "10px", color: "rgba(255,255,255,0.25)", letterSpacing: "1.5px", textTransform: "uppercase", marginBottom: "10px" }}>Try a hashtag</p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", justifyContent: "center" }}>
              {SAMPLE_TAGS.map(t => (
                <button key={t} onClick={() => { setHashInput(t); }} style={{
                  padding: "7px 14px", borderRadius: "20px", fontSize: "12px", fontWeight: 600,
                  cursor: "pointer", fontFamily: "inherit", transition: "all .15s",
                  background: "rgba(99,179,237,0.07)", border: "1px solid rgba(99,179,237,0.18)", color: "rgba(255,255,255,0.4)",
                }}
                  onMouseEnter={e => { e.currentTarget.style.color = "#63b3ed"; e.currentTarget.style.background = "rgba(99,179,237,0.14)"; }}
                  onMouseLeave={e => { e.currentTarget.style.color = "rgba(255,255,255,0.4)"; e.currentTarget.style.background = "rgba(99,179,237,0.07)"; }}
                >#{t}</button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
