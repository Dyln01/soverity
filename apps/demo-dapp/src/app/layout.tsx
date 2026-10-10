import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Soverity Demo dApp",
  description: "A sample app showing the entire Sign in with Soverity integration.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="sv-bg">
        <div className="sv-aurora" aria-hidden="true" />
        <main style={{ position: "relative", zIndex: 1 }}>{children}</main>
      </body>
    </html>
  );
}
