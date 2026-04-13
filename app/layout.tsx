import "./globals.css";
import Link from "next/link";
import { ReactNode } from "react";

export const metadata = {
  title: "Nexus Product Studio",
  description: "End-to-end AI product dashboard for personal use."
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <nav className="border-b border-white/10 bg-slate-950/90 backdrop-blur">
          <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
            <Link href="/" className="text-lg font-semibold">
              Nexus Product Studio
            </Link>
            <div className="flex items-center gap-4 text-sm text-slate-300">
              <Link href="/">Dashboard</Link>
            </div>
          </div>
        </nav>
        {children}
      </body>
    </html>
  );
}
