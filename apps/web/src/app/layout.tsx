import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const mono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Soverity — Sovereign identity. Google-simple.",
    template: "%s · Soverity",
  },
  description:
    "A user-owned decentralized passport that works like a Google account. No KYC, no seed phrases, no lock-out.",
  metadataBase: new URL("https://soverity.xyz"),
  openGraph: {
    title: "Soverity",
    description: "Sovereign identity. Google-simple.",
    url: "https://soverity.xyz",
    siteName: "Soverity",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#0a0c16",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${mono.variable}`}>
      <body className="sv-bg">
        <div className="sv-aurora" aria-hidden="true" />
        <div className="sv-grain" aria-hidden="true" />
        <main style={{ position: "relative", zIndex: 1 }}>{children}</main>
      </body>
    </html>
  );
}
