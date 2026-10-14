import type { Metadata } from "next";
import Link from "next/link";
import { DM_Sans, Fraunces } from "next/font/google";
import "./globals.css";
import "./lead-desk.css";

const display = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  display: "swap",
});
const sans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-dm-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Leadscale | Lead desk",
  description: "A clear next step for every real estate conversation.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const fixtureMode = process.env.NEXT_PUBLIC_USE_FIXTURES !== "false";

  return (
    <html lang="en" className={`${display.variable} ${sans.variable}`}>
      <body>
        <div className="site-shell">
          <header className="site-header">
            <Link
              className="brand-lockup"
              href="/"
              aria-label="Leadscale lead desk"
            >
              <span className="brand-mark" aria-hidden="true">
                L
              </span>
              <span className="brand-name">Leadscale</span>
            </Link>
            <div className="header-right">
              <span
                className={`mode-indicator ${fixtureMode ? "mode-indicator--fixtures" : "mode-indicator--api"}`}
              >
                <span className="mode-dot" aria-hidden="true" />
                {fixtureMode ? "Demo data" : "API mode"}
              </span>
              {process.env.NODE_ENV !== "production" ? (
                <Link className="design-link" href="/design">
                  Design system
                </Link>
              ) : null}
              <span className="user-mark" role="img" aria-label="Shalinthia">
                S
              </span>
            </div>
          </header>
          {children}
          <footer className="site-footer">
            <span>Leadscale</span>
            <span>Real estate, with a clear next step.</span>
          </footer>
        </div>
      </body>
    </html>
  );
}
