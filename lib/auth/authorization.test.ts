import { describe, expect, it } from "vitest";
import { isAuthorizedOwner } from "./authorization";

describe("加来さん専用認可", () => {
  it("ownerメタデータを持つ利用者だけを許可する", () => {
    expect(isAuthorizedOwner({ app_metadata: { access_role: "owner" } })).toBe(true);
  });

  it.each([
    ["メタデータなし", {}],
    ["別ロール", { access_role: "viewer" }],
  ])("%sの利用者を拒否する", (_label, appMetadata) => {
    expect(isAuthorizedOwner({ app_metadata: appMetadata })).toBe(false);
  });
});
