import { NextRequest, NextResponse } from "next/server";
import {
  AUTH_ACTIVITY_COOKIE_NAME,
  AUTH_COOKIE_NAME,
  AUTH_REFRESH_COOKIE_NAME,
} from "@/lib/auth/session";

export async function POST(request: NextRequest) {
  const response = NextResponse.json({ message: "ログアウトしました" });
  for (const name of [
    AUTH_COOKIE_NAME,
    AUTH_REFRESH_COOKIE_NAME,
    AUTH_ACTIVITY_COOKIE_NAME,
  ]) {
    response.cookies.set(name, "", {
      httpOnly: true,
      sameSite: "lax",
      secure:
        request.nextUrl.protocol === "https:" ||
        request.headers.get("x-forwarded-proto") === "https",
      path: "/",
      maxAge: 0,
    });
  }
  return response;
}
