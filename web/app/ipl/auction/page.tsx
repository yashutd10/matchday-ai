import { Suspense } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { card, main, PageHeader, PlayerName, TeamBadge } from "@/components/ipl-ui";
import { teamColor, teamName } from "@/lib/ipl";
import { areaKey, areaStat, displayName, planTeams, plans, pool, type AreaReport, type SquadPlayer, type Target } from "@/lib/ipl-auction";

export const metadata: Metadata = { title: "IPL 2027 auction planner" };

type SP = Promise<Record<string, string | string[] | undefined>>;
const cr = (n: number) => `₹${n % 1 === 0 ? n : n.toFixed(2).replace(/0$/, "")} cr`;
const nth = (n: number) => `${n}${n === 1 ? "st" : n === 2 ? "nd" : n === 3 ? "rd" : "th"}`;
const tone = (rank: number) => (rank <= 3 ? "border-lime/50 bg-lime/5" : rank >= 8 ? "border-[#ff9a52]/50 bg-[#ff9a52]/5" : "border-line bg-[#10161d]");

function Name({ sp }: { sp: SquadPlayer }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      {sp.p ? <PlayerName name={sp.p.name} className="font-semibold" /> : <span className="font-semibold">{sp.name}</span>}
      {sp.overseas && <span className="rounded bg-[#1e2632] px-1 text-[10px] font-semibold text-soft" title="Overseas player">OS</span>}
    </span>
  );
}

function AreaCard({ a, need }: { a: AreaReport; need: boolean }) {
  return (
    <div className={`flex flex-col gap-2 rounded-xl border p-3.5 ${tone(a.rank)}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-col"><span className="text-sm font-semibold">{a.label}</span><span className="text-[11px] text-muted">{a.short}</span></div>
        <div className="flex flex-col items-end"><span className="font-display text-2xl font-bold leading-none">{nth(a.rank)}</span><span className="text-[10px] text-muted">of 10</span></div>
      </div>
      {need && <span className="self-start rounded-full bg-[#ff9a52] px-2 py-0.5 text-[10px] font-bold text-pitch">PRIORITY</span>}
      <ul className="flex flex-col gap-0.5 text-xs text-soft">
        {a.best.length ? a.best.map(({ sp, r }) => <li key={sp.name} className="flex justify-between gap-2"><span className="truncate">{displayName(sp)}</span><span className="font-semibold text-ink">{r}</span></li>)
          : <li className="text-muted">No retained player rated here</li>}
        {a.best.length > 0 && a.best.length < a.depth && <li className="text-muted">Only {a.best.length} rated for {a.depth} spots</li>}
      </ul>
    </div>
  );
}

function TargetRow({ t, own }: { t: Target; own: string }) {
  const p = t.sp.p!;
  return (
    <li className="flex items-center justify-between gap-3 border-t border-line px-4 py-2.5 first:border-t-0">
      <div className="flex min-w-0 flex-col">
        <Name sp={t.sp} />
        <span className="truncate text-[11px] text-muted">{areaStat(p, t.area)} · released by {t.from === own ? <b className="text-soft">them</b> : t.from}</span>
      </div>
      <span className="flex h-8 min-w-9 shrink-0 items-center justify-center rounded-lg bg-[#1e2632] px-2 font-display text-lg font-bold">{t.r}</span>
    </li>
  );
}

async function Body({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const asked = String(sp.team ?? "").toUpperCase();
  const code = planTeams.includes(asked) ? asked : planTeams[0];
  const plan = plans[code];
  const needKeys = new Set(plan.needs.map(areaKey));
  const poolRated = pool.filter((x) => x.sp.p).length;

  return (
    <>
      <nav aria-label="Choose a team" className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:flex-wrap md:px-0">
        {planTeams.map((c) => (
          <Link key={c} href={`/ipl/auction?team=${c}`} scroll={false} aria-current={c === code ? "page" : undefined}
            className={`flex shrink-0 items-center gap-2 rounded-xl border px-2.5 py-1.5 text-sm font-semibold transition ${c === code ? "border-lime/60 bg-card text-ink" : "border-line text-muted hover:text-ink"}`}>
            <TeamBadge code={c} size="sm" />{c}
          </Link>
        ))}
      </nav>

      <section className={`${card} flex flex-col gap-4 p-5`} style={{ boxShadow: `inset 4px 0 0 ${teamColor(code)}` }}>
        <div className="flex items-center gap-3"><TeamBadge code={code} size="lg" /><div className="flex flex-col"><h2 className="font-display text-2xl font-bold leading-tight md:text-3xl md:leading-none">{teamName(code)}</h2><span className="text-sm text-muted">Going into the IPL 2027 auction</span></div></div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[["Purse left", cr(plan.purse)], ["Slots to fill", plan.slots], ["Overseas slots", plan.overseasSlots], ["Per slot, on average", plan.slots ? cr(Math.round(plan.perSlot * 100) / 100) : "–"]].map(([l, v]) => (
            <div key={l} className="flex flex-col rounded-xl bg-[#10161d] px-3 py-2.5"><span className="text-[11px] text-muted">{l}</span><span className="font-display text-2xl font-bold leading-tight">{v}</span></div>
          ))}
        </div>
        <p className="text-sm text-soft">
          Biggest gaps: <b className="text-ink">{plan.needs[0].label.toLowerCase()}</b> ({nth(plan.needs[0].rank)} of 10) and <b className="text-ink">{plan.needs[1].label.toLowerCase()}</b> ({nth(plan.needs[1].rank)} of 10).
          {plan.overseasSlots === 0 && " With no overseas slots left, every target has to be Indian."}
        </p>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-display text-2xl font-bold">Retained squad, area by area</h2>
        <p className="-mt-1 text-sm text-soft">Each box rates the best retained players in that job (0–99, from the last three IPL seasons) and ranks the squad against the other nine. Green is top three, orange is bottom three.</p>
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
          {plan.areas.map((a) => <AreaCard key={areaKey(a)} a={a} need={needKeys.has(areaKey(a))} />)}
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-display text-2xl font-bold">Who to target</h2>
        <p className="-mt-1 text-sm text-soft">The best-rated players in the auction pool for {code}&apos;s two biggest gaps.{plan.overseasSlots === 0 ? " Overseas players are left out: no slots." : ""} No prices: auction values aren&apos;t predictable from these numbers, so plan around who fits.</p>
        <div className="grid gap-4 lg:grid-cols-2">
          {plan.needs.map((a) => (
            <div key={areaKey(a)} className="flex flex-col gap-2">
              <h3 className="text-sm font-semibold">{a.label}</h3>
              {plan.targets[areaKey(a)].length ? (
                <ul className={`${card} overflow-clip`}>{plan.targets[areaKey(a)].map((t) => <TargetRow key={t.sp.name} t={t} own={code} />)}</ul>
              ) : null}
              {(plan.targets[areaKey(a)][0]?.r ?? 0) < 40 && (
                <p className="text-xs leading-relaxed text-[#f5c451]">Thin pool: no proven {a.short.toLowerCase()} were released. Expect {code} to look at unsold players, first-timers and domestic form here, or to cover it from the retained squad.</p>
              )}
            </div>
          ))}
        </div>
      </section>

      {plan.radar.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="font-display text-2xl font-bold">Under the radar</h2>
          <p className="-mt-1 text-sm text-soft">Indian players with fewer than 30 IPL matches who already rate well in a gap {code} needs to fill. Usually cheaper than the big names.</p>
          <ul className={`${card} overflow-clip`}>{plan.radar.map((t) => <TargetRow key={t.sp.name} t={t} own={code} />)}</ul>
        </section>
      )}

      <section className="flex flex-col gap-3">
        <h2 className="font-display text-2xl font-bold">Retained players ({plan.retained.length})</h2>
        <ul className="grid gap-x-6 gap-y-1.5 sm:grid-cols-2 lg:grid-cols-3">
          {plan.retained.map((s) => (
            <li key={s.name} className="flex items-center justify-between gap-2 border-b border-line py-1.5 text-sm">
              <span className="flex min-w-0 items-center gap-1.5"><Name sp={s} />{s.traded && <span className="text-[10px] text-muted">traded in</span>}</span>
              <span className="shrink-0 text-[11px] text-muted">{s.p ? [s.p.type.bat, s.p.type.bowl].filter(Boolean).join(" · ") || "Few balls lately" : "No IPL rating yet"}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className={`${card} flex flex-col gap-2 p-5 text-sm leading-relaxed text-soft`}>
        <h2 className="font-display text-2xl font-bold text-ink">How this works</h2>
        <p>Each area takes a squad&apos;s best retained players in that job (two openers, three middle-order batters, two finishers, two bowlers per phase) and averages their ratings. An empty spot counts as zero, because nobody proven fills it. Players without enough recent IPL balls ({plan.unrated.length} in this squad, mostly young or new) can&apos;t be rated, so a squad full of untested talent will look weaker than it may be.</p>
        <p>The pool is the {pool.length} players released this month ({poolRated} with IPL ratings). Unsold players from past auctions and first-time entrants will also be in the auction but aren&apos;t listed here.</p>
        <p className="text-xs text-muted">Retentions, purses and slots as announced in November 2026 (The Federal, Sunday Guardian). OS = overseas.</p>
      </section>
    </>
  );
}

export default function AuctionPage({ searchParams }: { searchParams: SP }) {
  return (
    <main className={main}>
      <PageHeader title="Auction planner" intro="IPL 2027: what each squad still needs after retentions, how much it has to spend, and who in the auction pool fits." />
      <Suspense fallback={<div className="h-96 animate-pulse rounded-[18px] bg-card" aria-busy="true" aria-label="Loading auction planner" />}>
        <Body searchParams={searchParams} />
      </Suspense>
    </main>
  );
}
