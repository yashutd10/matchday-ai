import { getLeagueTable, getMatchday, getScorers } from "@/lib/football";

type Msg = { role: "user" | "assistant"; content: string };

const MODEL = "claude-haiku-5-5";

async function buildContext() {
  const [table, md, scorers] = await Promise.all([getLeagueTable(), getMatchday(), getScorers()]);
  const lines: string[] = [];
  if (table) {
    lines.push("PREMIER LEAGUE TABLE (pos. team | P W D L | GF-GA | Pts | last 5 oldest→newest | home record | away record)");
    table.forEach((r, i) =>
      lines.push(`${i + 1}. ${r.team} | ${r.played} ${r.won} ${r.drawn} ${r.lost} | ${r.gf}-${r.ga} | ${r.points} | ${r.form || "-"} | home ${r.home} | away ${r.away}`),
    );
  } else {
    lines.push("No live league table is available (sample data mode).");
  }
  lines.push("", `GAMEWEEK ${md.gameweek.number} FIXTURES (${md.source === "live" ? "live" : "sample"} data), with this app's model prediction:`);
  for (const f of md.fixtures) {
    lines.push(`- ${f.home.name} vs ${f.away.name}, ${f.kickoff}: predicted ${f.prediction[0]}-${f.prediction[1]} (home ${f.probs.home}%, draw ${f.probs.draw}%, away ${f.probs.away}%, ${f.confidence} confidence)`);
  }
  if (scorers?.length) {
    lines.push("", "TOP SCORERS (name | team | position | games | goals | assists | penalties)");
    for (const p of scorers) lines.push(`${p.name} | ${p.team} | ${p.position ?? "-"} | ${p.played} | ${p.goals} | ${p.assists} | ${p.penalties}`);
  }
  return lines.join("\n");
}

export async function POST(req: Request) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) {
    return Response.json(
      { error: "The AI analyst isn't connected yet. Add ANTHROPIC_API_KEY to .env.local and restart the server." },
      { status: 503 },
    );
  }

  let messages: Msg[];
  try {
    ({ messages } = (await req.json()) as { messages: Msg[] });
  } catch {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }
  messages = (messages ?? [])
    .filter((m) => (m.role === "user" || m.role === "assistant") && typeof m.content === "string" && m.content.trim())
    .slice(-10)
    .map((m) => ({ role: m.role, content: m.content.slice(0, 2000) }));
  if (!messages.length || messages[messages.length - 1].role !== "user") {
    return Response.json({ error: "Ask a question first." }, { status: 400 });
  }

  const system = `You are Matchday AI, a sharp, friendly Premier League analyst inside a match-preview app for fans in India.
Answer using the data below. If the data doesn't cover something (injuries, transfers, xG, players outside the top-scorer list), say so plainly instead of guessing.
Keep answers short: 2-5 sentences or a few bullets, plain text, no markdown headings. Quote specific numbers from the data.
Never encourage betting.

DATA
${await buildContext()}`;

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({ model: MODEL, max_tokens: 600, system, messages }),
    });
    if (!res.ok) {
      const detail = await res.text();
      console.error("Anthropic API error", res.status, detail.slice(0, 300));
      const msg = res.status === 401 ? "Your Anthropic API key was rejected. Check ANTHROPIC_API_KEY in .env.local."
        : res.status === 429 ? "Too many questions at once. Try again in a moment."
        : "The AI analyst couldn't answer right now. Try again.";
      return Response.json({ error: msg }, { status: 502 });
    }
    const data = (await res.json()) as { content: { type: string; text?: string }[] };
    const answer = data.content.filter((c) => c.type === "text").map((c) => c.text).join("").trim();
    return Response.json({ answer });
  } catch (err) {
    console.error("Ask AI failed", err);
    return Response.json({ error: "Couldn't reach the AI service. Check your internet connection." }, { status: 502 });
  }
}
