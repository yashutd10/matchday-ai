"use client";

import { useId, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { fold } from "@/lib/text";

export type SearchPlayer = { id: number; name: string; fullName: string; tla: string; pos: string; price: number };


/** Best matches first: surname/short name starts with it, then any name word starts with it, then anywhere. */
function rank(p: SearchPlayer, q: string) {
  const short = fold(p.name), full = fold(p.fullName);
  if (short.startsWith(q) || short.split(/[\s.\-']+/).some((w) => w.startsWith(q))) return 0;
  if (full.split(/[\s\-']+/).some((w) => w.startsWith(q))) return 1;
  if (short.includes(q) || full.includes(q)) return 2;
  return -1;
}

/**
 * Name box with live suggestions. Picking a suggestion opens that player's page;
 * pressing Enter without picking runs the normal filtered search.
 */
export function PlayerSearch({ players, defaultValue, className, placeholder = "Type a name, e.g. Bruno", id }: { players: SearchPlayer[]; defaultValue: string; className: string; placeholder?: string; id?: string }) {
  const router = useRouter();
  const [value, setValue] = useState(defaultValue);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const listId = useId();
  const box = useRef<HTMLDivElement>(null);

  const matches = useMemo(() => {
    const q = fold(value.trim());
    if (q.length < 2) return [];
    return players
      .map((p) => ({ p, r: rank(p, q) }))
      .filter((m) => m.r >= 0)
      .sort((a, b) => a.r - b.r || b.p.price - a.p.price)
      .slice(0, 6)
      .map((m) => m.p);
  }, [players, value]);

  const show = open && matches.length > 0;
  const pick = (p: SearchPlayer) => {
    setOpen(false);
    setValue(p.name);
    router.push(`/scouting/similar/${p.id}`);
  };

  return (
    <div ref={box} className="relative">
      <input
        name="q"
        value={value}
        autoComplete="off"
        spellCheck={false}
        id={id}
        placeholder={placeholder}
        role="combobox"
        aria-expanded={show}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={show && active >= 0 ? `${listId}-${active}` : undefined}
        className={`${className} w-full`}
        onChange={(e) => { setValue(e.target.value); setOpen(true); setActive(-1); }}
        onFocus={() => setOpen(true)}
        onBlur={(e) => { if (!box.current?.contains(e.relatedTarget as Node)) setOpen(false); }}
        onKeyDown={(e) => {
          if (!show) return;
          if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => (a + 1) % matches.length); }
          else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => (a <= 0 ? matches.length - 1 : a - 1)); }
          else if (e.key === "Enter" && active >= 0) { e.preventDefault(); pick(matches[active]); }
          else if (e.key === "Escape") setOpen(false);
        }}
      />
      {show && (
        <ul id={listId} role="listbox" className="absolute inset-x-0 top-full z-30 mt-1.5 overflow-hidden rounded-xl border border-line bg-card shadow-[0_12px_32px_rgba(0,0,0,0.45)]">
          {matches.map((p, i) => (
            <li
              key={p.id}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === active}
              onMouseDown={(e) => e.preventDefault()}
              onMouseEnter={() => setActive(i)}
              onClick={() => pick(p)}
              className={`flex cursor-pointer items-center gap-3 border-t border-line px-3 py-2.5 first:border-t-0 ${i === active ? "bg-[#1e2632]" : ""}`}
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-line bg-pitch text-[10px] font-bold text-soft">{p.tla}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold text-ink">{p.name}</span>
                <span className="block truncate text-xs text-muted">{p.fullName} · {p.pos}</span>
              </span>
              <span className="shrink-0 text-xs text-soft">£{p.price.toFixed(1)}m</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
