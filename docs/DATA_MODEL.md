# データモデル案

論理設計段階の案であり、DBはまだ作成しない。全主要テーブルに `id`、`store_id`、作成・更新者、作成・更新日時、状態を持たせる。金額は円単位整数を第一候補とし、元資料に小数がある場合は要件確定まで原文も保持する。

## 主要テーブル

| テーブル | 役割 | 主要項目 |
|---|---|---|
| `stores` | 店舗 | 名称、タイムゾーン、営業日境界時刻 |
| `users` | 利用者 | 認証ID、表示名、有効状態 |
| `store_members` | 店舗権限 | 店舗、利用者、ロール |
| `products` | 商品マスター | 商品コード、商品名、カテゴリ、券売機ボタン番号、券売機表示位置、販売開始日、販売終了日、標準価格、原価（将来利用）、有効状態 |
| `product_aliases` | 取込表記の対応 | 元表記、商品、取込元、確認状態 |
| `product_prices` | 価格履歴 | 商品、価格、適用開始日、適用終了日、変更理由、根拠原本、承認者 |
| `business_days` | 営業日実績 | 日付、予定状態、実績状態、例外理由 |
| `daily_sales` | 日別売上 | 営業日、元の日別合計、確認値、確定値 |
| `product_sales` | 商品別明細 | 営業日、商品、数量、単価、金額 |
| `time_slot_sales` | 時間帯別明細 | 営業日、開始・終了時刻、数量、金額 |
| `payment_sales` | 支払別売上 | 営業日、支払区分、金額 |
| `bank_accounts` | 口座識別 | 金融機関、支店、マスキング済識別子 |
| `bank_transactions` | 通帳明細 | 取引日、摘要原文、入金、出金、残高 |
| `reconciliations` | 集計照合 | 対象日、D/P/T各合計、各差額、状態 |
| `bank_matches` | 売上・入金対応 | 売上、通帳明細、対応額、確認状態 |
| `source_files` | 原本台帳 | 種別、元ファイル名、保存先、SHA-256、サイズ、永久保存フラグ、登録日時、登録者 |
| `source_locations` | 原本内位置 | 原本、ページ番号、画像領域、シート名、行番号、セル位置 |
| `record_source_links` | 業務データと原本位置の関係 | 対象種別、対象ID、対象版、原本位置、根拠区分 |
| `import_batches` | 取込単位 | 対象、処理版、開始・終了、実行者、結果 |
| `raw_import_records` | 無加工取込 | 原本位置、原文／原データ、順序 |
| `verified_values` | 人が確認した値 | 対象、項目、値、確認者、根拠位置 |
| `confirmed_records` | 業務上確定した版 | 対象、版、承認者、承認日時 |
| `review_issues` | 要確認事項 | 種別、対象、理由、元値、差額、優先度、状態 |
| `record_revisions` | 修正版 | 対象、対象項目、変更前後、理由、変更者、変更日時、根拠原本、置換元版、状態 |
| `revision_reviews` | 修正版の確認・承認 | 修正版、確認者・日時、承認者・日時、状態、コメント |
| `audit_logs` | 操作監査 | 操作者、操作、対象、日時、変更前後 |
| `monthly_targets` | 月間目標 | 対象月、目標額、状態、承認者、版 |
| `quality_evaluations` | 品質表示の再現 | 対象日／月、評価項目、件数、計算仕様版、結果、状態 |
| `backup_runs` | バックアップ・復元証跡 | 種別、開始・終了、結果、保存先識別子、復元検証日時 |
| `export_jobs` | Excel/PDF/CSV出力 | 形式、条件、データ版、出力者、ファイルハッシュ |

## 関係

- `stores` 1対多 `business_days`、`products`、`source_files`。
- `business_days` 1対1または版管理付きで `daily_sales`、1対多で `product_sales` と `time_slot_sales`。
- `source_files` は1対多で `source_locations` と `raw_import_records` を持つ。
- 日別売上、商品別明細、時間帯別明細、通帳明細、修正版は `record_source_links` を介して1件以上の `source_locations` へ関連付けられる。
- 業務レコードは原本のページ、画像内位置、シート、行またはセル位置までたどれる。
- `reconciliations` は同一営業日の `daily_sales`、`product_sales` 合計、`time_slot_sales` 合計を参照する。
- `review_issues` は任意の業務レコード、原本位置、照合結果へ関連付ける。
- `confirmed_records` と `record_revisions` は確定版を不変の版として連鎖させる。

## 商品マスター詳細

- `category` は「ラーメン」「トッピング」「ドリンク」「ご飯」「セット」「限定」の管理値を使用する。
- `vending_machine_button_number` は券売機上のボタン識別番号、`vending_machine_display_position` は段・列または承認済み位置表現を保持する。
- `sales_start_date` と `sales_end_date` は販売期間を表し、終了日不明と販売中を区別する。
- `standard_price` は現在または登録時点の標準表示用であり、売上実績単価を上書きしない。正式な価格履歴は `product_prices` を参照する。
- `cost` は将来利用の任意項目とし、Version 1の原価・利益分析には使用しない。不明な原価を推測して登録しない。
- `is_active` は現在の利用可否であり、過去商品のレコードを削除する代わりに無効化する。
- 商品コード、ボタン番号、表示位置の一意性と有効期間の制約は、既存資産調査後に確定する。

### Phase 1B 物理構造

- `products.id` と `product_prices.id` はUUID主キー。
- `products.product_code` はNOT NULLかつ一意制約。
- `products.standard_price` は0以上の整数。
- `products.future_cost` はNULL可。入力する場合は0以上の整数。
- `products.sales_end_date` はNULLまたは `sales_start_date` 以降。
- `products.category` は6カテゴリだけを許可するCHECK制約。
- `product_prices.product_id` は `products.id` の外部キー。
- `product_prices.price` は0以上の整数。
- `product_prices.valid_to` はNULLまたは `valid_from` 以降。
- 現行価格は商品ごとに1件だけとなる部分一意インデックスを持つ。
- 商品登録と初回価格、商品更新と価格履歴変更はそれぞれDB関数内の同一トランザクションで処理する。
- 商品の通常削除操作は提供せず、`is_active` の切替を使用する。
- 価格変更時は旧履歴の終了日を設定し、新価格を別レコードとして追加する。
- RLSを有効化するが、Phase 1Bではブラウザ向けポリシーを作成しない。サーバー秘密鍵は `.env.local` からだけ読み込む。

実装マイグレーションは `supabase/migrations/20260717010000_create_product_master.sql`。未接続のため実Supabaseへの適用は未確認である。

## 券売機写真の不変性

- 券売機写真の `source_files` は永久保存対象とし、物理削除・上書き・同一キー置換を禁止する。
- 訂正版や再撮影写真は別の `source_files` として追加し、元写真との関係と理由を記録する。
- 営業日との関連付け変更はリンクの新版として履歴化し、元リンクを消去しない。
- 写真のハッシュを登録時およびバックアップ復元時に検証する。

## 値の分離

1. **原本**: `source_files`。上書き不可。ハッシュで同一性を検証する。
2. **無加工値**: `raw_import_records`。セル文字列、CSV行、OCR前画像位置をそのまま保持する。
3. **手入力・取込値**: 業務レコードの暫定版。入力者、入力方法、原本位置を保持する。
4. **確認済み値**: `verified_values`。人が原本と比較した値。確認者と根拠を必須にする。
5. **確定値**: `confirmed_records` が指す承認版。確定後の変更は新しい版と理由を作る。

確認済みと確定済みを分けることで、「読取りは正しいが業務上の締め承認前」を表現する。

## 修正履歴

- 確定レコードを直接上書きしない。
- `record_revisions` に変更日時、変更者、対象項目、変更前、変更後、変更理由、根拠原本、置換元版、状態を保存する。
- `revision_reviews` に確認者と承認者を役割別に保存する。同一人物を許可するかは権限要件で決定する。
- 修正履歴タイムラインは `record_revisions`、`revision_reviews`、`confirmed_records`、`audit_logs` を時系列に統合表示する。
- `audit_logs` は画面操作と出力・ダウンロードも記録する。
- 誤登録の取消も物理削除ではなく状態と取消版で表現する。

## 不一致管理

`reconciliations` に次を保持する。

- `daily_total`（D）
- `product_total`（P）
- `time_slot_total`（T）
- `daily_minus_product`（D-P）
- `daily_minus_time_slot`（D-T）
- `product_minus_time_slot`（P-T）
- 各値の原本・版
- 判定状態と確認メモ

差額は計算結果として保持するが、元値の調整には使わない。不一致解決時も元の照合版を残す。7月8日・9日には重点検証フラグを付ける。

## 品質・完全性データ

- 営業日単位ではD/P/T、3差額、状態、原本登録有無、未確認件数、重点検証フラグを参照する。
- 月単位では要確認、未確認、原本未登録、D/P/T不一致、通帳未照合の各件数を独立して集計する。
- `quality_evaluations` に評価項目、分母、分子、計算仕様版を保持できるようにするが、計算式が承認されるまで完全性の確定値を生成しない。
- 不明値をゼロや不一致として推測分類せず、「評価不能」または「要確認」として分母・点数から分離する。

## 経営者ホームの参照データ

- 売上指標は `business_days`、`daily_sales`、`product_sales`、`time_slot_sales` の対象版と状態を明示して集計する。
- 月間目標達成率は承認済み `monthly_targets` がある場合だけ計算する。
- ビール販売数・売上は `products` の承認済み分類に基づき、名称だけから推測しない。
- 要確認・完全性・未照合は `review_issues`、`quality_evaluations`、`bank_matches` を参照する。
- 最後のバックアップ成功日時は `backup_runs` の成功記録を使用する。単なる開始日時を成功として表示しない。

## Future Features向け拡張境界

OCR候補、AI結果、外部通知、外部決済・会計連携等は、将来専用のテーブルまたは連携境界として追加できる設計にする。ただしVersion 1の主要テーブル、入力フロー、完成条件には含めない。
