export const SOURCE_FILE_BUCKET = "original-source-files";

export const ALLOWED_SOURCE_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
  "application/pdf",
] as const;

export type SourceFileRecord = {
  id: string;
  originalFilename: string;
  mimeType: string;
  sizeBytes: number;
  sha256: string;
  storedAt: string;
  archivedAt: string | null;
  archiveReason: string | null;
  ocrImportId: string | null;
};

export type SourceFileDbRow = {
  id: string;
  original_filename: string;
  mime_type: string;
  size_bytes: number;
  sha256: string;
  storage_path: string;
  stored_at: string;
  archived_at: string | null;
  archive_reason: string | null;
  ocr_import_id: string | null;
};

export function toSourceFileRecord(row: SourceFileDbRow): SourceFileRecord {
  return {
    id: String(row.id),
    originalFilename: String(row.original_filename),
    mimeType: String(row.mime_type),
    sizeBytes: Number(row.size_bytes),
    sha256: String(row.sha256),
    storedAt: String(row.stored_at),
    archivedAt: row.archived_at,
    archiveReason: row.archive_reason,
    ocrImportId: row.ocr_import_id,
  };
}
