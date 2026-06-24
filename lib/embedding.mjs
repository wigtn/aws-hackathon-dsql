// ============================================================================
// Single source of truth for the discovery embedding space. Framework-free ESM
// (no Next/TS imports) so it can be shared by BOTH the app (lib/sim/store.ts,
// lib/db/pg-discovery.ts) and the standalone provisioning script
// (scripts/pg-setup.mjs). Previously this logic was hand-copied into three
// places; any edit here now reaches the live query path and the seeded vectors
// together, so they can never silently drift (PR PROD-448 review M3).
//
// Stands in for pgvector(1024); each axis is a concept. Unit-normalized so the
// pgvector cosine operator (<=>) and the in-memory cosine agree exactly.
// ============================================================================

/** @type {readonly string[]} */
export const AXES = [
  "kpop",
  "rock",
  "indie",
  "pop",
  "sports",
  "sneakers",
  "collectible",
  "gaming",
  "arena",
  "club",
  "weekend",
  "global",
];

/**
 * @param {Record<string, number>} weights
 * @returns {number[]}
 */
export function embed(weights) {
  const v = AXES.map((a) => weights[a] ?? 0);
  const norm = Math.hypot(...v) || 1;
  return v.map((x) => x / norm);
}

/**
 * @param {string} q
 * @returns {number[]}
 */
export function embedQuery(q) {
  const t = q.toLowerCase();
  /** @type {Record<string, number>} */
  const w = {};
  const add = (a, n = 1) => (w[a] = (w[a] ?? 0) + n);
  if (/(k-?pop|bts|stray|seventeen|아이돌|케이팝)/.test(t)) add("kpop", 2), add("global");
  if (/(rock|band|guitar|metal)/.test(t)) add("rock", 2);
  if (/(indie|underground|small|alt)/.test(t)) add("indie", 2), add("club");
  if (/(pop|stadium tour|eras)/.test(t)) add("pop", 2), add("arena");
  if (/(sport|final|match|cup|league|nba|soccer|축구)/.test(t)) add("sports", 2);
  if (/(sneaker|snkrs|nike|jordan|yeezy|드롭|drop)/.test(t)) add("sneakers", 2), add("collectible");
  if (/(labubu|pop ?mart|figure|toy|collectible|tcg|pokemon|포켓몬)/.test(t)) add("collectible", 2), add("gaming");
  if (/(ps5|console|gpu|gaming|game)/.test(t)) add("gaming", 2);
  if (/(weekend|tonight|this week|주말|오늘)/.test(t)) add("weekend", 1.5);
  if (/(arena|stadium|dome)/.test(t)) add("arena", 1);
  if (/(club|venue|bar)/.test(t)) add("club", 1);
  if (Object.keys(w).length === 0) add("pop"), add("global");
  return embed(w);
}
