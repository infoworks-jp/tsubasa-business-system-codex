import "server-only";
import type { OcrImportRecord } from "./import-types";

declare global {
  var __tsubasaOcrImports: OcrImportRecord[] | undefined;
}

function getStore() {
  globalThis.__tsubasaOcrImports ??= [];
  return globalThis.__tsubasaOcrImports;
}

export function saveOcrImport(record: OcrImportRecord) {
  const store = getStore();
  store.unshift(record);
  return record;
}

export function listOcrImports() {
  return [...getStore()];
}
