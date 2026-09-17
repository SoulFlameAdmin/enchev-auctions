import "./globals.css";
import "./home.css";
import "./effects.css";
import "./admin-layout-fix.css";
import "./premium.css";
import "./inventory/inventory.css";
import "./inventory-status.css";
import MouseAura from "./components/MouseAura";
import BackgroundSwitcher from "./components/BackgroundSwitcher";

export const metadata = {
  title: "Enchev Auctions",
  description: "International vehicle auction platform",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="bg">
      <body>
        <MouseAura />
        <BackgroundSwitcher />
        {children}
      </body>
    </html>
  );
}
