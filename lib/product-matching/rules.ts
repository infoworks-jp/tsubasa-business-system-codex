export type SalesEligibilityInput = {
  importStatus: string;
  importArchivedAt: string | null;
  rowStatus: string;
  rowArchivedAt: string | null;
  productId: string | null;
  salesConfirmedAt: string | null;
};

export function normalizeProductAlias(value: string) {
  return value.normalize("NFKC").trim().replace(/\s+/g, " ").toLocaleLowerCase("ja-JP");
}

export function resolveProductFromAliases(
  originalName: string,
  aliases: Array<{ normalizedName: string; productId: string }>,
) {
  const normalized = normalizeProductAlias(originalName);
  const matches = aliases.filter((alias) => alias.normalizedName === normalized);
  return matches.length === 1
    ? { status: "processed" as const, productId: matches[0].productId, reviewReason: null }
    : { status: "needs-review" as const, productId: null, reviewReason: "商品対応を要確認" };
}

export function isConfirmedSaleEligible(input: SalesEligibilityInput) {
  return (
    input.importStatus === "confirmed" &&
    input.importArchivedAt === null &&
    input.rowStatus === "processed" &&
    input.rowArchivedAt === null &&
    input.productId !== null &&
    input.salesConfirmedAt !== null
  );
}

export function resolveJstBusinessDate(recordedAt: string) {
  const instant = new Date(recordedAt);
  if (Number.isNaN(instant.getTime())) throw new Error("元の記録日時を確認できません");
  const jst = new Date(instant.getTime() + 9 * 60 * 60 * 1000);
  const date = new Date(Date.UTC(jst.getUTCFullYear(), jst.getUTCMonth(), jst.getUTCDate()));
  if (jst.getUTCDay() === 1 && jst.getUTCHours() < 4) date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
}
