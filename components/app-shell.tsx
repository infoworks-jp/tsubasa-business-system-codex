"use client";

import Link from "next/link";
import { BarChart3, Boxes, CircleAlert, Clock3, Landmark, LayoutDashboard, Lightbulb, ListOrdered, PackageSearch } from "lucide-react";
import { usePathname } from "next/navigation";

const navigation = [
  { href: "/kpi", label: "KPI", icon: LayoutDashboard },
  { href: "/analysis/products", label: "商品別", icon: PackageSearch },
  { href: "/analysis/abc", label: "ABC", icon: ListOrdered },
  { href: "/analysis/weekday", label: "曜日", icon: BarChart3 },
  { href: "/analysis/hourly", label: "時間帯", icon: Clock3 },
  { href: "/analysis/monthly", label: "月別", icon: BarChart3 },
  { href: "/consulting", label: "経営コンサル", icon: Lightbulb },
  { href: "/qa", label: "品質検証", icon: CircleAlert },
  { href: "/bank", label: "通帳", icon: Landmark },
  { href: "/products", label: "商品マスター", icon: Boxes }
];

export function AppShell({ children }: Readonly<{ children: React.ReactNode }>) {
  const pathname = usePathname();
  return <div className="shell"><aside className="sidebar"><div className="brand"><div className="brand-mark">翼</div><div className="brand-copy"><strong>味一番つばさ</strong><small>TSUBASA Rev.2</small></div></div>
    <nav className="nav" aria-label="主要メニュー">{navigation.map(({ href, label, icon: Icon }) => <Link aria-current={pathname === href ? "page" : undefined} className={pathname === href ? "active" : ""} href={href} key={href}><Icon size={19} aria-hidden="true" /><span className="nav-label">{label}</span></Link>)}</nav>
  </aside><div className="main"><header className="topbar"><span className="topbar-label">Rev.2 / develop</span><div className="user-chip"><span className="avatar">管</span><span>管理者</span></div></header><main className="content">{children}</main></div></div>;
}
