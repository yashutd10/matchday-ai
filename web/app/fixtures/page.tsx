import type { Metadata } from "next";
import { FixturesFor, FixturesShell } from "@/components/fixtures-view";

export const metadata: Metadata = { title: "Fixtures & Results" };

export default function FixturesPage() {
  return (
    <FixturesShell>
      <FixturesFor />
    </FixturesShell>
  );
}
