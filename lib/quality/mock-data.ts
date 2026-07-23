export type QualityIssueType =
  | "unconfirmed"
  | "salesDepositGap"
  | "unmappedProduct"
  | "duplicateDate"
  | "mondayConflict";

export type QualityStatus = "processed" | "needs-review" | "error";

export type QualityIssue = {
  id: string;
  issueType: QualityIssueType;
  status: QualityStatus;
  date: string;
  source: "券売機" | "通帳" | "売上集計";
  title: string;
  detail: string;
  amountYen?: number;
  href: string;
};

export const qualityLabels: Record<QualityIssueType, string> = {
  unconfirmed: "未確認データ",
  salesDepositGap: "売上と入金の差額",
  unmappedProduct: "商品マスター未登録",
  duplicateDate: "日付重複",
  mondayConflict: "月曜休業ルール矛盾",
};

export const qualityIssues: QualityIssue[] = [
  {
    id: "Q-001",
    issueType: "unconfirmed",
    status: "needs-review",
    date: "2026-07-09",
    source: "券売機",
    title: "時間帯別売上の確認待ち",
    detail: "営業日 2026-07-09 の 18:00-20:00 区間が未確認です。",
    href: "/ocr",
  },
  {
    id: "Q-002",
    issueType: "salesDepositGap",
    status: "error",
    date: "2026-07-09",
    source: "通帳",
    title: "売上と入金で差額が発生",
    detail: "売上合計と入金額に差があります。要因の確認が必要です。",
    amountYen: 12000,
    href: "/products",
  },
  {
    id: "Q-003",
    issueType: "unmappedProduct",
    status: "needs-review",
    date: "2026-07-08",
    source: "売上集計",
    title: "商品コードが未登録",
    detail: "商品コード TMP-77 が商品マスターに存在しません。",
    href: "/products/new",
  },
  {
    id: "Q-004",
    issueType: "duplicateDate",
    status: "error",
    date: "2026-07-08",
    source: "売上集計",
    title: "同一日付データの重複",
    detail: "同一営業日の日別売上データが2件登録されています。",
    href: "/products",
  },
  {
    id: "Q-005",
    issueType: "mondayConflict",
    status: "needs-review",
    date: "2026-07-06",
    source: "券売機",
    title: "月曜休業ルールとの矛盾",
    detail: "月曜休業予定ですが売上実績データが存在します。",
    href: "/ocr",
  },
  {
    id: "Q-006",
    issueType: "unconfirmed",
    status: "processed",
    date: "2026-07-07",
    source: "通帳",
    title: "入金照合の確認完了",
    detail: "差額の確認が完了し、処理済みに更新済みです。",
    href: "/products",
  },
  {
    id: "Q-007",
    issueType: "unmappedProduct",
    status: "processed",
    date: "2026-07-05",
    source: "売上集計",
    title: "未登録商品を新規登録済み",
    detail: "商品マスター更新後に再処理し、整合性を確認済みです。",
    href: "/products",
  },
];

export function getQualityIssues(type?: QualityIssueType) {
  if (!type) return qualityIssues;
  return qualityIssues.filter((item) => item.issueType === type);
}

export function qualityStatusCounts() {
  const initial = { processed: 0, needsReview: 0, error: 0 };
  return qualityIssues.reduce((acc, item) => {
    if (item.status === "processed") acc.processed += 1;
    if (item.status === "needs-review") acc.needsReview += 1;
    if (item.status === "error") acc.error += 1;
    return acc;
  }, initial);
}

export function qualityMetricCounts() {
  return {
    unconfirmed: qualityIssues.filter((item) => item.issueType === "unconfirmed").length,
    salesDepositGap: qualityIssues
      .filter((item) => item.issueType === "salesDepositGap")
      .reduce((sum, item) => sum + (item.amountYen ?? 0), 0),
    unmappedProduct: qualityIssues.filter((item) => item.issueType === "unmappedProduct").length,
    duplicateDate: qualityIssues.filter((item) => item.issueType === "duplicateDate").length,
    mondayConflict: qualityIssues.filter((item) => item.issueType === "mondayConflict").length,
  };
}
