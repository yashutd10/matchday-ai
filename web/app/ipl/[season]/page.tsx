import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SeasonView } from "@/components/ipl-season";
import { getSeason, seasonYears } from "@/lib/ipl";

type Params = Promise<{ season: string }>;

export function generateStaticParams() {
  return seasonYears.map((y) => ({ season: String(y) }));
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  return { title: `IPL ${(await params).season}` };
}

async function IplSeasonPageBody({ params }: { params: Params }) {
  const s = getSeason(Number((await params).season));
  if (!s) notFound();
  return <SeasonView s={s} />;
}

/** Loading placeholder; the page reads the URL, so it streams in under this. */
function Loading() {
  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 animate-pulse flex-col gap-6 px-5 pt-8 pb-10 md:px-8 md:pt-12" aria-busy="true" aria-label="Loading">
      <div className="h-28 rounded-[20px] bg-card" />
      <div className="h-64 rounded-[18px] bg-card" />
      <div className="h-64 rounded-[18px] bg-card" />
    </main>
  );
}

export default function IplSeasonPage({ params }: { params: Params }) {
  return (
    <Suspense fallback={<Loading />}>
      <IplSeasonPageBody params={params} />
    </Suspense>
  );
}
