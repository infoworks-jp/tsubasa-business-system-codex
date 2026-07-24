"use client";

import Link from "next/link";
import { Boxes, CircleAlert, Files, ImagePlus, LayoutDashboard, LogIn } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";

const navigation = [
  { href: "/", label: "経営者ホーム", icon: LayoutDashboard },
  { href: "/products", label: "商品マスター", icon: Boxes },
  { href: "/quality", label: "品質検証", icon: CircleAlert },
  { href: "/ocr", label: "OCR検証", icon: ImagePlus },
  { href: "/sources", label: "原本台帳", icon: Files },
  { href: "/login", label: "ログイン", icon: LogIn },
];

export function AppShell({
  children,
  userEmail,
}: Readonly<{ children: React.ReactNode; userEmail: string }>) {
  const pathname = usePathname();
  const router = useRouter();

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

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
            <span>{userEmail}</span>
            <button className="button secondary" type="button" onClick={logout}>
              ログアウト
            </button>
          </div>
        </header>
        <main className="content">{children}</main>
      </div>
    </div>
  );
}
