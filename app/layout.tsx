import "./globals.css";

export const metadata = {
  title: "Enchev Auctions",
  description: "International vehicle auction platform",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
