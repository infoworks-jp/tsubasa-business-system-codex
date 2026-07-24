"use client";

import { useCallback, useEffect, useState } from "react";
import type { SourceFileRecord } from "@/lib/original-sources/types";
import { workflowStatusLabel, type WorkflowStatus } from "@/lib/operations/workflow";

type WorkflowSourceRecord = SourceFileRecord & { workflowStatus: WorkflowStatus };

export function SourceFileManager() {
  const [records, setRecords] = useState<WorkflowSourceRecord[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [ocrImportId, setOcrImportId] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [businessDates, setBusinessDates] = useState<Record<string, string>>({});

  const loadRecords = useCallback(async () => {
    const response = await fetch("/api/original-sources", { cache: "no-store" });
    const body = await response.json();
    if (!response.ok) throw new Error(body.message || "原本一覧を取得できません");
    setRecords(body.records);
  }, []);

  useEffect(() => {
    loadRecords().catch((loadError) => {
      setError(loadError instanceof Error ? loadError.message : "原本一覧を取得できません");
    });
  }, [loadRecords]);

  async function upload(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file) {
      setError("登録する原本ファイルを選択してください");
      return;
    }
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const formData = new FormData();
      formData.set("file", file);
      if (ocrImportId.trim()) formData.set("ocrImportId", ocrImportId.trim());
      const response = await fetch("/api/original-sources", { method: "POST", body: formData });
      const body = await response.json();
      if (!response.ok) throw new Error(body.message || "原本を登録できません");
      setFile(null);
      setOcrImportId("");
      setMessage("原本を改変せず登録しました");
      await loadRecords();
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "原本を登録できません");
    } finally {
      setSaving(false);
    }
  }

  async function archive(record: SourceFileRecord) {
    const reason = window.prompt(`${record.originalFilename} のアーカイブ理由を入力してください`);
    if (reason === null) return;
    setError("");
    setMessage("");
    const response = await fetch(`/api/original-sources/${record.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason }),
    });
    const body = await response.json();
    if (!response.ok) {
      setError(body.message || "アーカイブできません");
      return;
    }
    setMessage(body.message);
    await loadRecords();
  }

  async function startManualImport(record: WorkflowSourceRecord) {
    const businessDate = businessDates[record.id] ?? "";
    if (!businessDate) {
      setError("営業日を入力してください");
      return;
    }
    const response = await fetch(`/api/original-sources/${record.id}/imports`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ businessDate }),
    });
    const body = await response.json();
    if (!response.ok) {
      setError(body.message || "取込待ちを作成できません");
      return;
    }
    window.location.href = `/ocr?sourceId=${encodeURIComponent(record.id)}&importId=${encodeURIComponent(body.importId)}&sourceName=${encodeURIComponent(record.originalFilename)}`;
  }

  function nextHref(record: WorkflowSourceRecord) {
    if (record.workflowStatus === "product-matching" || record.workflowStatus === "sales-confirmation") {
      return "/products/matching";
    }
    if (record.workflowStatus === "completed") return "/";
    if (record.ocrImportId) {
      return `/ocr?sourceId=${encodeURIComponent(record.id)}&importId=${encodeURIComponent(record.ocrImportId)}&sourceName=${encodeURIComponent(record.originalFilename)}`;
    }
    return null;
  }

  return (
    <div className="grid source-file-sections">
      <form className="card product-form" onSubmit={upload}>
        <section className="form-section">
          <h2>原本を登録</h2>
          <p className="muted">
            ファイルは変換・再圧縮せず、非公開Storageへ保存します。OCRは実行しません。
          </p>
          {error ? <p className="notice error">{error}</p> : null}
          {message ? <p className="notice success">{message}</p> : null}
          <div className="form-grid">
            <label className="field">
              <span>原本ファイル</span>
              <input
                accept="image/jpeg,image/png,image/webp,image/heic,image/heif,application/pdf"
                onChange={(event) => setFile(event.target.files?.[0] ?? null)}
                type="file"
              />
            </label>
            <label className="field">
              <span>関連するOCR取込ID（任意）</span>
              <input
                onChange={(event) => setOcrImportId(event.target.value)}
                placeholder="UUIDを入力"
                type="text"
                value={ocrImportId}
              />
            </label>
          </div>
        </section>
        <div className="form-actions">
          <button className="button primary" disabled={saving} type="submit">
            {saving ? "登録中…" : "原本を登録"}
          </button>
        </div>
      </form>

      <section className="card panel">
        <div className="panel-head">
          <h2>原本台帳</h2>
          <span className="status">{records.length}件</span>
        </div>
        {records.length === 0 ? (
          <p className="muted">登録済みの原本はありません。</p>
        ) : (
          <div className="list">
            {records.map((record) => (
              <div className="list-row source-file-row" key={record.id}>
                <div>
                  <strong>{record.originalFilename}</strong>
                  <p className="muted source-file-meta">
                    {record.mimeType} / {record.sizeBytes.toLocaleString()} bytes / SHA-256:{" "}
                    <code>{record.sha256}</code>
                  </p>
                  <small className="muted">
                    保存日時: {new Date(record.storedAt).toLocaleString("ja-JP")}
                    {record.ocrImportId ? ` / OCR取込ID: ${record.ocrImportId}` : ""}
                  </small>
                  <p><span className="status warning">{workflowStatusLabel(record.workflowStatus)}</span></p>
                </div>
                <div className="row-actions">
                  <a href={`/api/original-sources/${record.id}`}>取得</a>
                  {record.workflowStatus === "import-waiting" ? (
                    <>
                      <input
                        aria-label={`${record.originalFilename}の営業日`}
                        onChange={(event) => setBusinessDates((current) => ({
                          ...current,
                          [record.id]: event.target.value,
                        }))}
                        type="date"
                        value={businessDates[record.id] ?? ""}
                      />
                      <button className="button secondary" onClick={() => startManualImport(record)} type="button">
                        手入力を開始
                      </button>
                    </>
                  ) : nextHref(record) ? <a href={nextHref(record) ?? "#"}>次の作業へ</a> : null}
                  <button className="text-button" onClick={() => archive(record)} type="button">
                    アーカイブ
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
