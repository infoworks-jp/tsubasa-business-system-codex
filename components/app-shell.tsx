"use client";

import Link from "next/link";
import { Boxes, ImagePlus, LayoutDashboard, LogIn } from "lucide-react";
import { usePathname } from "next/navigation";

const navigation = [
  { href: "/", label: "経営者ホーム", icon: LayoutDashboard },
  { href: "/products", label: "商品マスター", icon: Boxes },
  { href: "/ocr", label: "OCR検証", icon: ImagePlus },
  { href: "/login", label: "ログイン画面", icon: LogIn },
];

export function AppShell({ children }: Readonly<{ children: React.ReactNode }>) {
  const pathname = usePathname();

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">翼</div>
          <div className="brand-copy">
            <strong>味一番つばさ</strong>
            <small>経営管理</small>
          </div>
        </div>
        <nav className="nav" aria-label="主要メニュー">
          {navigation.map(({ href, label, icon: Icon }) => (
            <Link
              aria-current={pathname === href ? "page" : undefined}
              className={pathname === href ? "active" : ""}
              href={href}
              key={href}
            >
              <Icon size={19} aria-hidden="true" />
              <span className="nav-label">{label}</span>
            </Link>
          ))}
        </nav>
      </aside>
      <div className="main">
        <header className="topbar">
          <span className="topbar-label">Phase 1 / 開発環境</span>
          <div className="user-chip">
            <span className="avatar">管</span>
            <span>管理者（未接続）</span>
          </div>
        </header>
        <main className="content">{children}</main>
      </div>
    </div>
  );
}
