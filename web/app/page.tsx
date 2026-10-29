import Link from "next/link";
import { getMatchday } from "@/lib/football";
import { Crest, ProbBar } from "@/components/ui";
import { AskBox, Icon } from "@/components/nav";
import { YourTeamCard } from "@/components/favourite";

export default async function Home() {
  const { fixtures, gameweek, source } = await getMatchday();
  const [pick, ...rest] = fixtures;

  return (
    <div className="flex flex-1 flex-col">

      <main className="mx-auto w-full max-w-6xl flex-1 px-5 pt-6 pb-8 md:px-8 md:pt-10">
        <div className="mb-6 flex items-end justify-between md:mb-8">
          <div>
            <p className="text-sm text-muted md:text-base">Gameweek {gameweek.number} · {gameweek.date}</p>
            <h1 className="font-display text-4xl font-bold leading-none md:text-6xl">This Weekend</h1>
          </div>
          <span className={`rounded-full border px-2.5 py-1 text-[11px] md:text-xs ${source === "live" ? "border-lime/40 text-lime" : "border-[#2a3441] text-muted"}`}>
            {source === "live" ? "Live data" : "Sample data"}
          </span>
        </div>

        <div className="grid gap-6 md:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] md:gap-8">
          <div className="flex flex-col gap-6 md:sticky md:top-28 md:self-start">
            <section className="flex flex-col gap-4 rounded-[20px] border border-line bg-card p-[18px] md:gap-5 md:p-6">
              <div className="flex items-center justify-between">
                <span className="rounded-full bg-lime px-2.5 py-1 text-[11px] font-semibold tracking-wider text-pitch">AI PICK OF THE WEEK</span>
                <span className="text-sm text-muted">{pick.kickoff}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex w-24 flex-col items-center gap-2 md:w-28">
                  <Crest team={pick.home} size="lg" />
                  <span className="text-center text-sm font-semibold md:text-base">{pick.home.name}</span>
                </div>
                <div className="flex flex-col items-center">
                  <span className="text-[11px] tracking-wider text-muted">PREDICTED</span>
                  <span className="font-display text-5xl font-bold leading-none md:text-7xl">{pick.prediction[0]} – {pick.prediction[1]}</span>
                </div>
                <div className="flex w-24 flex-col items-center gap-2 md:w-28">
                  <Crest team={pick.away} size="lg" />
                  <span className="text-center text-sm font-semibold md:text-base">{pick.away.name}</span>
                </div>
              </div>
              <ProbBar probs={pick.probs} labels={["Home", "Away"]} />
              <p className="text-sm leading-relaxed text-soft md:text-base">{pick.summary}</p>
              <Link href={`/match/${pick.id}`} className="flex h-12 items-center justify-center gap-2 rounded-[14px] bg-lime font-semibold text-pitch transition hover:brightness-110 active:scale-[0.98]">
                Read full preview
                <Icon d="M5 12h14M13 6l6 6-6 6" size={18} />
              </Link>
            </section>

            <AskBox />
          </div>

          <section className="flex flex-col gap-3">
            <YourTeamCard fixtures={fixtures} />
            <div className="flex items-center justify-between">
              <h2 className="font-display text-[22px] font-bold md:text-3xl">All fixtures</h2>
              <span className="text-sm text-lime">{fixtures.length} matches</span>
            </div>
            <ul className="grid gap-2.5 lg:grid-cols-2 lg:gap-3">
              {rest.map((f) => (
                <li key={f.id}>
                  <Link href={`/match/${f.id}`} className="flex h-full items-center gap-3 rounded-2xl border border-line bg-card px-4 py-3.5 transition hover:-translate-y-0.5 hover:border-[#3a4656]">
                    <div className="flex min-w-0 flex-1 flex-col gap-1">
                      <span className="truncate text-[15px] font-semibold">
                        {f.home.name} <span className="font-normal text-muted">vs</span> {f.away.name}
                      </span>
                      <span className="text-xs text-muted">{f.kickoff}</span>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <span className="font-display text-[22px] font-bold leading-none">{f.prediction[0]} – {f.prediction[1]}</span>
                      <span className="text-[11px] text-muted">{f.confidence} confidence</span>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </main>

    </div>
  );
}
