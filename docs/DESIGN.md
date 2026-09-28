# 10分単位スケジュール共有ツール 設計メモ

インストール不要・ブラウザだけで動き、1日を10分単位（144スロット）で管理し、複数人で共有・編集できるWebツールの要件整理と設計案。

---

## 0. 要件整理

| 区分 | 要件 | 備考 |
|---|---|---|
| 動作環境 | PC / スマホのブラウザ（Chrome, Safari, Edge） | レスポンシブ。将来 PWA 化でホーム画面追加 |
| 時間単位 | 1スロット = 10分、1日 = 144スロット | 予定は `start`〜`end`（スロット番号、end は排他） |
| 共有 | メンバー追加・招待、同じ画面を複数人で閲覧・編集 | リアルタイム反映、同時編集の競合対策 |
| 通知 | 開始前リマインド（ブラウザ通知） | タブが閉じていても届くのは Web Push |
| 非機能 | 無料枠で運用、サーバー構築不要 | BaaS（Firebase / Supabase）を利用 |

### データモデル（全構成共通）

```text
boards   : id, name, owner_id, created_at            … 共有単位（チーム・家族など）
members  : board_id, user_id, display_name, color, role(owner|editor|viewer)
events   : id, board_id, member_id, date(YYYY-MM-DD), start(0-143), end(1-144),
           title, remind_minutes, updated_at, updated_by
invites  : token, board_id, role, expires_at          … 招待リンク用
push_subscriptions : user_id, endpoint, keys          … Web Push 用
```

時刻を「スロット番号」で持つと、10分単位のずれが原理的に起きず、重なり判定も `a.start < b.end && b.start < a.end` で済む。

---

## 1. 推奨する技術構成

### フロントエンド

| 段階 | 構成 | 向いている人 |
|---|---|---|
| ① 素のHTML/CSS/JS（1ファイル） | ビルド不要。`index.html` をダブルクリックで動く | 初心者、まず触って確かめたい |
| ② Vite + React（または Vue） | コンポーネント分割、状態管理が楽 | 中級者、機能を増やしていく |
| ③ Next.js | ルーティング・API Routes（Web Push送信処理を置ける） | 本格運用、Vercel にデプロイ |

**おすすめ:** プロトタイプは①で操作感を固め、共有機能を入れる段階で②へ移行。

### バックエンド / DB（サーバー構築不要）

| | Firebase（Firestore + Auth + FCM） | Supabase（Postgres + Auth + Realtime） |
|---|---|---|
| リアルタイム共有 | `onSnapshot` で自動同期。オフライン対応も標準 | `postgres_changes` の購読で同期 |
| 認証 | Google / メール / 匿名ログインが簡単 | 同等（Magic Link が便利） |
| 権限管理 | Security Rules（独自記法） | Row Level Security（SQL） |
| 通知 | FCM で Web Push が比較的簡単 | Edge Function + `web-push` ライブラリで自前送信 |
| 学習コスト | JS だけで完結、初心者向き | SQL の知識があると強い |
| 無料枠 | Spark プラン（小規模なら十分） | Free プラン（一定期間アクセスがないと一時停止） |

**おすすめ:** 初心者〜中級者で「リアルタイム共有 + 通知」を最短で作るなら **Firebase**。
データを表形式で扱いたい・SQL で集計したいなら **Supabase**。

ホスティングは Firebase Hosting / Vercel / Netlify / GitHub Pages のいずれも無料で HTTPS が使える（通知 API と Service Worker は HTTPS 必須）。

---

## 2. 画面レイアウト（UI/UX）

### 基本レイアウト

```text
┌────────────────────────────────────────────┐
│ ◀ 2026-09-28 ▶ 今日   🔍 👥 🔔            │ ← ヘッダー（日付移動・操作）
├──────┬──────────┬──────────┬──────────┤
│      │ ● 自分   │ ● 田中   │ ● 佐藤   │ ← メンバー列見出し（上端に固定）
├──────┼──────────┼──────────┼──────────┤
│09:00 │┌朝会────┐│          │          │
│      ││09:00-  ││          │          │   1行 = 10分
│      │└────────┘│┌作業───┐│          │   30分ごとに薄線、1時間ごとに濃線
│10:00 │          │└───────┘│          │
│  ↑時刻列は左端に固定       ━━━━━━━━━━━ ← 現在時刻ライン（赤）
```

- **縦 = 時間（144行）、横 = メンバー**。縦スクロールはスマホで自然、横はメンバーが増えたときだけスクロール。
- 時刻列（`position: sticky; left: 0`）とメンバー見出し（`position: sticky; top: 0`）を固定し、どこまでスクロールしても位置が分かる。
- 起動時・「今日」ボタンで**現在時刻の1時間前へ自動スクロール**。
- 罫線は 10分=点線 / 30分=薄い実線 / 60分=濃い実線 で階層化し、144行でも読める。
- **ズーム切替（小/標準/大）**：1スロットの高さを CSS 変数 `--h` で 12/20/32px に変更。俯瞰したいときは小、細かく入力したいときは大。

### 操作

| 端末 | 新規作成 | 編集・削除 |
|---|---|---|
| PC（マウス） | 空きマスをドラッグで範囲選択 → ダイアログ | 予定ブロックをクリック |
| スマホ（タッチ） | 開始マスをタップ → 終了マスをタップ（同じマスなら10分） | 予定ブロックをタップ |

- タッチでドラッグ選択にすると縦スクロールと衝突するため、**タップ2回方式**を採用（`touch-action: pan-x pan-y` でスクロールはブラウザに任せる）。慣れた人向けに将来「長押し → ドラッグ」を追加可能。
- 選択中の範囲は点線枠で「09:00–09:30」とプレビュー表示。
- 同じメンバーの予定が重なる場合は保存前に警告。
- 予定ブロックはメンバー色で塗り、タイトル・時刻・🔔（リマインドあり）を表示。

### 今後の拡張アイデア
- 予定ブロックのドラッグ移動・下端ドラッグで長さ変更（10分スナップ）
- 「自分だけ表示」「全員表示」の切替、週表示
- 他メンバーが編集中の予定にアイコン表示（Presence）

---

## 3. ブラウザ通知の実装方針

### 2段階で考える

| 方式 | 仕組み | タブを閉じても届く？ | 実装難易度 |
|---|---|---|---|
| A. Notification API（ページ内タイマー） | 開いているページが15秒ごとに「開始N分前の予定」をチェックし `new Notification()` | ✕（タブが開いている間のみ） | 易（プロトタイプで実装済み） |
| B. Web Push（Service Worker + Push API） | サーバー側（Cloud Functions / Edge Function）が時刻になったら Push を送信 → Service Worker が `showNotification()` | ○ | 中 |

### A. プロトタイプの流れ
1. ユーザーが「🔔 通知を許可」を押す → `Notification.requestPermission()`（**必ずボタン操作から呼ぶ**。ページ読込時に出すとブロックされやすい）
2. `setInterval` で15秒ごとに全予定を走査し、`開始時刻 - リマインド分 ≦ 現在 < 開始時刻` の予定を通知
3. 通知済みキーを localStorage に保存して二重通知を防止（`tag` オプションでも重複抑止）
4. 通知が使えない環境でも画面内トーストで必ず知らせる

### B. 本番（Web Push）の流れ
1. `navigator.serviceWorker.register('/sw.js')`
2. 許可後、`registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: VAPID公開鍵 })`（Firebase なら `getToken()`）
3. 購読情報（endpoint / keys または FCM トークン）を DB の `push_subscriptions` に保存
4. サーバー側で **1分ごとのスケジュール実行**（Firebase: Cloud Scheduler + Functions / Supabase: `pg_cron` + Edge Function）
   → 「今から remind 分後に始まる予定」を検索 → 該当メンバーの購読先へ送信
5. `sw.js` の `push` イベントで `self.registration.showNotification(title, { body, tag })`、`notificationclick` でアプリを開く

### 注意点
- **HTTPS 必須**（localhost は例外）
- **iOS Safari**: iOS 16.4 以降、**ホーム画面に追加した PWA のみ** Web Push 可（`manifest.json` が必要）。通常のタブでは通知不可
- **Android Chrome**: `new Notification()` は使えず、Service Worker の `showNotification()` が必要
- ブラウザのタブがバックグラウンドだとタイマーが間引かれるため、方式Aは「目安」と割り切る

---

## 4. プロトタイプ（`index.html`）

リポジトリ直下の [`index.html`](../index.html) が、ローカルだけで動く1ファイル版。ブラウザで開くだけで動作する。

### 実装済み
- 10分×144スロットのタイムテーブル（メンバーごとの列、時刻列・見出し固定）
- マウスのドラッグ / タッチの2タップで予定作成、クリック/タップで編集・削除
- 重なりチェック、現在時刻ライン、今日へジャンプ、ズーム切替
- メンバー追加・名前変更・色変更・削除
- リマインド（なし/5/10/15/30/60分前）＋ Notification API ＋画面内トースト
- localStorage 保存、**同じブラウザの別タブへ即時反映**（`storage` イベント）＝共有の疑似体験
- JSON 書き出し / 読み込み（手動での簡易共有）
- 印刷・画像化：表示中の日を A4（縦/横・300dpi 相当）の画像として Canvas に描画し、`window.print()` で印刷、または PNG で保存。時間帯（例 8:00–20:00）を選べる。スマホは画像を保存してから写真アプリ等で印刷

### プロトタイプの制約
- データはその端末のブラウザ内のみ（他の人・他の端末とは共有されない）
- 通知はページを開いている間のみ
- 認証・権限なし

---

## 5. 本番化のステップ（例: Firebase の場合）

1. Firebase プロジェクト作成、Hosting / Firestore / Authentication を有効化
2. `localStorage` の読み書き部分を Firestore に置き換え
   ```js
   // 購読（他の人の変更がリアルタイムに届く）
   onSnapshot(query(collection(db, 'boards', boardId, 'events'), where('date', '==', curDate)),
     (snap) => { state.events = snap.docs.map((d) => ({ id: d.id, ...d.data() })); render(); });
   // 保存
   await setDoc(doc(db, 'boards', boardId, 'events', id), { ...data, updatedAt: serverTimestamp() });
   ```
3. 認証（Google ログイン or 匿名ログイン）を追加し、Security Rules で「board のメンバーのみ読み書き可」に
4. 招待リンク `https://<app>/?invite=<token>` → ログイン後に members へ追加
5. 同時編集の重なりはトランザクション（`runTransaction`）で保存直前に再チェック
6. PWA 化（`manifest.json` + `sw.js`）→ Web Push（FCM）→ Cloud Functions のスケジュール実行でリマインド送信

Supabase の場合は 2 を `supabase.channel(...).on('postgres_changes', ...)`、3 を RLS、6 を `pg_cron` + Edge Function に読み替える。
