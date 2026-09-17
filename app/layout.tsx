import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { HeaderNav } from "@/components/HeaderNav";
import { SiteVisitTracker } from "@/components/SiteVisitTracker";
import "./globals.css";

export const metadata: Metadata = {
  title: "Driveline Auto | Tacoma Verifier",
  description: "Verified Tacoma fitment builds and simple fitment checks."
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="shell">
          <header className="nav">
            <div className="nav-inner">
              <Link className="brand" href="/" aria-label="Driveline Auto home">
                <span className="brand-wordmark">Driveline Auto</span>
              </Link>
              <HeaderNav />
            </div>
          </header>
          <main className="main">{children}</main>
          <footer className="footer">
            <div className="section">
              <p>&copy; 2026 Driveline Auto. Built for truck owners, by truck owners.</p>
            </div>
          </footer>
        </div>
        <Suspense fallback={null}>
          <SiteVisitTracker />
        </Suspense>
      </body>
    </html>
  );
}
