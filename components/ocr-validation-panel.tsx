"use client";

import Image from "next/image";
import { useEffect, useMemo, useState, type ChangeEvent, type DragEvent } from "react";
import { Upload, Sparkles } from "lucide-react";
import type { OcrAnalysis, OcrEngine } from "@/lib/ocr/types";
import { GeminiVisionEngine, OpenAiVisionEngine, TesseractEngine } from "@/lib/ocr/openai-engine";

type DragState = "idle" | "dragging";

const ENGINES: OcrEngine[] = [new OpenAiVisionEngine(), new GeminiVisionEngine(), new TesseractEngine()];

function formatConfidence(confidence: number) {
  return confidence > 0 ? `${confidence}%` : "要確認";
}

export function OcrValidationPanel() {
  const [engineId, setEngineId] = useState(ENGINES[0].id);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imageName, setImageName] = useState("");
  const [isDragging, setIsDragging] = useState<DragState>("idle");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analyses, setAnalyses] = useState<OcrAnalysis[]>([]);
  const [error, setError] = useState<string | null>(null);

  const selectedEngine = useMemo(
    () => ENGINES.find((engine) => engine.id === engineId) ?? ENGINES[0],
    [engineId],
  );
  const selectedAnalysis = useMemo(
    () => analyses.find((analysis) => analysis.engineId === engineId) ?? analyses[0],
    [analyses, engineId],
  );

  useEffect(() => {
    return () => {
      if (imageUrl) URL.revokeObjectURL(imageUrl);
    };
  }, [imageUrl]);

  async function handleFile(file: File | null) {
    if (!file) return;
    if (imageUrl) URL.revokeObjectURL(imageUrl);
    setError(null);
    setIsAnalyzing(true);
    setAnalyses([]);
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
              </div>
            ) : null}
          </div>
        ) : (
          <div className="empty-state">画像をアップロードすると、ここにプレビューとOCR結果が表示されます。</div>
        )}
      </section>
    </div>
  );
}
