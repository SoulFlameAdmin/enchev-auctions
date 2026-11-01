import type { Metadata, Viewport } from "next";
import "./globals.css";
import "./enchev-theme.css";
import "./home-v2.css";
import "./navigation.css";
import "./command-center-responsive.css";
import "./mobile-quality.css";
import "./accessibility-quality.css";
import "./cross-browser-quality.css";
import "./dp2-design-tokens.css";
import "./dp2-foundation.css";
import "./dp2-app-shell.css";
import "./dp2-home-hero.css";
import "./dp2-home-discovery.css";
import "./mobile-page-parity.css";
import "./mobile-premium.css";
import "./mobile-all-routes.css";
import "./mobile-live-compact.css";
import "./home-shared-buyer-theme.css";
import VerifiedPlanEvidenceSync from "./components/VerifiedPlanEvidenceSync";
import TestPassGreenGuard from "./components/TestPassGreenGuard";
import GapAppendOnlyGuard from "./components/GapAppendOnlyGuard";
import PlanStatusAuditTrail from "./components/PlanStatusAuditTrail";
import CloudPlanStateSync from "./components/CloudPlanStateSync";
import LotNavigationBridge from "./components/LotNavigationBridge";
import EnchevAppShell from "./components/EnchevAppShell";
import EnglishUiEnforcer from "./components/EnglishUiEnforcer";

export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover" };

export const metadata: Metadata = {
  title: "East West Auctioneer Group (E&W)",
  description: "East West Auctioneer Group (E&W) — international vehicle auctions, live bidding, vehicle history and transport.",
  metadataBase: new URL("https://enchev-auctions.vercel.app"),
  icons: { icon: "/brand/east-west-auctioneer-group-approved.png", shortcut: "/brand/east-west-auctioneer-group-approved.png", apple: "/brand/east-west-auctioneer-group-approved.png" },
  openGraph: {
    title: "East West Auctioneer Group (E&W)",
    description: "International vehicle auctions and live bidding.",
    images: [{ url: "/brand/east-west-auctioneer-group-approved.png", width: 1254, height: 1254, alt: "East West Auctioneer Group approved logo" }]
  },
  twitter: { card: "summary_large_image", images: ["/brand/east-west-auctioneer-group-approved.png"] },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <a className="eaSkipLink" href="#main-content">Skip to main content</a>
        <VerifiedPlanEvidenceSync />
        <TestPassGreenGuard />
        <GapAppendOnlyGuard />
        <PlanStatusAuditTrail />
        <CloudPlanStateSync />
        <LotNavigationBridge />
        <EnglishUiEnforcer />
        <EnchevAppShell />
        {children}
      </body>
    </html>
  );
}
