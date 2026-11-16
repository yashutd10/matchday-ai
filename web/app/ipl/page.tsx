import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SeasonView } from "@/components/ipl-season";
import { getSeason, ipl } from "@/lib/ipl";

export const metadata: Metadata = { title: `IPL ${ipl.latest}` };

export default function IplHome() {
  const s = getSeason(ipl.latest);
  if (!s) notFound();
  return <SeasonView s={s} />;
}
