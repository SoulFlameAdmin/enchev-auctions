import "./globals.css";
import "./home.css";
import "./effects.css";
import MouseAura from "./components/MouseAura";

export const metadata = {
  title: "Enchev Auctions",
  description: "International vehicle auction platform",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="bg">
      <body>
        <MouseAura />
        {children}
      </body>
    </html>
  );
}
