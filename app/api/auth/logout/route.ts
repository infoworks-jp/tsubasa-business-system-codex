import { NextResponse } from "next/server";
import { AUTH_COOKIE_NAME } from "@/lib/auth/server";

export async function POST() {
  const response = NextResponse.json({ message: "ログアウトしました" });
  response.cookies.set(AUTH_COOKIE_NAME, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
  return response;
}
