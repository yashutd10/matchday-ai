"use client";

import { Fragment, useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/nav";

/* ---------- saved chats (kept in this browser only) ---------- */

type Msg = { role: "user" | "assistant"; content: string; error?: boolean };
type Chat = { id: string; title: string; updatedAt: number; messages: Msg[] };

const STORE = "matchday.chats.v1";
const MAX_CHATS = 50;
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const titleOf = (q: string) => (q.length > 44 ? q.slice(0, 42).trimEnd() + "…" : q);

function loadChats(): Chat[] {
  try {
    const raw = JSON.parse(localStorage.getItem(STORE) ?? "[]");
    return Array.isArray(raw) ? raw.filter((c) => c && typeof c.id === "string" && Array.isArray(c.messages)) : [];
  } catch {
    return [];
  }
}
function saveChats(chats: Chat[]) {
  try {
    localStorage.setItem(STORE, JSON.stringify(chats.slice(0, MAX_CHATS)));
  } catch {
    /* private mode or storage full: the chat still works, it just isn't saved */
  }
}

const examples = [
  "Who has the best home record this season?",
  "Which teams concede the most away from home?",
  "Is the AI's pick for the next gameweek a safe call?",
  "Compare the top four on goals scored and conceded",
  "Who are the top scorers right now?",
  "Which team is in the worst form?",
];

/* ---------- a small, safe markdown renderer (no HTML injection) ---------- */

function inline(text: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).map((part, i) =>
    part.startsWith("**") && part.endsWith("**") && part.length > 4 ? (
      <strong key={i} className="font-semibold text-ink">{part.slice(2, -2)}</strong>
    ) : part.startsWith("`") && part.endsWith("`") && part.length > 2 ? (
      <code key={i} className="rounded bg-[#1e2632] px-1 py-0.5 text-[0.9em]">{part.slice(1, -1)}</code>
    ) : (
      <Fragment key={i}>{part}</Fragment>
    ),
  );
}

const cells = (line: string) => line.trim().replace(/^\||\|$/g, "").split("|").map((c) => c.trim());

function Markdown({ text }: { text: string }) {
  const lines = text.replace(/\r/g, "").split("\n");
  const out: ReactNode[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) { i++; continue; }

    if (/^\s*[-*•]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*[-*•]\s+/.test(lines[i])) items.push(lines[i++].replace(/^\s*[-*•]\s+/, ""));
      out.push(<ul key={out.length} className="flex list-disc flex-col gap-1.5 pl-5 marker:text-lime">{items.map((t, k) => <li key={k}>{inline(t)}</li>)}</ul>);
    } else if (/^\s*\d+[.)]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*\d+[.)]\s+/.test(lines[i])) items.push(lines[i++].replace(/^\s*\d+[.)]\s+/, ""));
      out.push(<ol key={out.length} className="flex list-decimal flex-col gap-1.5 pl-5 marker:font-semibold marker:text-lime">{items.map((t, k) => <li key={k}>{inline(t)}</li>)}</ol>);
    } else if (/^\s*\|.*\|\s*$/.test(line)) {
      const rows: string[][] = [];
      while (i < lines.length && /^\s*\|.*\|\s*$/.test(lines[i])) {
        if (!/^\s*\|[\s:|-]+\|\s*$/.test(lines[i])) rows.push(cells(lines[i]));
        i++;
      }
      const [head, ...body] = rows;
      out.push(
        <div key={out.length} className="overflow-x-auto rounded-xl border border-line">
          <table className="w-full text-sm">
            <thead><tr className="bg-card text-left text-xs text-muted">{head.map((c, k) => <th key={k} className="px-3 py-2 font-normal whitespace-nowrap">{inline(c)}</th>)}</tr></thead>
            <tbody>{body.map((r, k) => <tr key={k} className="border-t border-line">{r.map((c, j) => <td key={j} className="px-3 py-2 whitespace-nowrap">{inline(c)}</td>)}</tr>)}</tbody>
          </table>
        </div>,
      );
    } else if (/^#{1,6}\s+/.test(line)) {
      out.push(<p key={out.length} className="font-display text-lg font-bold text-ink">{inline(line.replace(/^#{1,6}\s+/, ""))}</p>);
      i++;
    } else {
      const para: string[] = [];
      while (i < lines.length && lines[i].trim() && !/^\s*([-*•]\s+|\d+[.)]\s+|#{1,6}\s+|\|.*\|\s*$)/.test(lines[i])) para.push(lines[i++]);
      out.push(<p key={out.length}>{para.map((t, k) => <Fragment key={k}>{k > 0 && <br />}{inline(t)}</Fragment>)}</p>);
    }
  }
  return <div className="flex flex-col gap-3 leading-relaxed">{out}</div>;
}

/* ---------- sidebar ---------- */

const DAY = 86_400_000;
function groupOf(ts: number) {
  const start = new Date(); start.setHours(0, 0, 0, 0);
  return ts >= start.getTime() ? "Today" : ts >= start.getTime() - DAY ? "Yesterday" : ts >= start.getTime() - 7 * DAY ? "This week" : "Older";
}

function ChatList({ chats, activeId, onOpen, onNew, onRename, onDelete }: {
  chats: Chat[]; activeId: string | null;
  onOpen: (id: string) => void; onNew: () => void; onRename: (id: string, title: string) => void; onDelete: (id: string) => void;
}) {
  const [editing, setEditing] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);
  const sorted = [...chats].sort((a, b) => b.updatedAt - a.updatedAt);
  let lastGroup = "";

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <button type="button" onClick={onNew} className="flex h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-lime text-sm font-semibold text-pitch transition hover:brightness-110 active:scale-[0.98]">
        <Icon d="M12 5v14M5 12h14" size={18} /> New chat
      </button>
      <div className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto overscroll-contain pr-1">
        {sorted.length === 0 && <p className="px-1 pt-2 text-sm text-muted">Your chats will be saved here, on this device.</p>}
        {sorted.map((c) => {
          const g = groupOf(c.updatedAt);
          const header = g !== lastGroup ? g : null;
          lastGroup = g;
          const active = c.id === activeId;
          return (
            <Fragment key={c.id}>
              {header && <p className="px-2 pt-3 pb-1 text-[11px] font-semibold tracking-wider text-muted uppercase">{header}</p>}
              {editing === c.id ? (
                <form
                  onSubmit={(e) => { e.preventDefault(); const v = new FormData(e.currentTarget).get("title"); onRename(c.id, String(v ?? "")); setEditing(null); }}
                  className="px-1 py-0.5"
                >
                  <input name="title" defaultValue={c.title} autoFocus maxLength={60} aria-label="Chat name" onBlur={(e) => { onRename(c.id, e.currentTarget.value); setEditing(null); }} onKeyDown={(e) => { if (e.key === "Escape") setEditing(null); }} className="h-10 w-full rounded-lg border border-lime/60 bg-pitch px-2.5 text-sm outline-none" />
                </form>
              ) : (
                <div className={`group/row flex items-center rounded-lg ${active ? "bg-[#1e2632]" : "hover:bg-card"}`}>
                  <button type="button" onClick={() => onOpen(c.id)} aria-current={active ? "true" : undefined} className={`min-w-0 flex-1 truncate px-2.5 py-2.5 text-left text-sm ${active ? "font-semibold text-ink" : "text-soft"}`}>{c.title}</button>
                  {confirming === c.id ? (
                    <span className="flex shrink-0 items-center gap-1 pr-1.5">
                      <button type="button" onClick={() => { onDelete(c.id); setConfirming(null); }} className="rounded-md bg-[#8a2e2e] px-2 py-1 text-xs font-semibold">Delete</button>
                      <button type="button" onClick={() => setConfirming(null)} className="rounded-md px-1.5 py-1 text-xs text-muted hover:text-ink">Cancel</button>
                    </span>
                  ) : (
                    <span className={`flex shrink-0 items-center pr-1 text-muted lg:opacity-0 lg:group-hover/row:opacity-100 lg:focus-within:opacity-100 ${active ? "lg:opacity-100" : ""}`}>
                      <button type="button" onClick={() => setEditing(c.id)} aria-label={`Rename ${c.title}`} className="flex h-8 w-8 items-center justify-center rounded-md hover:text-ink"><Icon d="M12 20h9M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4z" size={15} /></button>
                      <button type="button" onClick={() => setConfirming(c.id)} aria-label={`Delete ${c.title}`} className="flex h-8 w-8 items-center justify-center rounded-md hover:text-[#ff8a8a]"><Icon d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14" size={15} /></button>
                    </span>
                  )}
                </div>
              )}
            </Fragment>
          );
        })}
      </div>
    </div>
  );
}

/* ---------- the chat ---------- */

export function AskChat({ initialQuestion = "" }: { initialQuestion?: string }) {
  const router = useRouter();
  const [chats, setChats] = useState<Chat[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [drawer, setDrawer] = useState(false);
  const [copied, setCopied] = useState<number | null>(null);

  const chatsRef = useRef<Chat[]>([]);
  const activeRef = useRef<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const sentInitial = useRef(false);
  const endRef = useRef<HTMLDivElement>(null);
  const boxRef = useRef<HTMLTextAreaElement>(null);
  const stick = useRef(true); // keep following the answer unless the reader scrolled up

  chatsRef.current = chats;
  activeRef.current = activeId;
  const active = chats.find((c) => c.id === activeId) ?? null;
  const messages = active?.messages ?? [];

  useEffect(() => { setChats(loadChats()); setLoaded(true); }, []);
  useEffect(() => { if (loaded && !busy) saveChats(chats); }, [chats, busy, loaded]);

  useEffect(() => {
    const onScroll = () => { stick.current = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 140; };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  useEffect(() => { if (stick.current) endRef.current?.scrollIntoView({ block: "end" }); }, [messages]);

  const patch = useCallback((id: string, fn: (c: Chat) => Chat) => setChats((cs) => cs.map((c) => (c.id === id ? fn(c) : c))), []);

  const send = useCallback(async (text: string, opts?: { fresh?: boolean }) => {
    const q = text.trim();
    if (!q || abortRef.current) return;

    let id = opts?.fresh ? null : activeRef.current;
    const prior = (id ? chatsRef.current.find((c) => c.id === id)?.messages ?? [] : []).filter((m) => !m.error && m.content);
    const history = [...prior, { role: "user" as const, content: q }];
    const next: Msg[] = [...history, { role: "assistant", content: "" }];
    if (id) {
      patch(id, (c) => ({ ...c, updatedAt: Date.now(), messages: next }));
    } else {
      id = uid();
      const chat: Chat = { id, title: titleOf(q), updatedAt: Date.now(), messages: next };
      setChats((cs) => [chat, ...cs]);
      setActiveId(id);
    }
    const chatId = id;
    const setAnswer = (content: string, error?: boolean) =>
      patch(chatId, (c) => ({ ...c, messages: [...c.messages.slice(0, -1), { role: "assistant", content, ...(error ? { error } : {}) }] }));

    setInput("");
    setBusy(true);
    stick.current = true;
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    let answer = "";
    try {
      const res = await fetch("/api/ask", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ messages: history.map(({ role, content }) => ({ role, content })) }),
        signal: ctrl.signal,
      });
      if (!res.ok || !res.body || (res.headers.get("content-type") ?? "").includes("json")) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setAnswer(data.error ?? "Something went wrong. Try again.", true);
      } else {
        const reader = res.body.getReader();
        const dec = new TextDecoder();
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          answer += dec.decode(value, { stream: true });
          setAnswer(answer);
        }
        if (!answer.trim()) setAnswer("The AI didn't return an answer. Try rephrasing your question.", true);
      }
    } catch {
      if (ctrl.signal.aborted) setAnswer(answer.trim() ? answer : "Stopped.", !answer.trim());
      else setAnswer(answer.trim() ? answer : "Couldn't reach the server. Check your connection and try again.", !answer.trim());
    } finally {
      abortRef.current = null;
      setBusy(false);
    }
  }, [patch]);

  // A question passed from the homepage box (/ask?q=…) starts a new chat, once.
  useEffect(() => {
    if (!loaded || !initialQuestion || sentInitial.current) return;
    sentInitial.current = true;
    router.replace("/ask", { scroll: false });
    void send(initialQuestion, { fresh: true });
  }, [loaded, initialQuestion, router, send]);

  const newChat = () => { abortRef.current?.abort(); setActiveId(null); setDrawer(false); setInput(""); boxRef.current?.focus(); };
  const open = (id: string) => { abortRef.current?.abort(); setActiveId(id); setDrawer(false); stick.current = true; };
  const rename = (id: string, title: string) => { const t = title.trim(); if (t) patch(id, (c) => ({ ...c, title: t.slice(0, 60) })); };
  const remove = (id: string) => { if (id === activeRef.current) { abortRef.current?.abort(); setActiveId(null); } setChats((cs) => cs.filter((c) => c.id !== id)); };
  const copy = async (text: string, i: number) => {
    try { await navigator.clipboard.writeText(text); setCopied(i); setTimeout(() => setCopied((c) => (c === i ? null : c)), 1500); } catch { /* clipboard blocked */ }
  };
  const retry = () => {
    const lastUser = [...messages].reverse().find((m) => m.role === "user");
    if (!lastUser || !active) return;
    // Drop the failed exchange, then ask again.
    const idx = active.messages.lastIndexOf(lastUser);
    const kept = active.messages.slice(0, idx);
    chatsRef.current = chatsRef.current.map((c) => (c.id === active.id ? { ...c, messages: kept } : c));
    void send(lastUser.content);
  };

  // Grow the box with the text, up to a few lines.
  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 160) + "px";
  }, [input]);

  const list = <ChatList chats={chats} activeId={activeId} onOpen={open} onNew={newChat} onRename={rename} onDelete={remove} />;
  const last = messages[messages.length - 1];
  const waiting = busy && last?.role === "assistant" && !last.content;

  return (
    <div className="flex flex-1 gap-8">
      {/* Sidebar: always visible on desktop */}
      <aside className="sticky top-24 hidden h-[calc(100dvh-8rem)] w-64 shrink-0 flex-col lg:flex" aria-label="Your chats">{list}</aside>

      {/* Drawer: phones and tablets */}
      {drawer && (
        <div className="fixed inset-0 z-50 flex lg:hidden" role="dialog" aria-modal="true" aria-label="Your chats">
          <div className="flex w-[84%] max-w-xs flex-col gap-3 border-r border-line bg-pitch p-4 pt-5">
            <div className="flex items-center justify-between">
              <span className="font-display text-2xl font-bold">Chats</span>
              <button type="button" onClick={() => setDrawer(false)} aria-label="Close" className="flex h-10 w-10 items-center justify-center rounded-xl border border-line text-soft"><Icon d="M18 6L6 18M6 6l12 12" size={18} /></button>
            </div>
            {list}
          </div>
          <button type="button" aria-label="Close chats" onClick={() => setDrawer(false)} className="flex-1 bg-black/60" />
        </div>
      )}

      <section className="flex min-w-0 flex-1 flex-col gap-5">
        <header className="flex items-center gap-2">
          <button type="button" onClick={() => setDrawer(true)} aria-label="Open your chats" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-line bg-card text-soft lg:hidden"><Icon d="M4 6h16M4 12h16M4 18h10" size={18} /></button>
          <h1 className={`min-w-0 flex-1 truncate font-display font-bold leading-none md:text-4xl ${active ? "text-xl" : "text-3xl"}`}>{active?.title ?? "Ask AI"}</h1>
          <button type="button" onClick={newChat} aria-label="New chat" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-line bg-card text-soft lg:hidden"><Icon d="M12 5v14M5 12h14" size={18} /></button>
        </header>

        {messages.length === 0 ? (
          <div className="flex flex-1 flex-col justify-center gap-5 py-6">
            <div className="flex flex-col gap-2">
              <p className="font-display text-4xl font-bold leading-none md:text-5xl">What do you want to know?</p>
              <p className="text-sm text-soft md:text-base">Ask anything about this Premier League season. Answers use the live table, the next fixtures and the top scorers.</p>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {examples.map((e) => (
                <button key={e} type="button" onClick={() => send(e)} className="rounded-xl border border-line bg-card px-4 py-3 text-left text-sm text-soft transition hover:border-lime/50 hover:text-ink">{e}</button>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex flex-1 flex-col gap-6" aria-live="polite">
            {messages.map((m, i) =>
              m.role === "user" ? (
                <div key={i} className="max-w-[85%] self-end rounded-2xl rounded-br-md bg-[#1e2632] px-4 py-2.5 text-[15px] whitespace-pre-wrap">{m.content}</div>
              ) : m.error ? (
                <div key={i} className="flex flex-col items-start gap-2">
                  <p className="rounded-2xl border border-[#8a2e2e] bg-[#8a2e2e]/15 px-4 py-3 text-sm text-[#ffb4b4]">{m.content}</p>
                  {i === messages.length - 1 && !busy && <button type="button" onClick={retry} className="text-sm font-semibold text-lime hover:underline">Try again</button>}
                </div>
              ) : (
                <div key={i} className="flex gap-3">
                  <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-lime" aria-hidden="true"><span className="h-3 w-3 rounded-full border-2 border-pitch" /></span>
                  <div className="flex min-w-0 flex-1 flex-col gap-2 text-[15px] text-soft">
                    {m.content ? (
                      <Markdown text={m.content} />
                    ) : (
                      <p className="flex items-center gap-2 pt-1 text-sm text-muted"><span className="h-2 w-2 animate-pulse rounded-full bg-lime" /> Analysing the numbers…</p>
                    )}
                    {m.content && !(busy && i === messages.length - 1) && (
                      <button type="button" onClick={() => copy(m.content, i)} className="flex h-8 w-fit items-center gap-1.5 rounded-lg px-2 text-xs text-muted transition hover:bg-card hover:text-ink">
                        <Icon d={copied === i ? "M20 6L9 17l-5-5" : "M9 9h11v11H9zM5 15H4V4h11v1"} size={14} /> {copied === i ? "Copied" : "Copy"}
                      </button>
                    )}
                  </div>
                </div>
              ),
            )}
            <div ref={endRef} className="h-px" />
          </div>
        )}

        <form
          onSubmit={(e) => { e.preventDefault(); void send(input); }}
          className="sticky bottom-20 z-[5] mt-auto flex items-end gap-2 rounded-2xl border border-[#2a3441] bg-card p-1.5 pl-4 shadow-[0_-12px_24px_#0b0f14] focus-within:border-lime/60 lg:bottom-4"
        >
          <label htmlFor="chat" className="sr-only">Your question</label>
          <textarea
            id="chat" ref={boxRef} rows={1} value={input} onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); void send(input); } }}
            placeholder="Ask about any team or stat"
            className="max-h-40 min-h-11 min-w-0 flex-1 resize-none bg-transparent py-2.5 text-sm outline-none placeholder:text-[#8a94a3]"
          />
          {busy ? (
            <button type="button" onClick={() => abortRef.current?.abort()} aria-label="Stop answering" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#1e2632] text-ink transition hover:brightness-125">
              <span className="h-3.5 w-3.5 rounded-[3px] bg-current" />
            </button>
          ) : (
            <button type="submit" disabled={!input.trim()} aria-label="Send question" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-lime text-pitch transition hover:brightness-110 active:scale-95 disabled:opacity-40">
              <Icon d="M12 19V5M5 12l7-7 7 7" size={18} />
            </button>
          )}
        </form>
        {waiting && <span className="sr-only" role="status">Answering…</span>}
      </section>
    </div>
  );
}
