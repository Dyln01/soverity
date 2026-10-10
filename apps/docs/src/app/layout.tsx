import type { Metadata } from "next";
import "@soverity/ui/styles.css";

export const metadata: Metadata = {
  title: "Soverity Docs",
  description: "Developer documentation for the Soverity SDK and protocol.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body
        style={{
          background: "var(--sv-base)",
          color: "var(--sv-text)",
          fontFamily: "Inter, system-ui, sans-serif",
        }}
      >
        {children}
      </body>
    </html>
  );
}
