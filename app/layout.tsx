import type { Metadata } from "next";
import "./globals.css";
import "./enchev-theme.css";
import "./home-v2.css";
import "./navigation.css";
import "./command-center-responsive.css";
import "./mobile-quality.css";
import "./accessibility-quality.css";
import "./cross-browser-quality.css";
import "./dp2-design-tokens.css";
import MouseAura from "./components/MouseAura";
import BackgroundSwitcher from "./components/BackgroundSwitcher";
import VerifiedPlanEvidenceSync from "./components/VerifiedPlanEvidenceSync";
import TestPassGreenGuard from "./components/TestPassGreenGuard";
import GapAppendOnlyGuard from "./components/GapAppendOnlyGuard";
import PlanStatusAuditTrail from "./components/PlanStatusAuditTrail";
import CloudPlanStateSync from "./components/CloudPlanStateSync";
import LotNavigationBridge from "./components/LotNavigationBridge";

export const metadata: Metadata = {
  title: "ENCHEV Auctions",
  description: "ENCHEV — международна платформа за автомобилни търгове, LIVE наддаване, история и транспорт.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="bg">
      <body>
        <a className="eaSkipLink" href="#main-content">Към основното съдържание</a>
        <MouseAura />
        <BackgroundSwitcher />
        <VerifiedPlanEvidenceSync />
        <TestPassGreenGuard />
        <GapAppendOnlyGuard />
        <PlanStatusAuditTrail />
        <CloudPlanStateSync />
        <LotNavigationBridge />
        {children}
      </body>
    </html>
  );
}
