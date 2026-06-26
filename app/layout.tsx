import type { Metadata } from "next";
import { Inter, Space_Grotesk, IBM_Plex_Mono, Syne } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans", display: "swap" });
const grotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
});
const syne = Syne({ subsets: ["latin"], weight: ["600", "700", "800"], variable: "--font-syne", display: "swap" });
const mono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "OpenSlot — the on-sale platform for event businesses",
  description:
    "Run a sold-out on-sale without the disasters. No overselling, bots priced out, a fair shot for every fan — for artists, brands and promoters.",
};

const NAV = [
  { href: "/", label: "Home" },
  { href: "/org/console", label: "Console" },
  { href: "/demo", label: "Proof" },
  { href: "/discover", label: "Discover" },
];

const MARQUEE = (
  <>
    NOW SELLING&nbsp;&nbsp;●&nbsp;&nbsp;SOLD-OUT ON-SALES THAT DON&apos;T CRASH&nbsp;&nbsp;●&nbsp;&nbsp;
    <b>NO OVERSELLING</b>&nbsp;&nbsp;●&nbsp;&nbsp;BOTS PRICED OUT&nbsp;&nbsp;●&nbsp;&nbsp;A FAIR SHOT FOR EVERY FAN&nbsp;&nbsp;●&nbsp;&nbsp;
  </>
);

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${grotesk.variable} ${syne.variable} ${mono.variable}`}
    >
      <body>
        <div className="os-marq">
          <div className="run">
            {MARQUEE}
            {MARQUEE}
          </div>
        </div>
        <header>
          <div className="wrap os-nav">
            <Link href="/" className="os-brand focusable">
              <span className="sq" />
              OpenSlot
            </Link>
            <nav className="os-links">
              {NAV.map((n) => (
                <Link key={n.href} href={n.href} className="focusable">
                  {n.label}
                </Link>
              ))}
            </nav>
            <Link href="/org/onboarding" className="os-pill focusable">
              Run your on-sale →
            </Link>
          </div>
        </header>
        <main>{children}</main>
        <footer>
          <div className="wrap os-foot">
            <span>OpenSlot · the on-sale platform for event businesses</span>
            <span className="num">© 2026 · sell out, safely</span>
          </div>
        </footer>
      </body>
    </html>
  );
}
