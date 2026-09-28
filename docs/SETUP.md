# 一般公開の手順（Firebase + Webホスティング）

誰でもリンクを開くだけで使える（ログイン不要）状態にするための手順です。
所要時間の目安は 15〜20分。料金は Firebase の無料プラン（Spark）の範囲で使えます。

> 仕組み: 「新しい予定表を作る」を押すと、推測できないランダムなIDが付いたリンク（`…/index.html?b=xxxx`）ができます。
> このリンクを知っている人だけが、その予定表を見て編集できます。仲間内だけで共有してください。

---

## 1. Firebase の準備

1. https://console.firebase.google.com を開き、Google アカウントでログイン
2. **「プロジェクトを作成」**（名前は例: `tenmin-schedule`）
   - Google アナリティクスはオフで構いません
3. 左メニュー **「構築」→「Authentication」→「始める」**
   - 「ログイン方法」タブ → **「匿名」** を選び **有効にする** → 保存
4. 左メニュー **「構築」→「Firestore Database」→「データベースの作成」**
   - ロケーション: **asia-northeast1（東京）**
   - **「本番環境モード」** を選んで作成
5. Firestore の **「ルール」タブ** を開き、中身をすべて消して、このリポジトリの [`firestore.rules`](../firestore.rules) の内容を貼り付け → **「公開」**
6. 左上の ⚙ **「プロジェクトの設定」** → 下の「マイアプリ」→ **ウェブ（`</>`）** アイコン
   - アプリのニックネーム（例: `web`）を入れて登録（Firebase Hosting のチェックは不要）
   - 表示された `const firebaseConfig = { ... }` の **中身をコピー**
7. コピーした値を Claude に貼ってもらえれば `firebase-config.js` に設定します
   （自分で書く場合は `firebase-config.js` の `window.FIREBASE_CONFIG = null;` を置き換え）

> `apiKey` などの値は Web アプリ用の公開識別子で、秘密情報ではありません。
> 読み書きできる範囲は手順5のルールで制限しています。

---

## 2. Webに公開する（どちらか一方）

### A. GitHub Pages（おすすめ・無料）

GitHub Pages は **公開リポジトリ** なら無料です（このリポジトリは現在「非公開」）。

1. GitHub でリポジトリを開く → **Settings → General** の一番下「Danger Zone」→ **Change visibility → Public**
   - ソースコードが誰でも見られるようになります（予定のデータは Firebase 側なので見えません）
2. **Settings → Pages**
   - Source: **Deploy from a branch**
   - Branch: **main**（または `claude/browser-schedule-sharing-tool-7dhewf`）／ **/(root)** → Save
3. 1〜2分後、`https://dreamkoshien0215-ui.github.io/test/` で開けます

### B. Netlify Drop（リポジトリを非公開のままにしたい場合）

1. https://app.netlify.com/drop を開く（無料アカウントを作成）
2. `index.html` と `firebase-config.js` を入れたフォルダをドラッグ＆ドロップ
3. 表示された `https://xxxx.netlify.app` が公開URLです
   - 更新するときは同じ画面から再度ドロップ

---

## 3. 最後の設定

1. Firebase の **Authentication →「設定」→「承認済みドメイン」** に公開URLのドメインを追加
   - GitHub Pages: `dreamkoshien0215-ui.github.io`
   - Netlify: `xxxx.netlify.app`
2. 公開URLを開く → **「＋ 新しい予定表を作る」** → 「👥 メンバー」で自分を追加
3. **「🔗 招待」** でリンクを仲間に送る（スマホでは LINE などの共有画面が開きます）

---

## 困ったとき

| 症状 | 確認すること |
|---|---|
| 「この端末だけで動作しています」と出る | `firebase-config.js` の値、匿名ログインが有効か、承認済みドメイン |
| 「保存できませんでした」と出る | Firestore のルールが `firestore.rules` と同じか |
| 招待リンクを開くと「新しい予定表を作る」画面になる | リンクの `?b=…` が途中で切れていないか |

## 無料プランの目安

Firestore 無料枠は 1日あたり 読み取り 5万回 / 書き込み 2万回。仲間内（数人〜十数人）の利用なら十分に収まります。
