import path from "node:path";
import { createWorker } from "tesseract.js";
import { buildLocalOcrAnalysis } from "./local-analysis";

const workerPath = path.join(
  process.cwd(),
  "node_modules",
  "tesseract.js",
  "src",
  "worker-script",
  "node",
  "index.js",
);

export async function recognizeLocally(image: Buffer, imageName: string) {
  const worker = await createWorker("jpn", 1, {
    workerPath,
    langPath: path.join(process.cwd(), "lib", "ocr", "tessdata"),
    cacheMethod: "none",
    gzip: true,
  });
  try {
    const { data } = await worker.recognize(image);
    return buildLocalOcrAnalysis(data.text, imageName, data.confidence);
  } finally {
    await worker.terminate();
  }
}
