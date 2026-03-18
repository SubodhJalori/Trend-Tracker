// ── Shared statistics utilities ───────────────────────────────────

export function num(n) {
  return Number(n) || 0;
}

export function fmt(n) {
  if (n == null || isNaN(Number(n))) return "—";
  n = Number(n);
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000)     return (n / 1_000).toFixed(1) + "K";
  return n.toLocaleString();
}

// Median: sort values and return the middle one
// Much more robust than average when outliers (celebrity posts) exist
export function median(arr) {
  if (!arr || arr.length === 0) return 0;
  const sorted = [...arr].map(Number).filter(n => !isNaN(n)).sort((a, b) => a - b);
  if (sorted.length === 0) return 0;
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0
    ? sorted[mid]
    : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
}

export function mean(arr) {
  if (!arr || arr.length === 0) return 0;
  const vals = arr.map(Number).filter(n => !isNaN(n));
  return vals.length ? Math.round(vals.reduce((s, v) => s + v, 0) / vals.length) : 0;
}

// Returns both median and mean so UI can show both
export function postStats(posts) {
  if (!posts || posts.length === 0) {
    return {
      medianViews: 0, meanViews: 0,
      medianLikes: 0, meanLikes: 0,
      medianComments: 0, meanComments: 0,
      totalViews: 0, totalLikes: 0, totalComments: 0,
      count: 0,
    };
  }

  const views    = posts.map(p => num(p.videoPlayCount ?? p.videoViewCount ?? p.play_count ?? 0));
  const likes    = posts.map(p => num(p.likesCount ?? p.like_count ?? 0));
  const comments = posts.map(p => num(p.commentsCount ?? p.comment_count ?? 0));

  return {
    medianViews:    median(views),
    meanViews:      mean(views),
    medianLikes:    median(likes),
    meanLikes:      mean(likes),
    medianComments: median(comments),
    meanComments:   mean(comments),
    totalViews:     views.reduce((s, v) => s + v, 0),
    totalLikes:     likes.reduce((s, v) => s + v, 0),
    totalComments:  comments.reduce((s, v) => s + v, 0),
    count:          posts.length,
    // Skew ratio: if mean >> median, data is heavily skewed by outliers
    viewSkew: views.length > 1 ? (mean(views) / (median(views) || 1)).toFixed(1) : 1,
  };
}

export function engRate(followers, likes, comments) {
  if (!followers) return "—";
  return (((likes + comments) / followers) * 100).toFixed(2) + "%";
}

export function engRateNum(followers, likes, comments) {
  if (!followers) return 0;
  return Number((((likes + comments) / followers) * 100).toFixed(2));
}
