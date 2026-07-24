import { ALLOWED_SOURCE_MIME_TYPES } from "./types";

export class SourceFileValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SourceFileValidationError";
  }
}

export function validateSourceFile(file: File) {
  if (!file.name.trim()) throw new SourceFileValidationError("元ファイル名を確認できません");
  if (file.size <= 0) throw new SourceFileValidationError("空のファイルは登録できません");
  if (!ALLOWED_SOURCE_MIME_TYPES.includes(file.type as (typeof ALLOWED_SOURCE_MIME_TYPES)[number])) {
    throw new SourceFileValidationError("対応していないファイル形式です");
  }
}

export async function calculateSha256(file: Blob) {
  const digest = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export function validateArchiveReason(value: unknown) {
  const reason = String(value ?? "").trim();
  if (!reason) throw new SourceFileValidationError("アーカイブ理由を入力してください");
  return reason;
}

export function buildArchiveUpdate(value: unknown, archivedAt = new Date()) {
  return {
    archived_at: archivedAt.toISOString(),
    archive_reason: validateArchiveReason(value),
  };
}
