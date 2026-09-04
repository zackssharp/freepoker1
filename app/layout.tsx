import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";

import { SiteNav } from "@/components/site-nav";
import { Toaster } from "@/components/ui/sonner";

import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Free Poker — Texas Hold'em against thinking bots",
    template: "%s — Free Poker",
  },
  description:
    "A browser Texas Hold'em table. Five bot personalities, real side pots, and a leaderboard that remembers every hand.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`dark ${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      style={{ colorScheme: "dark" }}
    >
      <body className="bg-background text-foreground flex min-h-full flex-col">
        <SiteNav />
        <main className="flex flex-1 flex-col">{children}</main>
        <Toaster position="top-center" />
      </body>
    </html>
  );
}
