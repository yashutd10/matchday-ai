import type { Metadata, Viewport } from "next";
import { Inter, Barlow_Condensed } from "next/font/google";
import "./globals.css";
import { Suspense } from "react";
import { TopBar, TopBarView, BottomNav, BottomNavView } from "@/components/nav";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });
const barlow = Barlow_Condensed({
  variable: "--font-barlow",
  subsets: ["latin"],
  weight: ["600", "700"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://matchday-ai-theta.vercel.app"),
  title: { default: "Matchday AI", template: "%s · Matchday AI" },
  description: "Premier League predictions you can actually check: match previews, live table, player stats and a backtested accuracy tracker. Kickoffs in IST.",
  openGraph: { siteName: "Matchday AI", type: "website" },
};

export const viewport: Viewport = { themeColor: "#0b0f14" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${barlow.variable} antialiased`} suppressHydrationWarning>
      <body className="flex min-h-screen flex-col font-sans">
        <Suspense fallback={<TopBarView path="" />}>
          <TopBar />
        </Suspense>
        <div className="flex flex-1 flex-col">{children}</div>
        <Suspense fallback={<BottomNavView path="" />}>
          <BottomNav />
        </Suspense>
      </body>
    </html>
  );
}
