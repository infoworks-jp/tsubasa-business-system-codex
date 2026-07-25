import { describe, expect, it } from "vitest";
import {
  AUTH_IDLE_TIMEOUT_SECONDS,
  AUTH_REFRESH_MARGIN_SECONDS,
  accessTokenExpiresAt,
  isSessionInactive,
  shouldRefreshAccessToken,
} from "./session";

function dummyJwt(expiresAt: number) {
  const payload = Buffer.from(JSON.stringify({ exp: expiresAt })).toString("base64url");
  return `header.${payload}.signature`;
}

describe("長期ログインセッション", () => {
  it("アクセストークンの期限を読み取る", () => {
    expect(accessTokenExpiresAt(dummyJwt(123456))).toBe(123456);
    expect(accessTokenExpiresAt("invalid")).toBeNull();
  });

  it("期限5分前から更新し、それ以前は更新しない", () => {
    const now = 1_000_000;
    expect(shouldRefreshAccessToken(dummyJwt(now + AUTH_REFRESH_MARGIN_SECONDS + 1), now)).toBe(false);
    expect(shouldRefreshAccessToken(dummyJwt(now + AUTH_REFRESH_MARGIN_SECONDS), now)).toBe(true);
  });

  it("30日未満の操作間隔は維持し、30日以上で失効する", () => {
    const now = 2_000_000;
    expect(isSessionInactive(String(now - AUTH_IDLE_TIMEOUT_SECONDS + 1), now)).toBe(false);
    expect(isSessionInactive(String(now - AUTH_IDLE_TIMEOUT_SECONDS), now)).toBe(true);
    expect(isSessionInactive(undefined, now)).toBe(false);
  });
});

