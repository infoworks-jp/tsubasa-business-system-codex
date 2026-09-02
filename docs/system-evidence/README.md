# ChatGPT Pro 非依存の検査記録

「大丈夫」という口頭説明ではなく、公開状態と外部依存を第三者が再確認できるようにする記録です。

## 自動検査

- 実行ファイル: `scripts/verify-pro-independence.mjs`
- 定期実行: `.github/workflows/pro-independence-audit.yml`
- 頻度: 毎日1回、および手動実行
- 結果: GitHub Actions のジョブ概要と90日保存のJSON artifact
- ChatGPT Pro: 不要

検査は、3サイトの公開応答、各 `site-manifest.json` の `chatgptProRequired: false`、つばさ3のSupabase正本への公開読取、吏央応募フォームのEdge FunctionとDB、Indeedリンク、Google Mapsリンクを対象にします。

## 判定を分ける理由

| 対象 | 自動検査する範囲 | 自動検査しない範囲 |
|---|---|---|
| つばさ3 Supabase | `rev2.monthly_summary`を本番画面と同じ公開キーで読めること | 全データ行の意味上の正しさ |
| 吏央 応募フォーム | Edge FunctionのGETとDB接続 | 実際の応募メール送信 |
| Indeed | GitHub内の札幌・横浜リンク設定 | Bot対策を回避した自動操作 |
| Google Maps | 通常のMaps検索リンクでAPIキー不要なこと | Google Maps自体の稼働保証 |

応募メールの実送信は、実在する外部宛先へメッセージを送るため自動検査に含めません。フォームはメール送信前にSupabaseへ保存する設計です。

## 固定監査記録

監査日時点の状態は `2026-09-02.json` に固定保存します。後日の状態はGitHub Actionsの各実行結果で追跡します。

## 検索語

GitHub検索では次を使うと関係箇所をすぐ探せます。

- `chatgptProRequired`
- `externalRuntimeServices`
- `sourceOfTruth`
- `rio-contact`
- `spyopczqtxypqjbhylzf`
- `xxhgerxugsjoxkbuuqhb`
- `91ce7644bf2afaab`
- `6342d3c5e932ba44`
- `maps/search/?api=1`
