"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState, type ChangeEvent, type DragEvent } from "react";
import { Upload, Sparkles } from "lucide-react";
import type { OcrAnalysis, OcrEngine } from "@/lib/ocr/types";
import type {
  OcrExecutionState,
  OcrImportDraftRow,
  OcrImportRecord,
} from "@/lib/ocr/import-types";
import { toQueueStatusClass, toQueueStatusLabel } from "@/lib/ocr/import-utils";
import { GeminiVisionEngine, OpenAiVisionEngine, TesseractEngine } from "@/lib/ocr/openai-engine";

type DragState = "idle" | "dragging";

const ENGINES: OcrEngine[] = [new OpenAiVisionEngine(), new GeminiVisionEngine(), new TesseractEngine()];

function formatConfidence(confidence: number) {
  return confidence > 0 ? `${confidence}%` : "要確認";
}

function analysisValue(analysis: OcrAnalysis | undefined, key: string) {
  const value = analysis?.fields.find((field) => field.key === key)?.value ?? "";
  return value === "要確認" ? "" : value;
}

function createDraftRowsFromAnalysis(analysis: OcrAnalysis | undefined): OcrImportDraftRow[] {
  if (!analysis) return [];

  const productName = analysisValue(analysis, "productName");
  const quantity = analysisValue(analysis, "quantity");
  const amount = analysisValue(analysis, "amount");
  const timeSlot = analysisValue(analysis, "timeSlot");

  const hasAnyValue = [productName, quantity, amount, timeSlot].some((value) => value.length > 0);
  if (!hasAnyValue) return [];

  return [
    {
      productName,
      quantity,
      amount,
      timeSlot,
    },
  ];
}

function emptyRow(): OcrImportDraftRow {
  return { productName: "", quantity: "", amount: "", timeSlot: "" };
}

function todayString() {
  return new Date().toISOString().slice(0, 10);
}

function formatDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

type OcrValidationPanelProps = {
  initialSourceId?: string;
  initialImportId?: string;
  initialSourceName?: string;
};

export function OcrValidationPanel({
  initialSourceId,
  initialImportId,
  initialSourceName,
}: OcrValidationPanelProps) {
  const [engineId, setEngineId] = useState(ENGINES[0].id);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imageName, setImageName] = useState("");
  const [isDragging, setIsDragging] = useState<DragState>("idle");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [ocrState, setOcrState] = useState<OcrExecutionState>("not-run");
  const [analyses, setAnalyses] = useState<OcrAnalysis[]>([]);
  const [importRows, setImportRows] = useState<OcrImportDraftRow[]>([]);
  const [businessDate, setBusinessDate] = useState(todayString());
  const [queueRecords, setQueueRecords] = useState<OcrImportRecord[]>([]);
  const [queueLoading, setQueueLoading] = useState(false);
  const [queueMessage, setQueueMessage] = useState<string | null>(null);
  const [queueActionId, setQueueActionId] = useState<string | null>(null);
  const [searchText, setSearchText] = useState("");
  const [editingImportId, setEditingImportId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmingSave, setConfirmingSave] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [savedRecord, setSavedRecord] = useState<OcrImportRecord | null>(null);
  const [error, setError] = useState<string | null>(null);
  const initialImportOpened = useRef(false);

  const selectedEngine = useMemo(
    () => ENGINES.find((engine) => engine.id === engineId) ?? ENGINES[0],
    [engineId],
  );
  const selectedAnalysis = useMemo(
    () => analyses.find((analysis) => analysis.engineId === engineId) ?? analyses[0],
    [analyses, engineId],
  );
  const manualInputCompleted = useMemo(
    () =>
      importRows.some((row) =>
        [row.productName, row.quantity, row.amount, row.timeSlot].some((value) => value.trim().length > 0),
      ),
    [importRows],
  );
  const averageConfidence = useMemo(() => {
    if (!selectedAnalysis || selectedAnalysis.fields.length === 0) return 0;
    const sum = selectedAnalysis.fields.reduce((acc, field) => acc + field.confidence, 0);
    return Math.round(sum / selectedAnalysis.fields.length);
  }, [selectedAnalysis]);
  const filteredQueueRecords = useMemo(() => {
    const keyword = searchText.trim().toLowerCase();
    if (!keyword) return queueRecords;
    return queueRecords.filter((record) => {
      const source = [
        formatDateTime(record.createdAt),
        record.imageName,
        record.businessDate,
        toQueueStatusLabel(record.queueStatus),
      ]
        .join(" ")
        .toLowerCase();
      return source.includes(keyword);
    });
  }, [queueRecords, searchText]);

  useEffect(() => {
    return () => {
      if (imageUrl) URL.revokeObjectURL(imageUrl);
    };
  }, [imageUrl]);

  useEffect(() => {
    void loadQueue();
  }, []);

  useEffect(() => {
    if (!initialImportId || initialImportOpened.current || queueLoading) return;
    const linkedImport = queueRecords.find((record) => record.id === initialImportId);
    if (!linkedImport) return;

    initialImportOpened.current = true;
    startEditing(linkedImport);
    setImageName(initialSourceName || linkedImport.imageName);
    if (initialSourceId) {
      setImageUrl(`/api/original-sources/${encodeURIComponent(initialSourceId)}`);
    }
    if (linkedImport.rows.length === 0) {
      setImportRows([emptyRow()]);
    }
    setSaveMessage("原本台帳に関連付けた取込を、外部OCRを使わない手入力モードで開きました");
  }, [
    initialImportId,
    initialSourceId,
    initialSourceName,
    queueLoading,
    queueRecords,
  ]);

  async function loadQueue() {
    setQueueLoading(true);
    try {
      const response = await fetch("/api/ocr/imports", { cache: "no-store" });
      const result = (await response.json()) as { records?: OcrImportRecord[]; message?: string };
      if (!response.ok) {
        throw new Error(result.message || "Import Queueの取得に失敗しました");
      }
      setQueueRecords(result.records ?? []);
      setQueueMessage(null);
    } catch (queueError) {
      setQueueMessage(
        queueError instanceof Error
          ? queueError.message
          : "Import Queueの取得に失敗しました",
      );
    } finally {
      setQueueLoading(false);
    }
  }

  async function handleFile(file: File | null) {
    if (!file) return;
    if (imageUrl) URL.revokeObjectURL(imageUrl);
    setImageFile(file);
    setError(null);
    setSaveMessage(null);
    setSavedRecord(null);
    setOcrState("not-run");
    setAnalyses([]);
    setImportRows([]);
    const objectUrl = URL.createObjectURL(file);
    setImageUrl(objectUrl);
    setImageName(file.name);
  }

  async function runOcr() {
    if (!imageFile || isAnalyzing) return;

    setIsAnalyzing(true);
    setError(null);
    setAnalyses([]);

    try {
      const results = await Promise.allSettled(ENGINES.map((engine) => engine.analyze(imageFile)));
      const fulfilled = results.flatMap((result) =>
        result.status === "fulfilled" ? [result.value] : [],
      );
      const rejected = results.filter((result) => result.status === "rejected");

      setAnalyses(fulfilled);
      setOcrState(fulfilled.length > 0 ? "success" : "failed");

      const extractedRows = createDraftRowsFromAnalysis(fulfilled[0]);
      if (extractedRows.length > 0) {
        setImportRows(extractedRows);
      }

      if (fulfilled.length === 0) {
        const firstError = rejected[0];
        setError(
          firstError?.status === "rejected" && firstError.reason instanceof Error
            ? firstError.reason.message
            : "OCR処理に失敗しました",
        );
      } else if (rejected.length > 0) {
        setError(
          `${rejected.length}件のOCRエンジンで失敗しました。表示中の結果は成功したエンジンのみです。`,
        );
      }
    } catch (err) {
      setOcrState("failed");
      setError(err instanceof Error ? err.message : "OCR処理に失敗しました");
    } finally {
      setIsAnalyzing(false);
    }
  }

  function onDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsDragging("idle");
    const file = event.dataTransfer.files?.[0] ?? null;
    void handleFile(file);
  }

  function onInputChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    void handleFile(file);
  }

  function setImportRow(index: number, key: keyof OcrImportDraftRow, value: string) {
    setImportRows((current) =>
      current.map((row, rowIndex) => (rowIndex === index ? { ...row, [key]: value } : row)),
    );
  }

  function addImportRow() {
    setImportRows((current) => [...current, emptyRow()]);
  }

  function removeImportRow(index: number) {
    setImportRows((current) => current.filter((_, rowIndex) => rowIndex !== index));
  }

  function startEditing(record: OcrImportRecord) {
    setEditingImportId(record.id);
    setImageName(record.imageName);
    setBusinessDate(record.businessDate);
    setImportRows(
      record.rows.map((row) => ({
        productName: row.productName,
        quantity: String(row.quantity),
        amount: String(row.amount),
        timeSlot: row.timeSlot,
      })),
    );
    setSaveMessage("保存済みデータを編集モードで読み込みました");
  }

  function cancelEditing() {
    setEditingImportId(null);
    setSaveMessage("編集モードを解除しました");
  }

  async function deleteImport(importId: string) {
    setQueueActionId(importId);
    setQueueMessage(null);
    try {
      const response = await fetch(`/api/ocr/imports/${importId}`, { method: "DELETE" });
      const result = (await response.json()) as { message?: string };
      if (!response.ok) {
        throw new Error(result.message || "OCR取込データのアーカイブに失敗しました");
      }
      if (editingImportId === importId) {
        setEditingImportId(null);
      }
      setQueueMessage(result.message ?? "アーカイブしました");
      await loadQueue();
    } catch (deleteError) {
      setQueueMessage(deleteError instanceof Error ? deleteError.message : "アーカイブに失敗しました");
    } finally {
      setQueueActionId(null);
    }
  }

  async function markAsConfirmed(importId: string) {
    setQueueActionId(importId);
    setQueueMessage(null);
    try {
      const response = await fetch(`/api/ocr/imports/${importId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "confirm" }),
      });
      const result = (await response.json()) as { message?: string; record?: OcrImportRecord };
      if (!response.ok) {
        throw new Error(result.message || "確認済み更新に失敗しました");
      }
      setQueueMessage(result.message ?? "確認済みに更新しました");
      if (result.record) {
        setSavedRecord(result.record);
      }
      await loadQueue();
    } catch (confirmError) {
      setQueueMessage(confirmError instanceof Error ? confirmError.message : "確認済み更新に失敗しました");
      await loadQueue();
    } finally {
      setQueueActionId(null);
    }
  }

  async function saveImport() {
    if (saving || importRows.length === 0) return;
    setSaving(true);
    setSaveMessage(null);

    try {
      const isEditing = editingImportId !== null;
      const response = await fetch(isEditing ? `/api/ocr/imports/${editingImportId}` : "/api/ocr/imports", {
        method: isEditing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageName,
          engineId,
          ocrState,
          businessDate,
          rows: importRows,
        }),
      });

      const result = (await response.json()) as {
        message?: string;
        record?: OcrImportRecord;
      };

      if (!response.ok) {
        throw new Error(result.message || "OCR取込データの保存に失敗しました");
      }

      setSavedRecord(result.record ?? null);
      setSaveMessage(result.message || (isEditing ? "更新しました" : "保存しました"));
      setEditingImportId(null);
      setConfirmingSave(false);
      await loadQueue();
    } catch (saveError) {
      setSaveMessage(saveError instanceof Error ? saveError.message : "保存に失敗しました");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="ocr-panel">
      <section className="card panel">
        <div className="panel-head">
          <div>
            <p className="eyebrow">Ticket journal upload</p>
            <h2>券売機ジャーナル画像を取り込む</h2>
          </div>
          <span className="badge">
            <Sparkles size={14} aria-hidden="true" />
            {selectedEngine.label}
          </span>
        </div>

        {initialImportId ? (
          <p className="form-note">
            原本台帳からの手入力モードです。原本との関連を保持したまま確認・修正し、外部OCRは実行しません。
          </p>
        ) : null}

        <label className="field">
          <span>比較対象</span>
          <div className="engine-tags">
            {ENGINES.map((engine) => (
              <button
                type="button"
                key={engine.id}
                className={`tag ${engine.id === engineId ? "active" : ""}`}
                onClick={() => setEngineId(engine.id)}
                aria-pressed={engine.id === engineId}
              >
                {engine.label}
              </button>
            ))}
          </div>
          <span className="muted">同じ画像を 3 つの OCR へ送信し、結果を横並びで比較します。</span>
        </label>

        <div className="list" style={{ marginBottom: "12px" }}>
          <div className="list-row">
            <span>OCR状態</span>
            <span className={`status ${ocrState === "success" ? "success" : ocrState === "failed" ? "danger" : "warning"}`}>
              {ocrState === "success"
                ? "OCR成功"
                : ocrState === "failed"
                  ? "OCR失敗"
                  : "OCR未実行"}
            </span>
          </div>
          <div className="list-row">
            <span>入力状態</span>
            <span className={`status ${manualInputCompleted ? "success" : "warning"}`}>
              {manualInputCompleted ? "手入力済み" : "未入力"}
            </span>
          </div>
        </div>

        <div
          className={`dropzone ${isDragging === "dragging" ? "dragging" : ""}`}
          onDragEnter={(event) => {
            event.preventDefault();
            setIsDragging("dragging");
          }}
          onDragLeave={(event) => {
            event.preventDefault();
            setIsDragging("idle");
          }}
          onDragOver={(event) => event.preventDefault()}
          onDrop={onDrop}
        >
          <input type="file" accept="image/*" onChange={onInputChange} />
          <div className="dropzone-copy">
            <Upload size={18} aria-hidden="true" />
            <p>券売機ジャーナル画像をドラッグ&ドロップ、またはクリックして選択</p>
          </div>
        </div>

        <div className="form-actions" style={{ paddingInline: 0, paddingBottom: 0, justifyContent: "flex-start" }}>
          <button className="button secondary" type="button" onClick={runOcr} disabled={!imageFile || isAnalyzing}>
            {isAnalyzing ? "OCR実行中…" : "OCRを実行"}
          </button>
        </div>

        {error ? <p className="error-message">{error}</p> : null}
        {imageUrl ? (
          <div className="ocr-results-layout">
            <div className="ocr-image-column">
              <div className="ocr-preview-meta">
                <strong>{imageName}</strong>
                <span>{isAnalyzing ? "読み取り中…" : "アップロード済み"}</span>
              </div>
              <div className="ocr-image-frame">
                <Image alt="アップロード画像" src={imageUrl} fill unoptimized className="ocr-image" />
                {selectedAnalysis?.fields.map((field) => (
                  <div
                    key={field.key}
                    className={`ocr-highlight ${field.value === "要確認" ? "needs-review" : ""}`}
                    style={{
                      left: `${field.box?.x ?? 0}%`,
                      top: `${field.box?.y ?? 0}%`,
                      width: `${field.box?.width ?? 0}%`,
                      height: `${field.box?.height ?? 0}%`,
                    }}
                  />
                ))}
              </div>
            </div>

            <div className="ocr-result-column">
              {analyses.length > 0 ? (
                <>
                <div className="panel-head compact">
                  <div>
                    <p className="eyebrow">Compare</p>
                    <h2>比較結果</h2>
                  </div>
                  <span className="badge">同じ画像を 3 種類で比較</span>
                </div>

                <div className="comparison-grid">
                  {analyses.map((analysis) => (
                    <section key={analysis.engineId} className="comparison-card">
                      <div className="comparison-head">
                        <strong>{analysis.engineName}</strong>
                        <span className="badge">{analysis.summary}</span>
                      </div>
                      <div className="result-list">
                        {analysis.fields.map((field) => (
                          <article key={`${analysis.engineId}-${field.key}`} className="result-card">
                            <div className="result-top">
                              <strong>{field.label}</strong>
                              <span className={`status ${field.value === "要確認" ? "warning" : "success"}`}>
                                {field.value || "要確認"}
                              </span>
                            </div>
                            <p className="result-meta">信頼度 {formatConfidence(field.confidence)}</p>
                          </article>
                        ))}
                      </div>
                    </section>
                  ))}
                </div>
                </>
              ) : (
                <div className="empty-state">OCR未実行または失敗のため、抽出結果は未表示です。</div>
              )}

                <section className="card panel">
                  <div className="panel-head compact">
                    <div>
                      <p className="eyebrow">Import</p>
                      <h2>{editingImportId ? "券売機OCR取込（再編集）" : "券売機OCR取込"}</h2>
                    </div>
                    <span className="badge">OCR平均信頼度 {formatConfidence(averageConfidence)}</span>
                  </div>

                  <p className="muted" style={{ marginTop: "8px" }}>
                    OCR未実行・OCR失敗でも、画像を見ながら手入力してImport Queueへ保存できます。
                  </p>

                  <label className="field" style={{ marginTop: "10px", marginBottom: 0 }}>
                    <span>営業日</span>
                    <input
                      type="date"
                      value={businessDate}
                      onChange={(event) => setBusinessDate(event.target.value)}
                    />
                  </label>

                  <div className="table-wrap" style={{ marginTop: "14px" }}>
                    <table>
                      <thead>
                        <tr>
                          <th>商品名</th>
                          <th>数量</th>
                          <th>金額</th>
                          <th>時間帯</th>
                          <th>操作</th>
                        </tr>
                      </thead>
                      <tbody>
                        {importRows.length === 0 ? (
                          <tr>
                            <td colSpan={5}>
                              <div className="empty-state">行を追加して手入力してください。</div>
                            </td>
                          </tr>
                        ) : (
                          importRows.map((row, index) => (
                            <tr key={`import-row-${index + 1}`}>
                              <td>
                                <input
                                  value={row.productName}
                                  onChange={(event) => setImportRow(index, "productName", event.target.value)}
                                />
                              </td>
                              <td>
                                <input
                                  value={row.quantity}
                                  onChange={(event) => setImportRow(index, "quantity", event.target.value)}
                                />
                              </td>
                              <td>
                                <input
                                  value={row.amount}
                                  onChange={(event) => setImportRow(index, "amount", event.target.value)}
                                />
                              </td>
                              <td>
                                <input
                                  value={row.timeSlot}
                                  onChange={(event) => setImportRow(index, "timeSlot", event.target.value)}
                                />
                              </td>
                              <td>
                                <button
                                  className="button secondary"
                                  type="button"
                                  onClick={() => removeImportRow(index)}
                                  disabled={importRows.length <= 1}
                                >
                                  行削除
                                </button>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>

                  <div className="form-actions" style={{ paddingInline: 0, paddingBottom: 0 }}>
                    <button className="button secondary" type="button" onClick={addImportRow}>
                      行を追加
                    </button>
                    {editingImportId ? (
                      <button className="button secondary" type="button" onClick={cancelEditing}>
                        編集を解除
                      </button>
                    ) : null}
                    <button className="button" type="button" onClick={() => setConfirmingSave(true)} disabled={importRows.length === 0}>
                      {editingImportId ? "更新前確認" : "保存前確認"}
                    </button>
                  </div>

                  {saveMessage ? (
                    <p className="result-note" style={{ marginTop: "10px" }}>
                      {saveMessage}
                    </p>
                  ) : null}

                  {savedRecord ? (
                    <div style={{ marginTop: "14px" }}>
                      <p className="result-meta">
                        保存結果: 全{savedRecord.summary.total}件 / 処理済み{savedRecord.summary.processed}件 /
                        要確認{savedRecord.summary.needsReview}件
                      </p>
                      <div className="table-wrap">
                        <table>
                          <thead>
                            <tr>
                              <th>商品名</th>
                              <th>数量</th>
                              <th>金額</th>
                              <th>時間帯</th>
                              <th>照合状態</th>
                              <th>理由</th>
                            </tr>
                          </thead>
                          <tbody>
                            {savedRecord.rows.map((row) => (
                              <tr key={row.id}>
                                <td>{row.productName}</td>
                                <td>{row.quantity}</td>
                                <td>¥{row.amount.toLocaleString("ja-JP")}</td>
                                <td>{row.timeSlot}</td>
                                <td>
                                  <span className={`status ${row.status === "processed" ? "success" : "warning"}`}>
                                    {row.status === "processed" ? "処理済み" : "要確認"}
                                  </span>
                                </td>
                                <td>{row.reviewReason ?? "―"}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ) : null}
                </section>
            </div>
          </div>
        ) : (
          <div className="empty-state">画像をアップロードすると、ここにプレビューとOCR結果が表示されます。</div>
        )}
      </section>

      <section className="card panel">
        <div className="panel-head">
          <div>
            <p className="eyebrow">Import queue</p>
            <h2>Import Queue</h2>
          </div>
          <span className="badge">保存データ管理</span>
        </div>

        <label className="field" style={{ marginBottom: "10px" }}>
          <span>検索</span>
          <input
            placeholder="保存日時・画像名・営業日・状態で検索"
            value={searchText}
            onChange={(event) => setSearchText(event.target.value)}
          />
        </label>

        {queueMessage ? <p className="result-note">{queueMessage}</p> : null}
        {queueLoading ? <div className="empty-state">Import Queueを読み込み中です。</div> : null}

        {!queueLoading && filteredQueueRecords.length === 0 ? (
          <div className="empty-state">Import Queueはまだありません。</div>
        ) : null}

        {!queueLoading && filteredQueueRecords.length > 0 ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>保存日時</th>
                  <th>画像</th>
                  <th>OCR件数</th>
                  <th>状態</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {filteredQueueRecords.map((record) => {
                  return (
                    <tr key={record.id}>
                      <td>{formatDateTime(record.createdAt)}</td>
                      <td>{record.imageName}</td>
                      <td>{record.summary.total}</td>
                      <td>
                        <span className={`status ${toQueueStatusClass(record.queueStatus)}`}>
                          {toQueueStatusLabel(record.queueStatus)}
                        </span>
                      </td>
                      <td>
                        <div className="form-actions" style={{ padding: 0, justifyContent: "flex-start" }}>
                          <button
                            className="button secondary"
                            type="button"
                            onClick={() => void markAsConfirmed(record.id)}
                            disabled={record.queueStatus === "confirmed" || queueActionId === record.id}
                          >
                            確認済みにする
                          </button>
                          <button
                            className="button secondary"
                            type="button"
                            onClick={() => startEditing(record)}
                            disabled={queueActionId === record.id}
                          >
                            編集
                          </button>
                          <button
                            className="button"
                            type="button"
                            onClick={() => void deleteImport(record.id)}
                            disabled={queueActionId === record.id}
                          >
                            アーカイブ
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : null}
      </section>

      {confirmingSave && (
        <div className="modal-backdrop" role="presentation">
          <section aria-modal="true" className="confirm-modal" role="dialog" aria-labelledby="ocr-import-confirm-title">
            <p className="eyebrow">Final check</p>
            <h2 id="ocr-import-confirm-title">{editingImportId ? "この内容で更新しますか？" : "この内容で取込保存しますか？"}</h2>
            <p className="muted">{editingImportId ? "更新後、この内容がImport Queueへ反映されます。" : "保存後、この内容がImport Queueへ登録されます。"}</p>
            <div className="table-wrap" style={{ marginTop: "12px" }}>
              <table>
                <thead>
                  <tr>
                    <th>商品名</th>
                    <th>数量</th>
                    <th>金額</th>
                    <th>時間帯</th>
                  </tr>
                </thead>
                <tbody>
                  {importRows.map((row, index) => (
                    <tr key={`confirm-row-${index + 1}`}>
                      <td>{row.productName || "要確認"}</td>
                      <td>{row.quantity || "0"}</td>
                      <td>{row.amount || "0"}</td>
                      <td>{row.timeSlot || "要確認"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="form-actions" style={{ paddingInline: 0, paddingBottom: 0 }}>
              <button className="button secondary" type="button" onClick={() => setConfirmingSave(false)}>
                戻って修正
              </button>
              <button className="button" type="button" onClick={saveImport} disabled={saving}>
                {saving ? "保存中…" : editingImportId ? "更新する" : "保存する"}
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
