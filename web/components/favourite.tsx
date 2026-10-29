"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import type { Fixture } from "@/lib/fixtures";

const KEY = "matchday:favourite-team";
const EVENT = "matchday:favourite-change";

function read(): string {
  try { return localStorage.getItem(KEY) ?? ""; } catch { return ""; }
}
function subscribe(cb: () => void) {
  window.addEventListener(EVENT, cb);
  window.addEventListener("storage", cb);
  return () => { window.removeEventListener(EVENT, cb); window.removeEventListener("storage", cb); };
}
export function useFavourite() {
  return useSyncExternalStore(subscribe, read, () => "");
}
export function setFavourite(tla: string) {
  try { localStorage.setItem(KEY, tla); } catch {}
  window.dispatchEvent(new Event(EVENT));
}

export function TeamPicker({ teams }: { teams: { name: string; tla: string }[] }) {
  const fav = useFavourite();
  const current = teams.find((t) => t.tla === fav);
  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-soft">
        {current ? <>Your team: <span className="font-semibold text-lime">{current.name}</span></> : "No team picked yet."}
      </p>
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4">
        {teams.map((t) => {
          const active = t.tla === fav;
          return (
            <button
              key={t.tla}
              type="button"
              aria-pressed={active}
              onClick={() => setFavourite(active ? "" : t.tla)}
              className={`flex items-center gap-3 rounded-2xl border px-3 py-3 text-left transition active:scale-[0.98] ${active ? "border-lime bg-lime/10" : "border-line bg-card hover:border-[#3a4656]"}`}
            >
              <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full font-display text-sm font-bold ${active ? "bg-lime text-pitch" : "bg-[#1e2632]"}`}>{t.tla}</span>
              <span className="truncate text-sm font-semibold">{t.name}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function YourTeamCard({ fixtures }: { fixtures: Fixture[] }) {
  const fav = useFavourite();
  if (!fav) {
    return (
      <Link href="/profile" className="flex items-center justify-between rounded-2xl border border-dashed border-[#2a3441] px-4 py-3 text-sm text-muted transition hover:border-lime/50 hover:text-ink">
        Pick your team to see their match first
        <span aria-hidden="true">→</span>
      </Link>
    );
  }
  const f = fixtures.find((x) => x.home.short === fav || x.away.short === fav);
  if (!f) {
    return <p className="rounded-2xl border border-line bg-card px-4 py-3 text-sm text-muted">Your team doesn&apos;t play this gameweek.</p>;
  }
  return (
    <Link href={`/match/${f.id}`} className="flex items-center gap-3 rounded-2xl border border-lime/50 bg-lime/5 px-4 py-3.5 transition hover:bg-lime/10">
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="text-[11px] font-semibold tracking-wider text-lime">YOUR TEAM</span>
        <span className="truncate text-[15px] font-semibold">{f.home.name} <span className="font-normal text-muted">vs</span> {f.away.name}</span>
        <span className="text-xs text-muted">{f.kickoff}</span>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1">
        <span className="font-display text-[22px] font-bold leading-none">{f.prediction[0]} – {f.prediction[1]}</span>
        <span className="text-[11px] text-muted">{f.confidence} confidence</span>
      </div>
    </Link>
  );
}
