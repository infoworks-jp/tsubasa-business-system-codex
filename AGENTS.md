# AGENTS

このファイルは、このリポジトリで作業する AI コーディングエージェント向けの即時運用ガイドです。

## 目的と範囲

- 現在の実装段階は Phase 1B（商品マスター）。背景は [README.md](README.md) を参照。
- 仕様・計画・決定事項の正本は docs 配下。要件の再解釈より、まず既存文書を参照する。

## まず読む文書

- 全体像: [README.md](README.md)
- 仕様: [docs/SPECIFICATION.md](docs/SPECIFICATION.md)
- フェーズと完了条件: [docs/PHASE_PLAN.md](docs/PHASE_PLAN.md)
- テスト方針: [docs/TEST_PLAN.md](docs/TEST_PLAN.md)
- 意思決定記録: [docs/DECISIONS.md](docs/DECISIONS.md)
- 未決事項: [docs/OPEN_QUESTIONS.md](docs/OPEN_QUESTIONS.md)

## 主要コマンド

- 依存導入: pnpm install
- 開発起動: pnpm dev
- 単体テスト: pnpm test
- 型検査: pnpm typecheck
- Lint: pnpm lint
- 本番ビルド: pnpm build

## 実装境界

- App Router の UI は app と components。
- 業務ロジックは lib 配下に集約し、画面から直接データ層を増殖させない。
- 商品関連 API は app/api/products 配下、OCR 関連 API は app/api/ocr 配下。
- Supabase 連携は lib/supabase と lib/products/supabase-repository.ts を起点に扱う。

## Agent Approval 方針

- 承認前は、破壊的操作・外部影響のある変更を実行しない。
- 承認が必要な操作例: 依存追加/削除、DB マイグレーション変更、環境変数や認証情報の扱い変更、大規模リファクタ。
- 承認済みでも、秘密情報や本番データをリポジトリへ保存しない。
- 未承認・未検証の機能は「完成」と表現しない（根拠: [docs/DECISIONS.md](docs/DECISIONS.md)）。

## 承認前チェックリスト

- 変更目的と影響範囲を 3 行以内で明示したか。
- 既存決定事項（特にデータ改変禁止、推測補完禁止、資産分離）に反していないか。
- 追加作業が Future Features へ逸脱していないか（対象外は [docs/PHASE_PLAN.md](docs/PHASE_PLAN.md)）。

## 承認後チェックリスト

- 最小変更で実装し、無関係な整形や巻き込み変更を避ける。
- 変更後は pnpm typecheck と pnpm test を優先実行し、必要なら pnpm build まで確認する。
- 挙動変更時は docs の該当文書更新要否を確認する。

## 禁止・注意事項

- 現行資産（既存アプリ、既存 Excel、既存データ）を変更しない。
- 数値の推測補完や自動調整をしない。不一致は要確認として保持する。
- Codex 版と他系統の環境・データを共有しない。
- 以前のセッションでは OCR 拡張より環境復旧（pnpm install/dev 成功）が優先された。詰まった場合は新機能追加より開発可能状態の回復を先に行う。

## 変更提案の出し方

- 先に「何を、なぜ、どのファイルを」短く提示する。
- 実装後は、変更ファイル、検証結果、残課題の順で報告する。
- 不明点は仮定で進めず、未決事項として切り出して確認する（参照: [docs/OPEN_QUESTIONS.md](docs/OPEN_QUESTIONS.md)）。
## 加来さんの固定運用ルール

- 主担当はChatGPTデスクトップ版Work＋Computer Use。GitHub Copilotは予備であり、Workが使える間は新規作業を依頼しない。
- 既存アプリ、既存Excel、既存データ、公開サイトは変更しない。
- 数字を推測・補完・丸め・自動調整しない。不明値は要確認。
- 実データ、券売機写真、通帳、公開、デプロイ、外部OCR、課金、秘密情報は、内容を明示してから扱う。
- 既存番号付きSupabase migrationは変更せず、新しい追記migrationだけを使う。
- `.temp`は変更・削除・コミットしない。
- 作業前に現在のブランチと`git status`を確認し、作業後はテストと`git status`を報告する。
- 方針変更時は、理由・費用・影響を先に明示する。
