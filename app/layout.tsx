import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "味一番つばさ | 経営管理",
  description: "味一番つばさ 売上管理・経営分析システム Codex版",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
