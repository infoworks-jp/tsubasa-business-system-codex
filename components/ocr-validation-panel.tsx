"use client";

import Image from "next/image";
import { useEffect, useMemo, useState, type ChangeEvent, type DragEvent } from "react";
import { Upload, Sparkles } from "lucide-react";
import type { OcrAnalysis, OcrEngine } from "@/lib/ocr/types";
import type { OcrImportDraftRow, OcrImportRecord } from "@/lib/ocr/import-types";
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
  if (!analysis) {
    return [{ productName: "", quantity: "", amount: "", timeSlot: "" }];
  }

  return [
    {
      productName: analysisValue(analysis, "productName"),
      quantity: analysisValue(analysis, "quantity"),
      amount: analysisValue(analysis, "amount"),
      timeSlot: analysisValue(analysis, "timeSlot"),
    },
  ];
}

export function OcrValidationPanel() {
  const [engineId, setEngineId] = useState(ENGINES[0].id);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imageName, setImageName] = useState("");
  const [isDragging, setIsDragging] = useState<DragState>("idle");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analyses, setAnalyses] = useState<OcrAnalysis[]>([]);
  const [importRows, setImportRows] = useState<OcrImportDraftRow[]>([]);
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

  async function handleFile(file: File | null) {
    if (!file) return;
    if (imageUrl) URL.revokeObjectURL(imageUrl);
    setError(null);
    setSaveMessage(null);
    setSavedRecord(null);
    setIsAnalyzing(true);
    setAnalyses([]);
    setImportRows([]);
    const objectUrl = URL.createObjectURL(file);
    setImageUrl(objectUrl);
    setImageName(file.name);

    try {
      const results = await Promise.allSettled(ENGINES.map((engine) => engine.analyze(file)));
      const fulfilled = results.flatMap((result) =>
        result.status === "fulfilled" ? [result.value] : [],
      );
      const rejected = results.filter((result) => result.status === "rejected");

      setAnalyses(fulfilled);
      setImportRows(createDraftRowsFromAnalysis(fulfilled[0]));
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
    setImportRows((current) => [
      ...current,
      { productName: "", quantity: "", amount: "", timeSlot: "" },
    ]);
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
            <p className="eyebrow">OCR proof</p>
            <h2>画像から券売機ジャーナルを読み取る</h2>
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
            <p>画像をドラッグ&ドロップ、またはクリックして選択</p>
          </div>
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

            {analyses.length > 0 ? (
              <div className="ocr-result-column">
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

                <section className="card panel">
                  <div className="panel-head compact">
                    <div>
                      <p className="eyebrow">Import</p>
                      <h2>券売機OCR取込</h2>
                    </div>
                    <span className="badge">OCR平均信頼度 {formatConfidence(averageConfidence)}</span>
                  </div>

                  <p className="muted" style={{ marginTop: "8px" }}>
                    OCR結果を手修正して保存できます。保存時に商品マスターへ自動照合し、未登録商品は要確認として登録します。
                  </p>

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
                              <div className="empty-state">OCR結果を読み取ると取込行が表示されます。</div>
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
                    <button
                      className="button"
                      type="button"
                      onClick={() => setConfirmingSave(true)}
                      disabled={importRows.length === 0}
                    >
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
            ) : null}
          </div>
        ) : (
          <div className="empty-state">画像をアップロードすると、ここにプレビューとOCR結果が表示されます。</div>
        )}
      </section>

      {confirmingSave && (
        <div className="modal-backdrop" role="presentation">
          <section aria-modal="true" className="confirm-modal" role="dialog" aria-labelledby="ocr-import-confirm-title">
            <p className="eyebrow">Final check</p>
            <h2 id="ocr-import-confirm-title">この内容で取込保存しますか？</h2>
            <p className="muted">保存後に商品マスターへ自動照合し、未登録商品は要確認として登録されます。</p>
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
