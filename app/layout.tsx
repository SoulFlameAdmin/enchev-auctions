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
import "./dp2-foundation.css";
import "./dp2-app-shell.css";
import "./dp2-home-hero.css";
import "./dp2-home-discovery.css";
import VerifiedPlanEvidenceSync from "./components/VerifiedPlanEvidenceSync";
import TestPassGreenGuard from "./components/TestPassGreenGuard";
import GapAppendOnlyGuard from "./components/GapAppendOnlyGuard";
import PlanStatusAuditTrail from "./components/PlanStatusAuditTrail";
import CloudPlanStateSync from "./components/CloudPlanStateSync";
import LotNavigationBridge from "./components/LotNavigationBridge";
import EnchevAppShell from "./components/EnchevAppShell";

export const metadata: Metadata = {
  title: "ENCHEV Аукциони",
  description: "ENCHEV — международна платформа за автомобилни търгове, наддаване на живо, история и транспорт.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="bg">
      <body>
        <a className="eaSkipLink" href="#main-content">Към основното съдържание</a>
        <VerifiedPlanEvidenceSync />
        <TestPassGreenGuard />
        <GapAppendOnlyGuard />
        <PlanStatusAuditTrail />
        <CloudPlanStateSync />
        <LotNavigationBridge />
        <EnchevAppShell />
        {children}
      </body>
    </html>
  );
}
