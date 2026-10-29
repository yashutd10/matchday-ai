"use client";

import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/nav";

type Msg = { role: "user" | "assistant"; content: string; error?: boolean };

const examples = [
  "Who has the best home record this season?",
  "Which teams concede the most away from home?",
  "Is this weekend's AI pick a safe call?",
];

export function AskChat({ initialQuestion = "" }: { initialQuestion?: string }) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const sentInitial = useRef(false);
  const endRef = useRef<HTMLDivElement>(null);

  async function send(text: string) {
    const q = text.trim();
    if (!q || loading) return;
    const history = [...messages.filter((m) => !m.error), { role: "user" as const, content: q }];
    setMessages((m) => [...m, { role: "user", content: q }]);
    setInput("");
    setLoading(true);
    try {
      const res = await fetch("/api/ask", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ messages: history.map(({ role, content }) => ({ role, content })) }),
      });
      const data = (await res.json()) as { answer?: string; error?: string };
      setMessages((m) => [...m, data.answer ? { role: "assistant", content: data.answer } : { role: "assistant", content: data.error ?? "Something went wrong.", error: true }]);
    } catch {
      setMessages((m) => [...m, { role: "assistant", content: "Couldn't reach the server. Is npm run dev still running?", error: true }]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (initialQuestion && !sentInitial.current) {
      sentInitial.current = true;
      void send(initialQuestion);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialQuestion]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, loading]);

  return (
    <div className="flex flex-1 flex-col gap-4">
      {messages.length === 0 && !loading && (
        <div className="flex flex-col gap-2">
          <span className="text-xs text-muted">Try asking</span>
          <div className="flex flex-wrap gap-2">
            {examples.map((e) => (
              <button key={e} type="button" onClick={() => send(e)} className="rounded-full border border-line bg-card px-3.5 py-2 text-left text-sm text-soft transition hover:border-lime/50 hover:text-ink">{e}</button>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-col gap-3" aria-live="polite">
        {messages.map((m, i) =>
          m.role === "user" ? (
            <div key={i} className="max-w-[85%] self-end rounded-2xl rounded-br-md bg-lime px-4 py-2.5 text-sm font-medium text-pitch">{m.content}</div>
          ) : (
            <div key={i} className={`max-w-[90%] self-start whitespace-pre-line rounded-2xl rounded-bl-md border px-4 py-3 text-sm leading-relaxed ${m.error ? "border-[#8a2e2e] bg-[#8a2e2e]/15 text-[#ffb4b4]" : "border-line bg-card text-soft"}`}>{m.content}</div>
          ),
        )}
        {loading && (
          <div className="flex items-center gap-2 self-start rounded-2xl rounded-bl-md border border-line bg-card px-4 py-3 text-sm text-muted">
            <span className="h-2 w-2 animate-pulse rounded-full bg-lime" /> Analysing the numbers…
          </div>
        )}
        <div ref={endRef} />
      </div>

      <form
        onSubmit={(e) => { e.preventDefault(); void send(input); }}
        className="sticky bottom-20 mt-auto flex items-center gap-2 rounded-[14px] border border-[#2a3441] bg-card py-1 pr-1 pl-3.5 focus-within:border-lime/60 md:bottom-4"
      >
        <label htmlFor="chat" className="sr-only">Your question</label>
        <input id="chat" value={input} onChange={(e) => setInput(e.target.value)} placeholder="Ask about any team, fixture or stat" className="h-10 min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-[#8a94a3]" />
        <button type="submit" disabled={loading} aria-label="Send question" className="flex h-11 w-11 items-center justify-center rounded-[10px] bg-lime text-pitch transition hover:brightness-110 active:scale-95 disabled:opacity-60">
          <Icon d="M22 2L11 13M22 2l-7 20-4-9-9-4z" size={18} />
        </button>
      </form>
    </div>
  );
}
