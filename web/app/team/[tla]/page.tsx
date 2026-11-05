import { LiveDataError } from "@/components/live-data-error";
import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTeamCodes, getTeamPage } from "@/lib/football";
import { TeamView } from "@/components/team-view";

type Params = Promise<{ tla: string }>;

export async function generateStaticParams() {
  const codes = await getTeamCodes();
  return (codes.length ? codes : ["ARS"]).map((c) => ({ tla: c.toLowerCase() }));
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { tla } = await params;
  return { title: tla.toUpperCase() };
}

async function Team({ params }: { params: Params }) {
  const { tla } = await params;
  const data = await getTeamPage(tla);
  if (data === undefined) notFound();
  if (data === null) return <LiveDataError what="Team pages" />;
  return <TeamView t={data} />;
}

export default function TeamPageRoute({ params }: { params: Params }) {
  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-5 pt-8 pb-10 md:px-8 md:pt-12">
      <Suspense fallback={<div className="h-[600px] animate-pulse rounded-2xl bg-card" aria-busy="true" aria-label="Loading team" />}>
        <Team params={params} />
      </Suspense>
    </main>
  );
}
