"use client";

import Image from "next/image";
import { useEffect, useMemo, useState, type ChangeEvent, type DragEvent } from "react";
import { Upload, Sparkles } from "lucide-react";
import type { OcrAnalysis, OcrEngine } from "@/lib/ocr/types";
import type {
  OcrExecutionState,
  OcrImportDraftRow,
  OcrImportRecord,
} from "@/lib/ocr/import-types";
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

function queueStatusLabel(status: OcrImportRecord["queueStatus"]) {
  if (status === "new") return "新規";
  return "要確認";
}

function queueStatusClass(status: OcrImportRecord["queueStatus"]) {
  return "warning";
}

export function OcrValidationPanel() {
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
  const [saving, setSaving] = useState(false);
  const [confirmingSave, setConfirmingSave] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [savedRecord, setSavedRecord] = useState<OcrImportRecord | null>(null);
  const [error, setError] = useState<string | null>(null);

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

  useEffect(() => {
    return () => {
      if (imageUrl) URL.revokeObjectURL(imageUrl);
    };
  }, [imageUrl]);

  useEffect(() => {
    void loadQueue();
  }, []);

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

  async function saveImport() {
    if (saving || importRows.length === 0) return;
    setSaving(true);
    setSaveMessage(null);

    try {
      const response = await fetch("/api/ocr/imports", {
        method: "POST",
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
      setSaveMessage(result.message || "保存しました");
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
                      <h2>券売機OCR取込</h2>
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
                    <button className="button" type="button" onClick={() => setConfirmingSave(true)} disabled={importRows.length === 0}>
                      保存前確認
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
          <span className="badge">保存済みデータ一覧</span>
        </div>

        {queueMessage ? <p className="result-note">{queueMessage}</p> : null}
        {queueLoading ? <div className="empty-state">Import Queueを読み込み中です。</div> : null}

        {!queueLoading && queueRecords.length === 0 ? (
          <div className="empty-state">Import Queueはまだありません。</div>
        ) : null}

        {!queueLoading && queueRecords.length > 0 ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>営業日</th>
                  <th>画像</th>
                  <th>状態</th>
                  <th>件数</th>
                  <th>要確認</th>
                </tr>
              </thead>
              <tbody>
                {queueRecords.map((record) => {
                  return (
                    <tr key={record.id}>
                      <td>{record.businessDate}</td>
                      <td>{record.imageName}</td>
                      <td>
                        <span className={`status ${queueStatusClass(record.queueStatus)}`}>
                          {queueStatusLabel(record.queueStatus)}
                        </span>
                      </td>
                      <td>{record.summary.total}</td>
                      <td>{record.summary.needsReview}</td>
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
            <h2 id="ocr-import-confirm-title">この内容で取込保存しますか？</h2>
            <p className="muted">保存後、この内容がImport Queueへ登録されます。</p>
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
                {saving ? "保存中…" : "保存する"}
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
