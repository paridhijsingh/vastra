import type { Metadata } from "next";
import { Fraunces, Source_Sans_3 } from "next/font/google";

import { SiteHeader } from "@/components/SiteHeader";

import "./globals.css";

const sourceSans = Source_Sans_3({
  variable: "--font-source-sans",
  subsets: ["latin"],
  display: "swap",
});

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Vastra (वस्त्र)",
  description:
    "Your personal AI stylist for the clothes you already own. Ready, set, styled.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${sourceSans.variable} ${fraunces.variable} min-h-screen antialiased`}
      >
        <SiteHeader />
        <main className="mx-auto w-full min-w-0 max-w-5xl px-4 py-8 sm:px-8 sm:py-12">
          {children}
        </main>
      </body>
    </html>
  );
}
