import type { Metadata, Viewport } from "next";
import { Fraunces, Source_Sans_3 } from "next/font/google";

import { StudioShell } from "@/components/StudioShell";
import { getCurrentUser } from "@/lib/auth/session";
import { EntranceProvider } from "@/lib/studio/entrance-context";

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

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  interactiveWidget: "resizes-content",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const user = await getCurrentUser();

  return (
    <html lang="en">
      <body className={`${sourceSans.variable} ${fraunces.variable} antialiased`}>
        <EntranceProvider>
          <StudioShell user={user}>{children}</StudioShell>
        </EntranceProvider>
      </body>
    </html>
  );
}
