# PITCH LAB 設計書 — Road to 145km/h

投手の **球速145km/h達成** と **肩・肘・腰の障害予防** に特化した個人用トレーニング＆コンディショニングアプリ。
ジム・グラウンドで片手・短時間で入力できることを最優先に設計した、オフライン動作のPWA。

---

## 1. 画面構造・UI/UX設計

### 1-1. 設計原則（アスリート向けクイック入力）

| 原則 | 実装 |
|---|---|
| **3タップ以内で記録** | ドリルカード右の「＋」→ 前回値がプリセット済みのシート →「記録する」 |
| **前回値の自動引継ぎ** | 重量・回数・セット・RPEは同種目の直近ログを初期値に（なければドリル既定値） |
| **大きなタップ領域** | ボタン最小48px、ステッパー52px、RPE/違和感はセグメントボタン（数字のキーボード入力不要） |
| **自動保存** | コンディション画面は変更即保存・判定即更新（保存ボタンなし） |
| **判定を最上部に** | ホーム最上部に Readiness（GO / CAUTION / REST）と理由を常時表示 |
| **日付ナビ** | ヘッダの ‹ 今日 › で過去日の後追い入力が可能 |
| **ダーク基調** | 屋外・ジムでの視認性とバッテリー配慮。OSがライトならライトテーマに自動切替 |

### 1-2. 画面一覧（ボトムタブ5 + サブ2）

```
┌──────────── ヘッダ: ⚾ タイトル  [‹ 今日 ›]  ⚙ ────────────┐
│                                                          │
│  🏠 ホーム   … Readiness判定 / 球速進捗 / 本日のトレ / PFC  │
│              └ 「📸 今日のカードを作成」→ SNSカード        │
│  🏋️ トレ     … 警告バナー / 本日の記録 / カテゴリチップ      │
│              / ドリルカード一覧（＋で即記録、タップで詳細）   │
│              └ 詳細シート: YouTubeサムネ or 検索リンク        │
│                 意識ポイント / メモ / 記録フォーム / 編集       │
│  🩺 ケア     … 判定カード / 部位別違和感(1-5) / 疲労 / 睡眠    │
│              / ROMセルフチェック(L/R) / 14日ヒートマップ       │
│  🍙 栄養     … 目的・活動量 / PFC進捗バー / ワンタップ食品     │
│              / 本日の食事（朝昼夕間食）                       │
│  📈 数値     … 球速入力 / 球速グラフ(目標線145) / マイルストーン │
│              / 筋力指標グラフ / ROM推移グラフ                  │
│  (⚙ 設定)    … プロフィール / バックアップ / 初期化            │
│  (📸 SNS)    … プレビュー / テーマ / サイズ / 形式 / 保存・シェア │
└──────────── ボトムタブ: ホーム トレ ケア 栄養 数値 ───────────┘
```

### 1-3. 警告ロジック（自動レスト推奨）

`js/logic.js` の `assessReadiness()` が以下で判定し、**ホーム・ケア・トレ画面**に表示。REST時はトレ画面で「出力・爆発力」カテゴリのドリルに赤破線を付けて注意喚起する。

| 条件 | 判定 |
|---|---|
| 肩・肘の違和感 ≥ 4 | **REST**（投球・高強度中止、専門家へ相談） |
| その他部位の違和感 ≥ 4 / 全身疲労 5 | **REST** |
| 肩・肘の違和感 = 3 / その他部位 = 3 / 疲労 4 | CAUTION |
| 睡眠 < 6時間 | CAUTION |
| 投球側の肩内旋が非投球側より20°以上低下（GIRD傾向） | CAUTION |
| 肩の総回旋可動域（外旋+内旋）が非投球側より5°超少ない | CAUTION |
| 急性/慢性負荷比 (ACWR) > 1.5（直近7日 ÷ 28日の週平均。負荷=RPE×セット数。履歴3週間以上で有効） | CAUTION |

Readinessスコア(0–100)は違和感・疲労・睡眠不足・ACWRから減点し、CAUTIONは最大69、RESTは最大39に制限。

> ⚠ 判定はセルフケアの目安であり医療判断ではありません。痛みが続く場合は医療機関を受診してください。

### 1-4. 栄養計算

- 基礎代謝: **Mifflin-St Jeor式** `10×体重 + 6.25×身長 − 5×年齢 + (男性 +5 / 女性 −161)`
- 総消費: 基礎代謝 × 活動係数（軽め1.5 / 通常1.75 / 高負荷1.95）
- 目的補正: 体重維持 ±0 / 回復重視 +150kcal / 出力向上 +350kcal
- P: 体重×1.8 / 2.0 / 2.2 g、F: 総カロリーの25%、C: 残り

---

## 2. データモデル（スキーマ）

全データは1つのJSONドキュメントとして `localStorage['pitchlab:v1']` に保存（`schemaVersion` でマイグレーション管理）。テーブルは配列、行は `id` / `createdAt` を持つ。

```ts
type ISODate = string; // 'YYYY-MM-DD'

interface AppState {
  schemaVersion: 1;
  profile: Profile;
  categories: Category[];
  drills: Drill[];
  workoutLogs: WorkoutLog[];
  conditionLogs: ConditionLog[];   // 1日1件 (date で upsert)
  metricDefs: MetricDef[];
  metricLogs: MetricLog[];         // 球速も metricKey='velocity' として格納
  milestones: Milestone[];
  foods: Food[];
  mealLogs: MealLog[];
  refChannels: RefChannel[];       // 参考YouTubeチャンネル（初期値: @illstyle）
  shareSettings: ShareSettings;
}

interface RefChannel { id: string; handle: string; name: string } // handle = '@' を除いたチャンネルID

interface Profile {
  name: string; throwingArm: 'R' | 'L';
  heightCm: number; weightKg: number; age: number; sex: 'M' | 'F';
  activity: 'low' | 'mid' | 'high';
  nutritionGoal: 'maintain' | 'recover' | 'power';
}

interface Category { id: string; name: string; nameEn: string; color: string; order: number }

interface Drill {
  id: string; categoryId: string; name: string;
  cue: string;            // 意識するポイント 例「胸郭のしなり」「右股関節のタメ」
  notes: string;
  youtubeUrl: string;     // 任意。watch / youtu.be / shorts / embed を解析しサムネ表示
  youtubeQuery: string;   // URL未登録時はYouTube検索リンクを生成
  defaultWeightKg: number; defaultReps: number; defaultSets: number;
  favorite: boolean; archived: boolean; seeded?: boolean;
}

interface WorkoutLog {
  id: string; date: ISODate; drillId: string;
  weightKg: number; reps: number; sets: number;
  rpe: 6 | 7 | 8 | 9 | 10; note: string; createdAt: string;
}

type Level = 1 | 2 | 3 | 4 | 5;
interface ConditionLog {
  id: string; date: ISODate;
  soreness: { shoulder: Level; elbow: Level; lowBack: Level; hip: Level; forearm: Level; knee: Level };
  fatigue: Level; sleepHours: number | null;
  rom: Partial<Record<'thoracicRot' | 'hipIR' | 'hipER' | 'shoulderER' | 'shoulderIR',
                      { L: number | null; R: number | null }>>; // 単位: 度
  note: string;
}

interface MetricDef { key: string; name: string; unit: string; aggregate: 'max' | 'latest'; builtIn?: boolean }
interface MetricLog {
  id: string; date: ISODate; metricKey: string; value: number;
  context?: 'bullpen' | 'game' | 'pulldown';  // 球速のみ
}
interface Milestone {
  id: string; title: string; metricKey: string;
  startValue: number | null;  // null = 最初の記録値を開始値とする
  targetValue: number; startDate: ISODate; targetDate: ISODate;
}

interface Food { id: string; name: string; kcal: number; p: number; f: number; c: number; favorite: boolean; useCount: number }
interface MealLog {
  id: string; date: ISODate; meal: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  foodId: string | null; name: string; kcal: number; p: number; f: number; c: number; qty: number; // 値はスナップショット
}

interface ShareSettings {
  theme: 'sporty' | 'neon' | 'minimal'; size: 'feed' | 'story'; format: 'png' | 'jpeg';
  handle: string; sections: { workout: boolean; velocity: boolean; condition: boolean };
}
```

**設計上のポイント**
- 球速は汎用の `metricLogs` に統合 → 筋力・ジャンプ等と同じグラフ・マイルストーン機構を再利用。
- `mealLogs` は食品の栄養値を**スナップショット**保存 → 食品マスタを編集しても過去ログが変わらない。
- `aggregate` で「現在値」の定義を切替（球速・1RMは自己ベスト、体重は最新値）。
- RDB化する場合も上記がそのままテーブル定義になる（`drills.categoryId → categories.id` 等の外部キー、`conditionLogs(date)` にユニーク制約、`workoutLogs(date)`・`metricLogs(metricKey, date)` にインデックス）。

---

## 3. ステップ別実装ガイド

### 構成

```
index.html              アプリシェル（ヘッダ・ボトムタブ）
css/style.css           デザイントークン(:root変数) + コンポーネント
js/app.js               ハッシュルーター、日付ナビ、SW登録
js/db.js                永続化レイヤー（load/persist/CRUD/バックアップ/マイグレーション）
js/seed.js              初期マスタ（5カテゴリ・11ドリル・食品・指標）
js/logic.js             純粋ロジック（判定・ACWR・栄養計算・進捗・YouTube解析）※DOM非依存
js/derive.js            store + logic → 画面用ビューモデル
js/charts.js            Canvas折れ線グラフ（依存なし・HiDPI対応）
js/share-canvas.js      SNSカード描画・PNG/JPEG書き出し・共有
js/views/*.js           各画面（render(root, ctx)）
sw.js / manifest        オフライン対応PWA
tests/logic.test.mjs    node:test によるロジックのユニットテスト
```

### Step 1. フロントエンド（UI・グラフ描画）

1. **ルーティング**: `location.hash`（`#/train` 等）→ `ROUTES[name].view.render(root, ctx)`。描画ごとに新しいコンテナ要素を作り、イベントリスナーの多重登録を防ぐ。
2. **共通部品**（`js/ui.js`）: `stepper()`（±ボタン付き数値入力、イベント委譲で1か所処理）、`seg()`（ラジオベースのセグメント）、`openSheet()`（ボトムシート）、`toast()`、`esc()`（XSS対策のHTMLエスケープ — ユーザー入力は必ず通す）。
3. **状態変更 → 再描画**: 各ビューは `store.insert/update/remove` 後に `ctx.refresh()` を呼ぶだけ。スクロール位置は同一ルートなら保持。
4. **グラフ**（`js/charts.js`）: `devicePixelRatio` 倍のCanvasに、グリッド→目標点線（145km/h）→グラデーション面→折れ線→点→最新値ラベルの順で描画。色はCSS変数から取得するためテーマに追従。
   - Chart.js 等に置き換える場合も `lineChart(canvas, points, {target, unit})` のシグネチャを維持すればビュー側は変更不要。

### Step 2. ローカル保存 / バックエンド処理

1. **保存**: `db.js` が全状態を1つのJSONで `localStorage` に保存（数年分の記録でも数百KB程度）。
2. **マイグレーション**: 起動時 `migrate()` が欠損キーを補完し `schemaVersion` を更新。スキーマ変更時はここに変換処理を追加。
3. **バックアップ**: 設定画面からJSONエクスポート／インポート（機種変更・ブラウザのデータ消去対策。定期的なエクスポート推奨）。
4. **オフライン**: `sw.js` がネットワーク優先＋キャッシュフォールバック。ホーム画面に追加すればネイティブアプリ同様に起動。
5. **拡張（任意）**:
   - 容量・検索性が必要になったら `load/persist/insert/update/remove` を IndexedDB（例: Dexie.js）実装に差し替え。ビューは `db.js` のAPIにしか依存しない。
   - 複数端末同期が必要なら Supabase / Firebase に同じテーブル構成で保存し、`updatedAt` による last-write-wins で同期。

### Step 3. SNS画像生成・保存（Canvas）

`js/share-canvas.js` は html2canvas を使わず **Canvas 2D API で直接描画**（フォント・余白が端末差なく安定し、オフラインでも動作）。

1. **キャンバス確保**: `SIZES.feed`=1080×1080 / `SIZES.story`=1080×1920 を `canvas.width/height` に設定（実寸で描画、表示はCSSで縮小）。
2. **背景**: テーマごとの線形グラデーション＋装飾（スポーティー=斜めストライプ、ネオン=放射グロー、ミニマル=枠線のみ）。
3. **レイアウト**: ヘッダ（ROAD TO 145・日付・見出し）→ パネル群。フィードは「球速｜コンディション」を横並び＋下段にメニュー、ストーリーズは縦積み。残りの高さをメニューパネルに割当て、溢れた種目は「ほか N 種目」。長い種目名は `measureText` で「…」省略。
4. **描画前に** `await document.fonts.ready` で日本語フォントの読み込みを待つ。
5. **書き出し**: `canvas.toBlob(cb, 'image/png' | 'image/jpeg', 0.92)` → `File` 化。
6. **共有**: `navigator.canShare({files})` が true（iOS Safari / Android Chrome）なら `navigator.share()` でInstagram等の共有シートへ。非対応環境は `<a download>` で保存にフォールバック。

---

## 4. 初期マスタデータ

| カテゴリ | ドリル | 意識ポイント | YouTube検索キーワード |
|---|---|---|---|
| 胸郭・肩甲骨 | キャット＆カウ（胸郭拡張） | 胸椎を丸めて反らす | 胸郭 可動域 キャットカウ 野球 |
| 〃 | Tスパイクロテーション（胸郭捻転） | 胸郭のしなり | 胸骨 ロテーション 投球フォーム |
| 〃 | Y-T-W-L エクササイズ | 肩甲骨を寄せて下げる | YTWL インナーマッスル 肩 補強 |
| 股関節・骨盤 | 90/90 ヒップモビリティ | 踏み込み足の受け | 90/90 股関節 柔軟 野球 |
| 〃 | ヒップヒンジ ＆ 前傾キープ | 右股関節のタメ | ヒップヒンジ 野球 ピッチング |
| 回転軸・体幹 | メディシンボール・サイドスロー（1〜3kg） | 下半身→体幹→胸の順 | メディシンボール サイドスロー 球速アップ |
| 〃 | ハーフニーリング・ケーブルチョップ | 軸をブラさず斜めに絞る | ケーブルチョップ 体幹 野球 |
| 出力・爆発力 | トラップバー・デッドリフト / ジャンプ | 床を強く押す | トラップバー デッドリフト 野球 |
| 〃 | プライオボール（フェーズド・スロー） | 肘の通り道 | プライオボール ピッチング ドリル |
| リカバリー・ケア | バンデット・ショルダー・サーキット | 減速筋で肘を守る | チューブ エクササイズ ピッチング ショルダーケア |
| 〃 | 前腕・腕橈骨筋リリース | 前腕の張りを抜く | 前腕 ほぐし 肘痛 予防 野球 |

YouTube URLは空で登録し、ドリル詳細に**検索リンク**を表示。
参考チャンネル（初期値 **@illstyle**、設定画面で追加・削除可）ごとに「▶ @illstyle で探す」ボタンを出し、
`https://www.youtube.com/@illstyle/search?query=<検索キーワード>` でチャンネル内の動画だけを検索する。気に入った動画が見つかったら「編集」でURLを貼るとサムネイル表示に切り替わる。
