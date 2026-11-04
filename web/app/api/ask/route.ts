import { getLeagueTable, getMatchday, getScorers } from "@/lib/football";

type Msg = { role: "user" | "assistant"; content: string };

const MODEL = "claude-haiku-5-5";
const GEMINI_DEFAULT_MODEL = "gemini-3.5-flash-lite";

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
  const gemini = process.env.GEMINI_API_KEY;
  const anthropic = process.env.ANTHROPIC_API_KEY;
  if (!gemini && !anthropic) {
    return Response.json(
      { error: "The AI analyst isn't connected yet. Add GEMINI_API_KEY (free) or ANTHROPIC_API_KEY to .env.local and restart the server." },
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
    const answer = gemini ? await askGemini(gemini, system, messages) : await askClaude(anthropic!, system, messages);
    return Response.json({ answer });
  } catch (err) {
    if (err instanceof AskError) return Response.json({ error: err.message }, { status: 502 });
    console.error("Ask AI failed", err);
    return Response.json({ error: "Couldn't reach the AI service. Check your internet connection." }, { status: 502 });
  }
}

class AskError extends Error {}

function friendlyError(provider: string, envVar: string, status: number, detail: string) {
  console.error(`${provider} API error`, status, detail.slice(0, 300));
  if (status === 400 && /model/i.test(detail)) return new AskError(`The ${provider} model name wasn't recognised. Check the model setting in .env.local.`);
  if (status === 401 || status === 403 || /API key not valid/i.test(detail)) return new AskError(`Your ${provider} API key was rejected. Check ${envVar} in .env.local.`);
  if (status === 429) return new AskError("The AI's free limit is used up for now. Try again in a minute, or tomorrow if the daily limit is reached.");
  return new AskError("The AI analyst couldn't answer right now. Try again.");
}

/** Google Gemini (has a free tier). Model can be changed with GEMINI_MODEL. */
async function askGemini(key: string, system: string, messages: Msg[]) {
  const model = process.env.GEMINI_MODEL || GEMINI_DEFAULT_MODEL;
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
    method: "POST",
    headers: { "x-goog-api-key": key, "content-type": "application/json" },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: messages.map((m) => ({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.content }] })),
      generationConfig: { maxOutputTokens: 800, temperature: 0.4 },
    }),
  });
  if (!res.ok) throw friendlyError("Gemini", "GEMINI_API_KEY", res.status, await res.text());
  const data = (await res.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
  const answer = (data.candidates?.[0]?.content?.parts ?? []).map((p) => p.text ?? "").join("").trim();
  if (!answer) throw new AskError("The AI didn't return an answer. Try rephrasing your question.");
  return answer;
}

/** Anthropic Claude (paid API). */
async function askClaude(key: string, system: string, messages: Msg[]) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({ model: MODEL, max_tokens: 600, system, messages }),
  });
  if (!res.ok) throw friendlyError("Anthropic", "ANTHROPIC_API_KEY", res.status, await res.text());
  const data = (await res.json()) as { content: { type: string; text?: string }[] };
  return data.content.filter((c) => c.type === "text").map((c) => c.text).join("").trim();
}
