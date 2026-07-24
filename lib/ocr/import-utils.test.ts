import { describe, expect, it } from "vitest";
import {
  toQueueStatusClass,
  toQueueStatusLabel,
  toQueueStatusOrder,
} from "./import-utils";

describe("OCR queue status helpers", () => {
  it("returns Japanese labels for each queue status", () => {
    expect(toQueueStatusLabel("new")).toBe("新規");
    expect(toQueueStatusLabel("confirmed")).toBe("確認済");
    expect(toQueueStatusLabel("needs-review")).toBe("要確認");
    expect(toQueueStatusLabel("error")).toBe("エラー");
    expect(toQueueStatusLabel("archived")).toBe("アーカイブ");
  });

  it("orders statuses for queue display priority", () => {
    expect(toQueueStatusOrder("needs-review")).toBeLessThan(toQueueStatusOrder("new"));
    expect(toQueueStatusOrder("new")).toBeLessThan(toQueueStatusOrder("error"));
    expect(toQueueStatusOrder("error")).toBeLessThan(toQueueStatusOrder("confirmed"));
    expect(toQueueStatusOrder("confirmed")).toBeLessThan(toQueueStatusOrder("archived"));
  });

  it("maps statuses to existing CSS state classes", () => {
    expect(toQueueStatusClass("confirmed")).toBe("success");
    expect(toQueueStatusClass("error")).toBe("danger");
    expect(toQueueStatusClass("new")).toBe("warning");
    expect(toQueueStatusClass("needs-review")).toBe("warning");
    expect(toQueueStatusClass("archived")).toBe("warning");
  });
});
