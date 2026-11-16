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

export default async function IplSeasonPage({ params }: { params: Params }) {
  const s = getSeason(Number((await params).season));
  if (!s) notFound();
  return <SeasonView s={s} />;
}
