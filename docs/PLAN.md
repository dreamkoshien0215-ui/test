# 10分単位スケジュール共有アプリ 開発計画書

1日を10分単位（1スロット＝10分、1日＝144スロット）で管理し、複数人でリアルタイムに共有・編集できるスケジュールアプリの全体設計です。

---

## 1. 推奨技術スタック

### 結論（おすすめ構成）

| 層 | 採用技術 | 選定理由 |
|---|---|---|
| フロントエンド | **Next.js (App Router) + TypeScript** | PWA化しやすく、Vercel へそのままデプロイ可能 |
| UI | **Tailwind CSS + shadcn/ui** | タイムテーブルのような細かいグリッドを CSS Grid で組みやすい |
| ドラッグ操作 | **dnd-kit** ＋ Pointer Events 自前実装 | 予定の移動は dnd-kit、範囲選択（ドラッグで塗る）は自前の方が軽量 |
| 状態管理 | **TanStack Query** ＋ **Zustand** | サーバーデータのキャッシュと、ドラッグ中の一時状態を分離 |
| バックエンド/DB | **Supabase**（PostgreSQL） | 認証・DB・リアルタイム同期・サーバー関数が一式揃う |
| リアルタイム | **Supabase Realtime**（Postgres Changes ＋ Presence） | DB変更を全メンバーへ即時配信。Presence で「誰が閲覧中か」も表示可 |
| 認証 | **Supabase Auth**（メール Magic Link / Google） | 招待リンクとの相性が良い |
| 権限制御 | **Row Level Security (RLS)** | 「同じグループのメンバーだけ読み書き可」を DB 側で強制 |
| 通知 | **Web Push（VAPID）＋ Service Worker** | ネイティブアプリ不要でスマホにも通知可能 |
| 通知スケジューラ | **pg_cron ＋ Supabase Edge Functions** | 1分ごとに「そろそろ始まる予定」を検索して Push 送信 |
| ホスティング | **Vercel**（フロント）＋ **Supabase Cloud** | 無料枠で MVP を運用可能 |

### Supabase と Firebase の比較

| 観点 | Supabase | Firebase |
|---|---|---|
| データモデル | リレーショナル（SQL） | ドキュメント（NoSQL） |
| 「時間帯の重複チェック」 | SQL で簡単（範囲型・排他制約も使える） | クエリ制約が多く工夫が必要 |
| リアルタイム | ◯ | ◎（オフライン同期が強い） |
| 通知 | Web Push を自前実装 | FCM で楽 |
| 権限 | RLS（SQL で宣言的） | Security Rules |

→ **時間の重なり判定・集計が多い本アプリは Supabase が有利**。オフライン編集を最重視するなら Firebase も選択肢。

### 通知機能の実装アプローチ

1. **Service Worker** を登録（`next-pwa` または手書きの `sw.js`）
2. ユーザーが通知を許可 → `PushManager.subscribe()` で購読情報を取得し DB（`push_subscriptions`）へ保存
3. 予定作成時に `reminders`（例: 開始10分前）を登録
4. **pg_cron が毎分** Edge Function を起動 → 送信時刻が来た reminder を取得 → `web-push` ライブラリで送信 → 送信済みフラグを更新
5. Service Worker の `push` イベントで通知表示、`notificationclick` で該当日のタイムテーブルを開く

> ⚠️ **iOS の注意点**: iPhone の Safari は「ホーム画面に追加した PWA」でのみ Web Push を受信可能（iOS 16.4 以降）。アプリ内で「ホーム画面に追加」の案内を出す必要があります。確実性を求める場合、将来的に Capacitor / Expo でネイティブ化し FCM/APNs を使う選択肢を残します。

---

## 2. データベース設計

### 設計の基本方針

- 時刻は **`timestamptz`（UTC）で保存** し、10分刻みであることを CHECK 制約で保証する
  - 「スロット番号（0〜143）」で保存すると、日付またぎ・タイムゾーン・夏時間で破綻しやすいため
  - 画面側で `slot = (分 ÷ 10)` に変換して表示
- グループごとに **タイムゾーン** を持たせる（例: `Asia/Tokyo`）
- 同時編集の衝突対策として **`version` 列による楽観的ロック**

### ER図（概要）

```
profiles ─┬─< group_members >─┬─ groups
          │                    │
          │                    ├─< invitations
          │                    │
          ├─< push_subscriptions
          │                    │
          └─< event_assignees >─ events ─< reminders
```

### テーブル定義

#### profiles（ユーザー）
| 列 | 型 | 説明 |
|---|---|---|
| id | uuid PK | `auth.users.id` と同一 |
| display_name | text | 表示名 |
| avatar_url | text | アイコン |
| color | text | タイムテーブル上の個人カラー（例 `#4F46E5`） |
| created_at | timestamptz | |

#### groups（チーム／家族／イベント）
| 列 | 型 | 説明 |
|---|---|---|
| id | uuid PK | |
| name | text | グループ名 |
| timezone | text | 例 `Asia/Tokyo` |
| day_start_slot | smallint | 表示開始（例 36 = 6:00） |
| day_end_slot | smallint | 表示終了（例 144 = 24:00） |
| created_by | uuid FK → profiles | |
| created_at | timestamptz | |

#### group_members（所属）
| 列 | 型 | 説明 |
|---|---|---|
| group_id | uuid FK | 複合PK |
| user_id | uuid FK | 複合PK |
| role | enum(`owner`,`editor`,`viewer`) | 権限 |
| joined_at | timestamptz | |

#### invitations（招待）
| 列 | 型 | 説明 |
|---|---|---|
| id | uuid PK | |
| group_id | uuid FK | |
| email | text NULL | メール招待時のみ |
| token | text UNIQUE | 招待リンク用ランダム文字列 |
| role | enum | 参加時に付与する権限 |
| expires_at | timestamptz | 有効期限 |
| accepted_at | timestamptz NULL | |

#### events（10分単位の予定）
| 列 | 型 | 説明 |
|---|---|---|
| id | uuid PK | |
| group_id | uuid FK | |
| title | text | |
| memo | text | |
| category | text | 色分け用カテゴリ |
| starts_at | timestamptz | 10分刻み（CHECK: 分が10の倍数・秒0） |
| ends_at | timestamptz | `ends_at > starts_at` |
| created_by | uuid FK | |
| updated_by | uuid FK | 最終更新者（「○○さんが編集」表示用） |
| version | int | 楽観的ロック |
| created_at / updated_at | timestamptz | |

インデックス: `(group_id, starts_at)`

> 必要に応じて「担当者ごとに時間帯の重複を禁止」したい場合は、`tstzrange(starts_at, ends_at)` に対する **排他制約（EXCLUDE USING gist）** を `event_assignees` 側に設定できます。

#### event_assignees（予定の担当者）
| 列 | 型 | 説明 |
|---|---|---|
| event_id | uuid FK | 複合PK |
| user_id | uuid FK | 複合PK |

#### reminders（通知予約）
| 列 | 型 | 説明 |
|---|---|---|
| id | uuid PK | |
| event_id | uuid FK | |
| user_id | uuid FK | 通知先 |
| minutes_before | smallint | 例 10, 30 |
| fire_at | timestamptz | `starts_at - minutes_before`（予定変更時にトリガーで再計算） |
| sent_at | timestamptz NULL | 送信済み判定 |

インデックス: `(fire_at) WHERE sent_at IS NULL`

#### push_subscriptions（端末ごとの通知購読）
| 列 | 型 | 説明 |
|---|---|---|
| id | uuid PK | |
| user_id | uuid FK | |
| endpoint | text UNIQUE | |
| p256dh / auth | text | 暗号鍵 |
| user_agent | text | 端末識別 |
| created_at | timestamptz | |

### 権限（RLS）ルールの例
- `events` の SELECT: 自分が `group_members` に含まれるグループのみ
- `events` の INSERT/UPDATE/DELETE: role が `owner` または `editor`
- `group_members` の追加: `owner` のみ（招待受諾は専用 RPC 経由）

---

## 3. UI/UX デザイン方針

### 画面構成

```
┌────────────────────────────────────────────┐
│ ◀ 9/28(月) ▶   [今日]   グループ: 山田家 ▼  👤👤👤 │  ← ヘッダー（日付移動・閲覧中メンバー）
├──────┬─────────┬─────────┬─────────┤
│ 時刻 │  パパ    │  ママ    │  太郎    │  ← メンバー列（横並び）
├──────┼─────────┼─────────┼─────────┤
│ 7:00 │▓▓朝食▓▓▓│▓▓朝食▓▓▓│         │
│ 7:10 │▓▓▓▓▓▓▓▓│         │▓通学準備▓│  ← 1行 = 10分
│ 7:20 │         │▓▓送迎▓▓▓│▓▓▓▓▓▓▓▓│
│ 7:30 │─────── 現在時刻ライン ───────│
│  …   │         │         │         │
└──────┴─────────┴─────────┴─────────┘
                                   [＋]  ← 新規作成ボタン
```

### ビューの種類
- **メンバー別ビュー（メイン）**: 縦軸＝時刻（10分刻み）、横軸＝メンバー。誰がいつ何をするか一目でわかる
- **1列ビュー（スマホ向け）**: 全員の予定を1列に色分け表示、担当者はアイコンで表示
- **週ビュー**（後期）: 7日分を縮小表示

### 操作設計

| 操作 | PC | スマホ |
|---|---|---|
| 新規作成 | 空きセルを**ドラッグで範囲選択** → 入力ポップオーバー | 空きセルを**タップ** → 開始/終了をハンドルで調整 |
| 移動 | 予定ブロックをドラッグ（10分単位でスナップ） | **長押し**してからドラッグ（スクロールと区別） |
| 長さ変更 | ブロック下端のハンドルをドラッグ | 同左（ハンドルを大きめに） |
| 編集 | ダブルクリック | タップ → ボトムシート |
| 削除 | 選択して Delete キー / メニュー | ボトムシート内の削除ボタン（Undo トースト付き） |
| 複製 | Alt + ドラッグ | メニューから「複製」 |

### 見やすさの工夫
- 1スロットの高さは **最低 24px**（スマホでタップしやすい）。ピンチ/ボタンで**ズーム切替**（10分／30分／1時間表示）
- **1時間ごとに太線、30分に中線、10分に細線** でグリッドにメリハリ
- **現在時刻ライン**を表示し、画面を開いたら現在時刻付近へ自動スクロール
- 色は「メンバー色」または「カテゴリ色」で切替可能
- 他メンバーが編集中のブロックには**アバター＋点線枠**（Presence 機能）
- 同時編集で衝突したら「他の人が先に更新しました」→ 最新版を表示して再適用を提案
- 操作は **楽観的更新**（即座に画面反映 → 失敗時に巻き戻し）で体感速度を重視

---

## 4. 段階的な開発ステップ（ロードマップ）

### Phase 0: 準備（〜1週間）
- [ ] Next.js + TypeScript + Tailwind の雛形作成、ESLint / Prettier 設定
- [ ] Supabase プロジェクト作成、ローカル開発環境（Supabase CLI）
- [ ] DB マイグレーション（上記テーブル＋RLS）
- [ ] Vercel へのデプロイ設定

### Phase 1: MVP ― 「1人で10分単位の予定を管理できる」（2〜3週間）
- [ ] ログイン（Magic Link）
- [ ] 1日分のタイムテーブル表示（10分グリッド・現在時刻ライン）
- [ ] 予定の作成・編集・削除（タップ／ドラッグ範囲選択）
- [ ] 日付移動
- [ ] スマホ表示対応

**完了条件**: 自分のスマホで今日の予定を10分単位で入力・確認できる

### Phase 2: 共有 ― 「グループで同じ予定を見て編集できる」（2〜3週間）
- [ ] グループ作成、招待リンク発行・参加
- [ ] 権限（owner / editor / viewer）
- [ ] メンバー別の列表示、担当者割り当て
- [ ] Supabase Realtime による即時反映
- [ ] 楽観的ロックによる衝突検知

**完了条件**: 2台の端末で同時に開き、片方の変更がもう片方に1秒以内で反映される

### Phase 3: 通知 ― 「予定の前に知らせてくれる」（1〜2週間）
- [ ] PWA 化（manifest・Service Worker・ホーム画面追加の案内）
- [ ] 通知許可・購読登録
- [ ] リマインダー設定（5/10/30分前など）
- [ ] pg_cron + Edge Function による送信
- [ ] 予定変更時のリマインダー再計算

**完了条件**: スマホ（Android Chrome / iOS ホーム画面 PWA）で開始10分前に通知が届く

### Phase 4: 操作性向上（2週間〜）
- [ ] ドラッグで移動・長さ変更（10分スナップ）
- [ ] Undo / Redo
- [ ] テンプレート（「平日の朝ルーティン」を一括配置）
- [ ] 繰り返し予定
- [ ] Presence（閲覧中・編集中メンバーの表示）

### Phase 5: 発展機能（任意）
- [ ] 週ビュー、印刷／PDF出力（イベント当日の香盤表として）
- [ ] Google カレンダー連携
- [ ] 変更履歴（誰がいつ何を変えたか）
- [ ] オフライン編集と再同期
- [ ] ネイティブアプリ化（Capacitor / Expo）で通知の確実性向上

---

## 次のステップ候補

1. **プロジェクト雛形の作成**（Next.js + Supabase の初期構成をこのリポジトリに作成）
2. **DB マイグレーション SQL の作成**（テーブル・RLS・トリガーまで含めた実SQL）
3. **10分タイムテーブル UI コンポーネントの実装**（グリッド表示＋ドラッグ範囲選択）
4. **リアルタイム同期の実装詳細**（Realtime 購読・楽観的更新・衝突処理）
5. **Web Push 通知の実装**（Service Worker・購読登録・Edge Function 送信）
