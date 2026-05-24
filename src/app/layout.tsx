import type { Metadata } from "next";
import { DM_Sans, Syne, Noto_Sans_JP } from "next/font/google";
import "./globals.css";

const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-dm-sans",
  display: "swap",
  weight: ["300", "400", "500", "600", "700"],
});

const syne = Syne({
  subsets: ["latin"],
  variable: "--font-syne",
  display: "swap",
  weight: ["400", "500", "600", "700", "800"],
});

const notoSansJP = Noto_Sans_JP({
  subsets: ["latin"],
  variable: "--font-noto-jp",
  display: "swap",
  weight: ["300", "400", "500", "700"],
});

export const metadata: Metadata = {
  title: "LTOC — Language & Toronto Community",
  description: "トロントで言語交換、新しい出会いを。日本語を教えたい日本人と、日本語を学びたい英語話者をつなぐプラットフォーム。",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja" className={`${dmSans.variable} ${syne.variable} ${notoSansJP.variable}`}>
      <body className="antialiased font-sans" style={{ fontFamily: "var(--font-dm-sans), var(--font-noto-jp), sans-serif" }}>
        {children}
      </body>
    </html>
  );
}
