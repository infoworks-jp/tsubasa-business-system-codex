export const AUTH_COOKIE_NAME = "sb-access-token";
export const AUTH_REFRESH_COOKIE_NAME = "sb-refresh-token";
export const AUTH_ACTIVITY_COOKIE_NAME = "sb-last-activity";
export const AUTH_IDLE_TIMEOUT_SECONDS = 30 * 24 * 60 * 60;
export const AUTH_REFRESH_MARGIN_SECONDS = 5 * 60;

export function accessTokenExpiresAt(accessToken: string): number | null {
  try {
    const payload = accessToken.split(".")[1];
    if (!payload) return null;
    const normalized = payload
      .replace(/-/g, "+")
      .replace(/_/g, "/")
      .padEnd(Math.ceil(payload.length / 4) * 4, "=");
    const decoded = JSON.parse(atob(normalized)) as {
      exp?: unknown;
    };
    return typeof decoded.exp === "number" ? decoded.exp : null;
  } catch {
    return null;
  }
}

export function shouldRefreshAccessToken(accessToken: string, nowSeconds: number) {
  const expiresAt = accessTokenExpiresAt(accessToken);
  return expiresAt === null || expiresAt - nowSeconds <= AUTH_REFRESH_MARGIN_SECONDS;
}

export function isSessionInactive(lastActivity: string | undefined, nowSeconds: number) {
  if (!lastActivity) return false;
  const lastActivitySeconds = Number(lastActivity);
  return (
    !Number.isFinite(lastActivitySeconds) ||
    nowSeconds - lastActivitySeconds >= AUTH_IDLE_TIMEOUT_SECONDS
  );
}
