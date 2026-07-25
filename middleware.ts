import { NextRequest, NextResponse } from "next/server";
import { isAuthorizedOwner } from "@/lib/auth/authorization";
import {
  AUTH_ACTIVITY_COOKIE_NAME,
  AUTH_COOKIE_NAME,
  AUTH_IDLE_TIMEOUT_SECONDS,
  AUTH_REFRESH_COOKIE_NAME,
  isSessionInactive,
  shouldRefreshAccessToken,
} from "@/lib/auth/session";

type RefreshedSession = {
  access_token?: unknown;
  refresh_token?: unknown;
  user?: {
    app_metadata: Record<string, unknown>;
  };
};

function cookieOptions(request: NextRequest) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure:
      request.nextUrl.protocol === "https:" ||
      request.headers.get("x-forwarded-proto") === "https",
    path: "/",
    maxAge: AUTH_IDLE_TIMEOUT_SECONDS,
  };
}

function clearSession(request: NextRequest) {
  for (const name of [
    AUTH_COOKIE_NAME,
    AUTH_REFRESH_COOKIE_NAME,
    AUTH_ACTIVITY_COOKIE_NAME,
  ]) {
    request.cookies.delete(name);
  }
  const response = NextResponse.next({ request: { headers: request.headers } });
  for (const name of [
    AUTH_COOKIE_NAME,
    AUTH_REFRESH_COOKIE_NAME,
    AUTH_ACTIVITY_COOKIE_NAME,
  ]) {
    response.cookies.set(name, "", { ...cookieOptions(request), maxAge: 0 });
  }
  return response;
}

function continueSession(
  request: NextRequest,
  accessToken: string,
  refreshToken: string,
  nowSeconds: number,
) {
  request.cookies.set(AUTH_COOKIE_NAME, accessToken);
  request.cookies.set(AUTH_REFRESH_COOKIE_NAME, refreshToken);
  request.cookies.set(AUTH_ACTIVITY_COOKIE_NAME, String(nowSeconds));

  const response = NextResponse.next({ request: { headers: request.headers } });
  response.cookies.set(AUTH_COOKIE_NAME, accessToken, cookieOptions(request));
  response.cookies.set(AUTH_REFRESH_COOKIE_NAME, refreshToken, cookieOptions(request));
  response.cookies.set(
    AUTH_ACTIVITY_COOKIE_NAME,
    String(nowSeconds),
    cookieOptions(request),
  );
  return response;
}

export async function middleware(request: NextRequest) {
  const accessToken = request.cookies.get(AUTH_COOKIE_NAME)?.value ?? "";
  const refreshToken = request.cookies.get(AUTH_REFRESH_COOKIE_NAME)?.value ?? "";
  if (!accessToken && !refreshToken) return NextResponse.next();

  const nowSeconds = Math.floor(Date.now() / 1000);
  const lastActivity = request.cookies.get(AUTH_ACTIVITY_COOKIE_NAME)?.value;
  if (isSessionInactive(lastActivity, nowSeconds) || !refreshToken) {
    return clearSession(request);
  }

  if (!shouldRefreshAccessToken(accessToken, nowSeconds)) {
    return continueSession(request, accessToken, refreshToken, nowSeconds);
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return clearSession(request);

  try {
    const refreshResponse = await fetch(`${url}/auth/v1/token?grant_type=refresh_token`, {
      method: "POST",
      headers: {
        apikey: anonKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ refresh_token: refreshToken }),
      cache: "no-store",
    });
    if (!refreshResponse.ok) return clearSession(request);

    const session = (await refreshResponse.json()) as RefreshedSession;
    if (
      typeof session.access_token !== "string" ||
      typeof session.refresh_token !== "string" ||
      !session.user ||
      !isAuthorizedOwner(session.user)
    ) {
      return clearSession(request);
    }
    return continueSession(
      request,
      session.access_token,
      session.refresh_token,
      nowSeconds,
    );
  } catch {
    return clearSession(request);
  }
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
