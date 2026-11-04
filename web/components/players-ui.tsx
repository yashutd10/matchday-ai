import Link from "next/link";
import type { Player, Status } from "@/lib/players";

const tabs = [
  { key: "leaders", href: "/stats", label: "Leaderboards" },
  { key: "search", href: "/scouting", label: "Scouting" },
  { key: "similar", href: "/scouting/similar", label: "Replacement finder" },
  { key: "needs", href: "/scouting/team", label: "Team needs" },
] as const;
export type PlayersTab = (typeof tabs)[number]["key"];

export function PlayersTabs({ active }: { active: PlayersTab }) {
  return (
    <nav aria-label="Players sections">
      <div className="grid grid-cols-2 gap-1 rounded-2xl border border-line bg-card p-1 md:flex md:w-max">
        {tabs.map((t) => (
          <Link
            key={t.key}
            href={t.href}
            aria-current={active === t.key ? "page" : undefined}
            className={`flex h-11 items-center justify-center whitespace-nowrap rounded-xl px-3 text-sm font-semibold transition md:px-4 ${active === t.key ? "bg-lime text-pitch" : "text-soft hover:text-ink"}`}
          >
            {t.label}
          </Link>
        ))}
      </div>
    </nav>
  );
}

export function PlayersHeader({ title, intro, active }: { title: string; intro: string; active: PlayersTab }) {
  return (
    <>
      <div className="flex flex-col gap-2">
        <h1 className="font-display text-4xl font-bold leading-none md:text-6xl">{title}</h1>
        <p className="max-w-3xl text-sm text-soft md:text-base">{intro}</p>
      </div>
      <PlayersTabs active={active} />
    </>
  );
}

const statusStyle: Record<Status, { c: string; l: string }> = {
  available: { c: "bg-[#5ad08f]", l: "Available" },
  doubtful: { c: "bg-[#f5c451]", l: "Doubtful" },
  injured: { c: "bg-[#ff6b6b]", l: "Injured" },
  suspended: { c: "bg-[#ff6b6b]", l: "Suspended" },
  unavailable: { c: "bg-[#5b6573]", l: "Unavailable" },
};
export function StatusDot({ p }: { p: Player }) {
  const s = statusStyle[p.status];
  return <span className={`inline-block h-2 w-2 shrink-0 rounded-full ${s.c}`} title={p.news || s.l} aria-label={s.l} />;
}

export function ScoreBar({ score }: { score: number }) {
  const tone = score >= 80 ? "bg-lime" : score >= 60 ? "bg-home" : "bg-[#5b6573]";
  return (
    <div className="flex items-center gap-2" aria-label={`Scout score ${score} out of 100`}>
      <div className="hidden h-1.5 w-16 overflow-hidden rounded-full bg-[#1e2632] sm:block"><div className={`h-full rounded-full ${tone}`} style={{ width: `${score}%` }} /></div>
      <span className="w-6 text-right font-display text-base font-bold">{score}</span>
    </div>
  );
}

export const playerHref = (id: number) => `/scouting/similar/${id}`;
export const money = (n: number) => `£${n.toFixed(1)}m`;

export function NeedsData() {
  return <p className="text-soft">Player data comes from the Fantasy Premier League feed, which couldn&apos;t be reached just now. Try again in a minute.</p>;
}
