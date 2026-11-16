import { Suspense } from "react";
import { AskChat } from "@/components/ask-chat";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Ask AI" };

async function Chat({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams;
  return <AskChat initialQuestion={q ?? ""} />;
}

export default function AskPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-5 pt-6 pb-6 md:px-8 md:pt-10">
      <Suspense fallback={<AskChat />}>
        <Chat searchParams={searchParams} />
      </Suspense>
    </main>
  );
}
