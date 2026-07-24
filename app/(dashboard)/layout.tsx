import { AppShell } from "@/components/app-shell";
import { redirect } from "next/navigation";
import { getCurrentUserFromCookie } from "@/lib/auth/server";

export default function DashboardLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return <DashboardLayoutContent>{children}</DashboardLayoutContent>;
}

async function DashboardLayoutContent({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const user = await getCurrentUserFromCookie();
  if (!user) {
    redirect("/login?reason=required");
  }

  return <AppShell userEmail={user.email ?? "管理者"}>{children}</AppShell>;
}
