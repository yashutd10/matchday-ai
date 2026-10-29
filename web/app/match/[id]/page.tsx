import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getFixture, getMatchday } from "@/lib/football";
import { Crest, FormRow, ProbBar, StatBar } from "@/components/ui";

export async function generateStaticParams() {
  const { fixtures } = await getMatchday();
  return fixtures.map((f) => ({ id: f.id }));
}

type Params = Promise<{ id: string }>;

export default function MatchPage({ params }: { params: Params }) {
  return (
    <Suspense fallback={<PreviewSkeleton />}>
      <MatchPreview params={params} />
    </Suspense>
  );
}

function PreviewSkeleton() {
  return (
    <main className="mx-auto flex w-full flex-1 max-w-5xl animate-pulse flex-col gap-5 p-5 md:p-10" aria-busy="true">
      <div className="h-11 w-11 rounded-xl bg-card" />
      <div className="mx-auto h-24 w-full rounded-2xl bg-card" />
      <div className="h-2 w-full rounded-full bg-card" />
      <div className="h-44 w-full rounded-[18px] bg-card" />
      <div className="h-24 w-full rounded-2xl bg-card" />
    </main>
  );
}

async function MatchPreview({ params }: { params: Params }) {
  const { id } = await params;
  const { fixture: f, source } = await getFixture(id);
  if (!f) notFound();

  return (
    <main className="mx-auto flex w-full flex-1 max-w-5xl flex-col gap-5 p-5 md:gap-8 md:p-10">
      <header className="flex items-center justify-between">
        <Link href="/" aria-label="Back to fixtures" className="flex h-11 w-11 items-center justify-center rounded-xl border border-line bg-card text-soft">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M19 12H5" /><path d="M11 18l-6-6 6-6" /></svg>
        </Link>
        <span className="text-sm text-muted">{f.kickoff}</span>
        <div className="w-11" />
      </header>

      <section className="mx-auto flex w-full max-w-2xl items-center justify-between px-2">
        <div className="flex w-24 flex-col items-center gap-2">
          <Crest team={f.home} size="lg" ring="#4c8dff" />
          <span className="text-sm font-semibold">{f.home.name}</span>
        </div>
        <div className="flex flex-col items-center gap-1">
          <span className="text-[11px] tracking-wider text-muted">AI PREDICTION</span>
          <span className="font-display text-6xl font-bold leading-none text-lime md:text-8xl">{f.prediction[0]} – {f.prediction[1]}</span>
          <span className="text-[11px] text-muted">Confidence: {f.confidence.toLowerCase()}</span>
        </div>
        <div className="flex w-24 flex-col items-center gap-2">
          <Crest team={f.away} size="lg" ring="#ff9a52" />
          <span className="text-sm font-semibold">{f.away.name}</span>
        </div>
      </section>

      <div className="mx-auto w-full max-w-2xl"><ProbBar probs={f.probs} labels={[f.home.name, f.away.name]} /></div>

      <div className="grid gap-5 md:grid-cols-2 md:gap-8">

      <section className="flex flex-col gap-3 rounded-[18px] border border-line bg-card p-4">
        <h2 className="flex items-center gap-2 font-display text-xl font-bold">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#c6f432" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z" /></svg>
          Why the AI thinks so
        </h2>
        <ol className="flex flex-col gap-2.5 text-sm leading-relaxed text-soft">
          {f.reasons.map((r, i) => (
            <li key={i} className="flex gap-2.5">
              <span className="font-semibold text-lime">0{i + 1}</span>
              <span>{r}</span>
            </li>
          ))}
        </ol>
      </section>

      <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-2.5">
        <h2 className="font-display text-xl font-bold">Last 5 matches</h2>
        <FormRow name={f.home.name} form={f.form.home} />
        <FormRow name={f.away.name} form={f.form.away} />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-display text-xl font-bold">Season stats</h2>
        {f.stats.map((s) => (
          <StatBar key={s.label} {...s} />
        ))}
      </section>
      </div>
      </div>

      <p className="mt-auto text-center text-[11px] text-[#8a94a3]">{source === "live" ? "Predictions from a simple stats model" : "Sample data for design only"} · not betting advice</p>
    </main>
  );
}
