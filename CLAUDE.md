# PITCH LAB 開発ルール

## アプリの目的
野球（投手）の **球速145km/h達成** と **障害予防（肩・肘・腰）** に特化したトレーニング管理アプリ。個人利用。

## 技術スタック
- 指定スタック: React / TypeScript / Tailwind CSS（※使用するスタックに合わせる）
- 現在の実装: ビルド不要の Vanilla JS（ES Modules）+ 素のCSS + Canvas。localStorage に保存するオフラインPWA。
  - 既存コードを変更するときは、このスタックと周囲のコードの書き方に合わせる。
  - React/TS/Tailwind へ移行する場合は `js/logic.js`（純粋ロジック）と `js/share-canvas.js`（描画）をそのまま TS 化して流用する。

## デザインテーマ
- アスリート向け **ダークモード固定**（OSのライト設定でも切り替えない）、モダン・スポーティー。
- 色は `css/style.css` の `:root` 変数を使う。新しい色をハードコードしない。
- ジム・グラウンドで素早く入力できること：タップ領域は48px以上、数値は±ステッパー、段階評価はセグメントボタン。

## 重要仕様
- **違和感レベルが4以上の場合は警告ダイアログを出す**
  - 閾値は `SORE_ALERT_LEVEL`（`js/logic.js`）。判定は `highSoreParts()` を使う。
  - コンディション入力でいずれかの部位が新たに4以上になったら `soreAlert()`（`js/sore-alert.js`）を表示する。
  - 違和感4以上の日に高強度カテゴリ（出力・爆発力／回転軸・体幹）を記録しようとしたら `soreLogGuard()` で確認する。
- **SNSシェア用カードは Canvas 描画**（`js/share-canvas.js`。html2canvas も可）。1080×1080（フィード）／1080×1920（ストーリーズ）、PNG/JPEG。
- 警告は医療判断ではない旨を表示し、痛みが続く場合は受診を促す。

## コマンド
- `npm start` — http://localhost:8080 で配信（ES Modules のため file:// では動かない）
- `npm test` — `tests/*.test.mjs`（node:test）

## 構成
- `js/logic.js` 純粋ロジック（判定・ACWR・栄養計算・進捗）。DOMに依存させない。ロジックを追加したらテストも追加する。
- `js/db.js` 永続化（localStorage、`migrate()` でスキーマ移行）。
- `js/views/*.js` 各画面 `render(root, ctx)`。ユーザー入力をHTMLに入れるときは必ず `esc()` を通す。
- `sw.js` のファイル一覧と `CACHE` 名は、JSファイルを追加・変更したら更新する。
- 設計書: `docs/DESIGN.md`
