import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Toronto Language Exchange",
  description: "Connect Japanese teachers and students in Toronto",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
