"use client";

import { useId, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { fold, nameMatch } from "@/lib/text";

/** alt: another name to match on (the full name, when the label is a scorecard name). */
export type SearchItem = { label: string; sub: string; href: string; alt?: string };

/** Search box with live suggestions; picking one opens its page. */
/** elsewhere: the same people in another list (e.g. bowlers, when this box is for batters), offered when nothing here matches. */
export function IplSearch({ items, placeholder, defaultValue = "", name, className, elsewhere, elsewhereLabel }: { items: SearchItem[]; placeholder: string; defaultValue?: string; name?: string; className?: string; elsewhere?: SearchItem[]; elsewhereLabel?: string }) {
  const router = useRouter();
  const [value, setValue] = useState(defaultValue);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const listId = useId();
  const box = useRef<HTMLDivElement>(null);

  const q = fold(value.trim());
  const typed = q.length >= 2 && value !== defaultValue;
  const { matches, moved } = useMemo(() => {
    if (q.length < 2) return { matches: [], moved: false };
    const best = (it: SearchItem) => {
      const a = nameMatch(q, it.label), b = it.alt ? nameMatch(q, it.alt) : -1;
      return a < 0 ? b : b < 0 ? a : Math.min(a, b);
    };
    const find = (list: SearchItem[]) => list.map((it, i) => ({ it, i, r: best(it) })).filter((m) => m.r >= 0).sort((a, b) => a.r - b.r || a.i - b.i);
    const here = find(items);
    // Nothing close here (a typo-level match at best) but an exact name in the other list: offer that.
    if (elsewhere && (here.length === 0 || here[0].r === 2)) {
      const there = find(elsewhere).filter((m) => m.r < 2);
      if (there.length) return { matches: there.slice(0, 5).map((m) => m.it), moved: true };
    }
    return { matches: here.slice(0, 7).map((m) => m.it), moved: false };
  }, [items, elsewhere, q]);

  const show = open && matches.length > 0;
  const none = open && typed && matches.length === 0;
  const pick = (it: SearchItem) => { setOpen(false); setValue(it.alt ?? it.label); router.push(it.href); };

  return (
    <div ref={box} className="relative">
      <input
        name={name} value={value} autoComplete="off" spellCheck={false} placeholder={placeholder} aria-label={placeholder}
        role="combobox" aria-expanded={show} aria-controls={listId} aria-autocomplete="list"
        className={className ?? "h-12 w-full rounded-xl border border-line bg-card px-4 text-sm text-ink outline-none placeholder:text-[#8a94a3] focus:border-lime/60"}
        onChange={(e) => { setValue(e.target.value); setOpen(true); setActive(-1); }}
        onFocus={() => setOpen(true)}
        onBlur={(e) => {
          if (box.current?.contains(e.relatedTarget as Node)) return;
          setOpen(false);
          // A pick box (not a filter form): text that wasn't picked would sit there looking applied, so put back what's shown.
          if (!name) setValue(defaultValue);
        }}
        onKeyDown={(e) => {
          if (!show) return;
          if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => (a + 1) % matches.length); }
          else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => (a <= 0 ? matches.length - 1 : a - 1)); }
          // In a filter form, Enter without a highlighted suggestion filters the list instead.
          else if (e.key === "Enter" && (active >= 0 || !name)) { e.preventDefault(); pick(matches[Math.max(active, 0)]); }
          else if (e.key === "Escape") setOpen(false);
        }}
      />
      {none && !name && (
        <p className="absolute inset-x-0 top-full z-30 mt-1.5 rounded-xl border border-line bg-card px-4 py-3 text-sm text-soft shadow-[0_12px_32px_rgba(0,0,0,0.45)]">No one called &ldquo;{value.trim()}&rdquo; here.</p>
      )}
      {show && (
        <ul id={listId} role="listbox" className="absolute top-full left-0 z-30 mt-1.5 w-full min-w-64 overflow-hidden rounded-xl border border-line bg-card shadow-[0_12px_32px_rgba(0,0,0,0.45)]">
          {moved && <li className="px-4 py-2 text-[11px] text-muted">{elsewhereLabel ?? "Found in the other list"}</li>}
          {matches.map((it, i) => (
            <li key={it.href} role="option" aria-selected={i === active} onMouseDown={(e) => e.preventDefault()} onMouseEnter={() => setActive(i)} onClick={() => pick(it)}
              className={`flex cursor-pointer flex-col border-t border-line px-4 py-2.5 first:border-t-0 ${i === active ? "bg-[#1e2632]" : ""}`}>
              <span className="truncate text-sm font-semibold">{it.alt ?? it.label}</span>
              <span className="truncate text-[11px] text-muted">{[it.alt && it.alt !== it.label ? it.label : "", it.sub].filter(Boolean).join(" · ")}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
