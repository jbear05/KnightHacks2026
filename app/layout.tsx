import type { Metadata } from "next";
import { Fredoka, IBM_Plex_Mono, Nunito } from "next/font/google";
import { Footer } from "@/components/shell/Footer";
import { SideNav } from "@/components/shell/SideNav";
import { TopBar } from "@/components/shell/TopBar";
import { USE_MOCK } from "@/lib/api";
import "./globals.css";

const fredoka = Fredoka({ variable: "--font-fredoka", subsets: ["latin"], weight: ["600", "700"] });
const nunito = Nunito({ variable: "--font-nunito", subsets: ["latin"], weight: ["500", "800"] });
const plexMono = IBM_Plex_Mono({ variable: "--font-plex-mono", subsets: ["latin"], weight: ["400", "500"] });

export const metadata: Metadata = {
  title: { default: "Watchdog", template: "%s · Watchdog" },
  description: "Operator console for SPOT inspection missions.",
  icons: { icon: "/figma/glyph-bloom.svg" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${fredoka.variable} ${nunito.variable} ${plexMono.variable}`}>
      <body className="min-h-screen">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-2 focus:top-2 focus:z-50 focus:rounded-button focus:bg-spot focus:px-3 focus:py-2 type-button"
        >
          Skip to content
        </a>
        <TopBar />
        <SideNav />
        <div className="flex min-h-screen flex-col pt-14 pb-[72px] md:pb-0 md:pl-[72px]">
          {USE_MOCK && (
            <p role="note" className="border-b border-line bg-spot-tint px-4 py-1.5 type-body-sm md:px-6">
              Mock data mode: pages read the kit fixtures in lib/mock, not the database. Operator decisions last only
              until the page reloads. Set NEXT_PUBLIC_USE_MOCK=false to use the API.
            </p>
          )}
          <main id="main" className="flex-1">
            {children}
          </main>
          <Footer />
        </div>
      </body>
    </html>
  );
}
