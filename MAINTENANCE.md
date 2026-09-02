# つばさ3 更新ガイド

## 固定識別子

- GitHub: `infoworks-jp/tsubasa-business-system-codex`
- 公開: https://infoworks-jp.github.io/tsubasa-business-system-codex/
- 公開元: `pages-rev2/`
- DB: Supabase project `spyopczqtxypqjbhylzf`
- 正本スキーマ: `rev2`

旧Excel、`tubasa-cell.github.io`、Next.jsの開発画面を本番の代用品にしません。

## 変更したい内容とファイル

| 内容 | 検索語 | ファイル |
|---|---|---|
| Supabase URL・公開キー・スキーマ | `TSUBASA_CONFIG` | `pages-rev2/site-config.js` |
| DB読込と共通集計 | テーブル名 | `pages-rev2/rev2-data.js` |
| タブ、カード、表、経営コンサル | 表示中の見出し | `pages-rev2/index.html` |
| 曜日・祝日補正 | 日付または祝日名 | `pages-rev2/holiday-enhancements.js` |
| F/L・FLR | `__TSUBASA_FL_DIRECT__` | `pages-rev2/fl-dashboard.js` |
| キャッシュ抑止 | `__TSUBASA_FRESH_SUPABASE__` | `pages-rev2/fresh-supabase.js` |
| 曜日×時間帯 | 見出し | `pages-rev2/weekday-daypart.html` |
| 仕入・変動原価 | 見出し | `pages-rev2/procurement.html`、`procurement-detail.html` |
| シフト | `tsubasa_shift_pwa_v2` | `pages-rev2/shift/` |
| 公開・公開後確認 | `verify-live` | `.github/workflows/rev2-qa-pages.yml` |

## 変更ルール

1. 数値はSupabase `rev2` を更新し、HTMLへ直接書き足して正本化しない。
2. 推測補完しない。不明値は未確定・要確認として残す。
3. DBを再取得して検算する。
4. GitHub Pages公開後の実画面を確認する。
5. DBと公開画面の両方を確認するまで完了と言わない。

## Pro終了後

GitHub PagesとSupabaseで稼働するため、ChatGPT Proは不要です。変更作業はGitHubのファイル検索またはローカルの `rg` で対象語を探せます。
