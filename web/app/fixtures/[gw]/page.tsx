import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { FixturesFor, FixturesShell } from "@/components/fixtures-view";

type Params = Promise<{ gw: string }>;

export function generateStaticParams() {
  return Array.from({ length: 38 }, (_, i) => ({ gw: String(i + 1) }));
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { gw } = await params;
  return { title: `Gameweek ${gw} · Fixtures & Results` };
}

async function Week({ params }: { params: Params }) {
  const n = Number((await params).gw);
  if (!Number.isInteger(n) || n < 1 || n > 38) notFound();
  return <FixturesFor gw={n} />;
}

export default function GameweekPage({ params }: { params: Params }) {
  return (
    <FixturesShell>
      <Suspense fallback={<div className="h-96 animate-pulse rounded-2xl bg-card" />}>
        <Week params={params} />
      </Suspense>
    </FixturesShell>
  );
}
