/** Lowercase and strip accents, so "odegaard" finds "Ødegaard" and "jose" finds "José". Safe on server and client. */
export const fold = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/ø/gi, "o").replace(/æ/gi, "ae").replace(/ß/g, "ss").replace(/ł/gi, "l").toLowerCase();
