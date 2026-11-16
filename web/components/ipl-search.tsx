"use client";

import { useId, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { fold } from "@/lib/text";

export type SearchItem = { label: string; sub: string; href: string };

/** Search box with live suggestions; picking one opens its page. */
export function IplSearch({ items, placeholder, defaultValue = "" }: { items: SearchItem[]; placeholder: string; defaultValue?: string }) {
  const router = useRouter();
  const [value, setValue] = useState(defaultValue);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const listId = useId();
  const box = useRef<HTMLDivElement>(null);

  const matches = useMemo(() => {
    const q = fold(value.trim());
    if (q.length < 2) return [];
    const rank = (label: string) => {
      const l = fold(label);
      return l.split(/[\s.\-']+/).some((w) => w.startsWith(q)) ? 0 : l.includes(q) ? 1 : -1;
    };
    return items.map((it) => ({ it, r: rank(it.label) })).filter((m) => m.r >= 0).sort((a, b) => a.r - b.r).slice(0, 7).map((m) => m.it);
  }, [items, value]);

  const show = open && matches.length > 0;
  const pick = (it: SearchItem) => { setOpen(false); setValue(it.label); router.push(it.href); };

  return (
    <div ref={box} className="relative">
      <input
        value={value} autoComplete="off" spellCheck={false} placeholder={placeholder} aria-label={placeholder}
        role="combobox" aria-expanded={show} aria-controls={listId} aria-autocomplete="list"
        className="h-12 w-full rounded-xl border border-line bg-card px-4 text-sm text-ink outline-none placeholder:text-[#8a94a3] focus:border-lime/60"
        onChange={(e) => { setValue(e.target.value); setOpen(true); setActive(-1); }}
        onFocus={() => setOpen(true)}
        onBlur={(e) => { if (!box.current?.contains(e.relatedTarget as Node)) setOpen(false); }}
        onKeyDown={(e) => {
          if (!show) return;
          if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => (a + 1) % matches.length); }
          else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => (a <= 0 ? matches.length - 1 : a - 1)); }
          else if (e.key === "Enter") { e.preventDefault(); pick(matches[Math.max(active, 0)]); }
          else if (e.key === "Escape") setOpen(false);
        }}
      />
      {show && (
        <ul id={listId} role="listbox" className="absolute inset-x-0 top-full z-30 mt-1.5 overflow-hidden rounded-xl border border-line bg-card shadow-[0_12px_32px_rgba(0,0,0,0.45)]">
          {matches.map((it, i) => (
            <li key={it.href} role="option" aria-selected={i === active} onMouseDown={(e) => e.preventDefault()} onMouseEnter={() => setActive(i)} onClick={() => pick(it)}
              className={`flex cursor-pointer items-center justify-between gap-3 border-t border-line px-4 py-2.5 first:border-t-0 ${i === active ? "bg-[#1e2632]" : ""}`}>
              <span className="truncate text-sm font-semibold">{it.label}</span>
              <span className="shrink-0 text-xs text-muted">{it.sub}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
