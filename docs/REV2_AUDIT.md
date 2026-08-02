# TSUBASA Rev.2 棚卸し・参照・重複監査

基準ブランチ: `backup/rev1`  
作業ブランチ: `develop/rev2`  
監査日: 2026-08-02  
公開判定: **公開前QA合格（main統合・公開画面確認前）**

## 1. 安全確認

- `backup/rev1` を `main` から作成済み。
- `develop/rev2` を `backup/rev1` から作成済み。
- `main` は変更対象外。
- 本文の棚卸しはRev.1開始時点の履歴として保存する。
- Rev.2は実Supabaseへ適用し、公開前QAとPlaywrightを実施済み。

## 2. 全ファイル一覧

コード検索索引で確認したテキスト71件と、文書から参照される画像9件、合計80件。

### ルート・設定（10）

- .env.example
- AGENTS.md
- README.md
- eslint.config.mjs
- next-env.d.ts
- next.config.ts
- package.json
- pnpm-lock.yaml
- pnpm-workspace.yaml
- tsconfig.json

### app（17）

- app/globals.css
- app/layout.tsx
- app/login/page.tsx
- app/(dashboard)/layout.tsx
- app/(dashboard)/page.tsx
- app/(dashboard)/ocr/page.tsx
- app/(dashboard)/products/page.tsx
- app/(dashboard)/products/new/page.tsx
- app/(dashboard)/products/[id]/edit/page.tsx
- app/(dashboard)/products/[id]/prices/page.tsx
- app/(dashboard)/quality/page.tsx
- app/(dashboard)/quality/issues/page.tsx
- app/api/ocr/route.ts
- app/api/ocr/gemini/route.ts
- app/api/ocr/imports/route.ts
- app/api/ocr/imports/[id]/route.ts
- app/api/products/route.ts
- app/api/products/[id]/route.ts
- app/api/products/[id]/prices/route.ts

### components（6）

- components/app-shell.tsx
- components/connection-required.tsx
- components/ocr-validation-panel.tsx
- components/product-form.tsx
- components/product-status-button.tsx

### lib（16）

- lib/ocr/compare.test.ts
- lib/ocr/import-types.ts
- lib/ocr/mock-engine.ts
- lib/ocr/openai-engine.test.ts
- lib/ocr/openai-engine.ts
- lib/ocr/types.ts
- lib/products/get-repository.ts
- lib/products/preview-repository.ts
- lib/products/products.test.ts
- lib/products/repository.ts
- lib/products/supabase-repository.ts
- lib/products/types.ts
- lib/products/validation.ts
- lib/quality/mock-data.ts
- lib/supabase/README.md
- lib/supabase/client.ts
- lib/supabase/server.ts

### docs（12）

- docs/ARCHITECTURE_PROPOSAL.md
- docs/CHANGELOG.md
- docs/COMPARISON_PLAN.md
- docs/DATA_MODEL.md
- docs/DECISIONS.md
- docs/MIGRATION_PLAN.md
- docs/PHASE_PLAN.md
- docs/SCREEN_LIST.md
- docs/SPECIFICATION.md
- docs/TEST_PLAN.md
- docs/screenshots/manager-home.png
- docs/screenshots/login.png
- docs/screenshots/product-master.png
- docs/screenshots/products-list.png
- docs/screenshots/product-create.png
- docs/screenshots/product-edit.png
- docs/screenshots/product-price-history.png
- docs/screenshots/product-validation-errors.png
- docs/screenshots/products-supabase-not-configured.png

### Supabase（10）

- supabase/migrations/README.md
- supabase/migrations/00000000000000_phase1_template.sql
- supabase/migrations/20260717010000_create_product_master.sql
- supabase/migrations/20260718000000_product_master_enhanced.sql
- supabase/migrations/20260718010000_seed_test_products.sql
- supabase/migrations/20260718020000_apply_product_master.sql
- supabase/migrations/20260718030000_seed_test_products.sql
- supabase/migrations/20260723120000_add_ticket_ocr_import_tables.sql
- supabase/migrations/20260723130000_add_import_queue_and_sales_totals.sql
- supabase/migrations/20260723140000_allow_anon_ocr_queue_policies.sql

## 3. 全API一覧

| API | Method | 主参照 |
|---|---|---|
| /api/products | GET | ProductRepository |
| /api/products | POST | ProductRepository |
| /api/products/[id] | GET | ProductRepository |
| /api/products/[id] | PUT | ProductRepository |
| /api/products/[id] | PATCH | ProductRepository |
| /api/products/[id]/prices | GET | ProductRepository |
| /api/ocr | POST | OpenAI/Tesseract OCR engine |
| /api/ocr/gemini | POST | OpenAI/Tesseract OCR engine |
| /api/ocr/imports | GET | ticket_ocr_imports |
| /api/ocr/imports | POST | ticket_ocr_imports, ticket_ocr_import_rows |
| /api/ocr/imports/[id] | PATCH | ticket_ocr_imports, ticket_ocr_import_rows, ticket_product_sales_totals |

## 4. 全JSON一覧

- package.json
- tsconfig.json
- APIレスポンスJSON: products、OCR、OCR imports。
- OCR解析JSON: OcrAnalysis。
- リポジトリ内に業務データ正本となる独立JSONファイルは検出されない。
- package lockは pnpm-lock.yaml。

## 5. 全DB一覧

物理SQLで作成されるテーブルは次の5つ。

| テーブル | 用途 | Rev.2指定との関係 |
|---|---|---|
| products | 商品 | product_masterへ統合対象 |
| product_prices | 価格履歴 | product_masterへ統合方針要決定 |
| ticket_ocr_imports | OCR取込単位 | daily_journal/documentsへ再設計対象 |
| ticket_ocr_import_rows | OCR行 | journal_productsへ再設計対象 |
| ticket_product_sales_totals | 商品集計 | journal_products/monthly_summaryから算出対象 |

DB関数:

- set_updated_at
- create_product_with_price
- update_product_with_price

指定された `daily_journal`、`journal_products`、`journal_hours`、`monthly_summary`、`bank_transactions`、`expenses`、`payroll`、`documents`、`product_master` は未実装。

## 6. 全画面一覧

実装画面は9系統。

| 画面 | URL | データ |
|---|---|---|
| ログイン | /login | 固定表示 |
| 経営者ホーム | / | ticket_ocr_imports, ticket_product_sales_totals, products |
| OCR | /ocr | OCR API、OCR imports API |
| 商品一覧 | /products | ProductRepository |
| 商品登録 | /products/new | ProductRepository |
| 商品編集 | /products/[id]/edit | ProductRepository |
| 価格履歴 | /products/[id]/prices | ProductRepository |
| 品質 | /quality | lib/quality/mock-data.ts |
| 品質課題 | /quality/issues | lib/quality/mock-data.ts |

KPI専用、ABC、曜日、時間帯、月別、経営コンサル、通帳画面は未実装。

## 7. 全計算処理一覧

- 商品入力検証: Zodによるカテゴリ、価格、日付等の検証。
- 商品価格期間: DB関数で旧価格終了、新価格追加。
- OCR正規化: JSON解析、フィールド正規化、Tesseract結果変換。
- OCR取込照合: 商品候補、行状態、取込状態の判定。
- 商品売上集計: OCR行から ticket_product_sales_totals を更新。
- 経営者ホーム集計: OCR取込と商品売上合計を画面側で集計。
- 品質件数: 固定モック配列をfilterして集計。
- KPI、ABC、曜日、時間帯、月別、経営コンサル、通帳の共通計算層は存在しない。

## 8. データ参照マップ

| 機能 | 現在の参照 | 判定 |
|---|---|---|
| KPI/ホーム | ticket_ocr_imports, ticket_product_sales_totals, products | 部分実装、共通正本なし |
| 商品別 | ticket_product_sales_totals | OCR集計テーブル依存 |
| ABC | 未実装 | NG |
| 曜日 | 未実装 | NG |
| 時間帯 | 未実装 | NG |
| 月別 | 未実装 | NG |
| 経営コンサル | 未実装 | NG |
| 品質検証 | lib/quality/mock-data.ts | 固定値のためNG |
| 通帳 | 未実装 | NG |
| 商品マスター | products, product_prices | 実装あり、DB未適用 |
| OCR | ticket_ocr_imports, ticket_ocr_import_rows | 実装あり、DB未適用 |

## 9. 重複処理・同義データ

| 重複 | 箇所 | 影響 |
|---|---|---|
| 商品テーブル作成 | 20260717010000 と 20260718020000 | 同一構造の二重管理 |
| 商品DB関数 | 20260717010000、20260718000000、20260718020000 | create/updateロジック三重化 |
| テスト商品投入 | 20260718010000 と 20260718030000 | 同一データ二重投入候補 |
| OCR API | /api/ocr と /api/ocr/gemini | 同一エンジン参照、入口重複 |
| 商品売上 | OCR行と ticket_product_sales_totals | 明細と派生集計を両保持 |
| 品質表示 | quality/page と quality/issues | 同じ固定モックを別画面集計 |
| 商品データ層 | PreviewProductRepository と SupabaseProductRepository | 環境別だが固定プレビュー値が本番誤認要因 |
| 売上集計 | imports/[id] と dashboard/page | 保存時集計と表示時集計が分散 |

## 10. 未使用・使用疑義コード

静的索引による候補。削除前にビルド・参照解析が必要。

- lib/ocr/mock-engine.ts: 実装コードからの参照を検出できない。
- lib/supabase/client.ts: 実装コードからの参照を検出できない。
- 00000000000000_phase1_template.sql: 実テーブルを作らない雛形。
- 20260718010000_seed_test_products.sql と 20260718030000_seed_test_products.sql: 片方が重複候補。
- docs記載の多数画面・テーブル: 設計のみで実装なし。

## 11. Rev.2設計原則

- 正本は指定9テーブルだけとする。
- 明細正本は daily_journal / journal_products / journal_hours。
- monthly_summaryは月次確定スナップショットに限定し、日常画面の別計算源にしない。
- 商品は product_masterだけを参照する。
- 通帳は bank_transactions、費用は expenses、給与は payroll、原本は documents。
- KPI、商品別、ABC、曜日、時間帯、月別、経営コンサル、品質検証は共通Query/Service層を通る。
- 画面内計算、固定モック、本番キャッシュ、同義集計テーブルの追加を禁止する。
- DB適用前に旧5テーブルから新9テーブルへの移行・照合手順を作る。
- 元データ削除は禁止。旧構造はバックアップ上に保持する。

## 12. 公開ゲート最新結果

- 指定9テーブル: 実装・実DB適用済み。
- 全9画面: 共通の確定データを直接参照。
- 固定モック・本番キャッシュ: Rev.2公開対象では不使用。
- DB品質検査: 15項目、NG 0件。
- Playwright: 11項目成功（9画面、QAゲート、404）。
- Consoleエラー・リンク切れ: 0件。
- 商品重複・OCR失敗・通帳未照合・売上不一致: 0件。
- スクリーンショットAI監査: 9画面確認済み。ログイン画面重複表示を検出して解消後、再取得済み。
- 7月給与: 未確定のため推測値を登録しない。
- 残工程: main統合後のPages公開と公開URL実画面確認。

公開URL確認が完了するまで、完了報告は行わない。
