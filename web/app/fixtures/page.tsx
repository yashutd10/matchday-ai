import { Suspense } from "react";
import type { Metadata } from "next";
import { FixturesFor, FixturesShell } from "@/components/fixtures-view";

export const metadata: Metadata = { title: "Fixtures & Results" };

export default function FixturesPage() {
  return (
    <FixturesShell>
      <Suspense fallback={<div className="h-96 animate-pulse rounded-2xl bg-card" aria-busy="true" aria-label="Loading fixtures" />}>
        <FixturesFor />
      </Suspense>
    </FixturesShell>
  );
}
