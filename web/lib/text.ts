/** Lowercase and strip accents, so "odegaard" finds "Ødegaard" and "jose" finds "José". Safe on server and client. */
export const fold = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/ø/gi, "o").replace(/æ/gi, "ae").replace(/ß/g, "ss").replace(/ł/gi, "l").toLowerCase();

/** True when the typed text matches any of the names given (short name, full name…), allowing small typos. */
export const anyNameMatches = (query: string, ...names: string[]) => names.some((n) => nameMatch(query, n) >= 0);

/** Letters only, repeated letters collapsed: "klaasen" and "klassen" both become "klasen". */
const squash = (s: string) => s.replace(/[^a-z]/g, "").replace(/(.)\1+/g, "$1");

/** Edit distance (insert, delete, change, swap two neighbours), stopping early once it passes `max`. */
function distance(a: string, b: string, max: number) {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev2: number[] = [], prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    let best = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let v = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) v = Math.min(v, prev2[j - 2] + 1);
      cur.push(v);
      best = Math.min(best, v);
    }
    if (best > max) return max + 1;
    prev2 = prev;
    prev = cur;
  }
  return prev[b.length];
}

/**
 * How well a typed name matches a player's name. Lower is better; -1 means no match.
 * 0: a word starts with it ("kla" → "H Klaasen")   1: it appears inside the name
 * 2: close spelling ("klassen" → "Klaasen", "bumra" → "Bumrah", "suryavansi" → "Suryavanshi")
 * Every word typed must match some word of the name ("hardik pandya" → "HH Pandya" needs "pandya" to match).
 */
export function nameMatch(query: string, name: string): number {
  const q = fold(query.trim());
  if (!q) return 0;
  const n = fold(name);
  const words = n.split(/[\s.\-']+/).filter(Boolean);
  if (words.some((w) => w.startsWith(q)) || n.startsWith(q)) return 0;
  if (n.includes(q)) return 1;

  const parts = q.split(/[\s.\-']+/).filter(Boolean);
  let worst = 0;
  for (const part of parts) {
    let best = -1;
    for (const w of words) {
      if (w.startsWith(part)) { best = 0; break; }
      if (part.length < 3) continue;
      const sp = squash(part), sw = squash(w);
      const allowed = part.length >= 7 ? 2 : part.length >= 4 ? 1 : 0;
      // whole word, or the start of a longer word ("suryav" → "suryavanshi")
      if (sw === sp || sw.startsWith(sp) || distance(part, w, allowed) <= allowed || distance(sp, sw, allowed) <= allowed || (w.length > part.length && distance(part, w.slice(0, part.length), allowed) <= allowed)) {
        best = 2;
      }
    }
    if (best < 0) {
      // The data uses initials ("V Kohli"), so a typed first name only has to match an initial:
      // "virat kohli" → V Kohli, "jasprit bumrah" → JJ Bumrah, "hardik pandya" → HH Pandya.
      const initials = words.length > 1 ? words.slice(0, -1).filter((w) => w.length <= 3).join("") : "";
      if (parts.length > 1 && initials.includes(part[0])) continue;
      return -1;
    }
    worst = Math.max(worst, best);
  }
  // At least one typed word must really match (not just an initial).
  const real = parts.some((part) => words.some((w) => w.startsWith(part) || (part.length >= 3 && squash(w).startsWith(squash(part)))) || words.some((w) => part.length >= 4 && distance(part, w, part.length >= 7 ? 2 : 1) <= (part.length >= 7 ? 2 : 1)));
  return parts.length && real ? worst : -1;
}
