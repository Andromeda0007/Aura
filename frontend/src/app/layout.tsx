import type { Metadata } from "next";
import { Fraunces, Geist, Geist_Mono } from "next/font/google";

import "./globals.css";
import { Providers } from "./providers";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });
const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  display: "swap",
  axes: ["opsz"],
});

const DESCRIPTION =
  "A real-time, multi-modal teaching assistant: it listens, watches your board, and turns your live lesson into quizzes, summaries, explanations, and diagrams on command.";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"),
  title: "Aura — Teaching Assistant",
  description: DESCRIPTION,
  applicationName: "Aura",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "Aura", statusBarStyle: "black-translucent" },
  openGraph: {
    title: "Aura — Teaching Assistant",
    description: DESCRIPTION,
    siteName: "Aura",
    type: "website",
  },
  twitter: { card: "summary_large_image", title: "Aura — Teaching Assistant", description: DESCRIPTION },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} ${fraunces.variable} h-full antialiased`}
    >
      {/* suppressHydrationWarning: browser extensions inject body attrs (e.g. cz-shortcut-listen) */}
      <body className="min-h-full flex flex-col" suppressHydrationWarning>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
