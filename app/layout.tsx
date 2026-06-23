import type { Metadata } from "next";
import { Inter, Space_Grotesk, IBM_Plex_Mono } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans", display: "swap" });
const grotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
});
const mono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "OpenSlot — zero oversell, across regions",
  description:
    "Global high-demand drops & ticketing. The same scarce seat, bought worldwide at the same instant — with zero oversell, on Amazon Aurora DSQL multi-region strong consistency.",
};

const NAV = [
  { href: "/", label: "Discover" },
  { href: "/demo", label: "Cross-region demo" },
  { href: "/org/console", label: "Organizer" },
  { href: "/me", label: "My tickets" },
];

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${grotesk.variable} ${mono.variable}`}>
      <body>
        <header className="border-b" style={{ borderColor: "var(--color-ink)" }}>
          <div className="shell flex items-center justify-between" style={{ height: 60 }}>
            <Link href="/" className="flex items-baseline gap-3 focusable" style={{ textDecoration: "none" }}>
              <span
                className="display"
                style={{ fontSize: 22, color: "var(--color-ink)", letterSpacing: "-0.04em" }}
              >
                OpenSlot
              </span>
              <span className="eyebrow hidden sm:inline">global drops · ticketing</span>
            </Link>
            <nav className="flex items-center gap-1">
              {NAV.map((n) => (
                <Link
                  key={n.href}
                  href={n.href}
                  className="mono focusable"
                  style={{
                    fontSize: 12.5,
                    padding: "8px 12px",
                    color: "var(--color-ink-2)",
                    textDecoration: "none",
                  }}
                >
                  {n.label}
                </Link>
              ))}
            </nav>
          </div>
        </header>
        <main>{children}</main>
        <footer className="border-t" style={{ borderColor: "var(--color-line)", marginTop: 80 }}>
          <div className="shell flex flex-wrap items-center justify-between gap-3" style={{ padding: "22px 24px" }}>
            <span className="eyebrow">
              Aurora DSQL ledger · Aurora PostgreSQL discovery · Vercel
            </span>
            <span className="num" style={{ fontSize: 11, color: "var(--color-ink-3)" }}>
              #H0Hackathon · zero oversell across regions
            </span>
          </div>
        </footer>
      </body>
    </html>
  );
}
