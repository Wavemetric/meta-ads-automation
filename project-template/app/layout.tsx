import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "메타 광고 자동화",
  description: "Meta Ads 성과 모니터링 및 자동화 대시보드",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className="h-full">
      <body className="min-h-full bg-gray-950 text-gray-100 antialiased">{children}</body>
    </html>
  );
}
