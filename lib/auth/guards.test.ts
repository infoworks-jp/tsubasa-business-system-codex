import { describe, expect, it } from "vitest";
import { isProtectedApiPath, isProtectedDashboardPath } from "./guards";

describe("auth path guards", () => {
  it("detects protected dashboard routes", () => {
    expect(isProtectedDashboardPath("/")).toBe(true);
    expect(isProtectedDashboardPath("/products")).toBe(true);
    expect(isProtectedDashboardPath("/products/new")).toBe(true);
    expect(isProtectedDashboardPath("/ocr")).toBe(true);
    expect(isProtectedDashboardPath("/sources")).toBe(true);
    expect(isProtectedDashboardPath("/quality/issues")).toBe(true);
    expect(isProtectedDashboardPath("/login")).toBe(false);
  });

  it("detects protected api routes", () => {
    expect(isProtectedApiPath("/api/products")).toBe(true);
    expect(isProtectedApiPath("/api/products/123")).toBe(true);
    expect(isProtectedApiPath("/api/ocr/imports")).toBe(true);
    expect(isProtectedApiPath("/api/ocr/gemini")).toBe(true);
    expect(isProtectedApiPath("/api/original-sources")).toBe(true);
    expect(isProtectedApiPath("/api/product-matching")).toBe(true);
    expect(isProtectedApiPath("/api/auth/login")).toBe(false);
  });
});
