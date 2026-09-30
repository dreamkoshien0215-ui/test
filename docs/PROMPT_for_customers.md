# 「10分スケジュール」作成プロンプト

AI（Claude など）に貼り付けるだけで、今回作ったツールと同じものを作ってもらうためのプロンプトです。
購入者・利用者は、自分の Firebase（無料）と GitHub Pages（無料）で公開できます。

---

## 使い方（利用者向け）

1. 下の「プロンプト本文」の枠の中身を **すべてコピー** します
2. Claude などの AI チャットに貼り付けて送信します
3. AI が次の4つを出力します。それぞれ同じ名前のファイルとして保存します
   - `index.html`（アプリ本体）
   - `firebase-config.js`（接続設定。最初は空のまま）
   - `firestore.rules`（データベースのルール）
   - 公開までの手順書
4. 手順書に沿って Firebase の準備と Web 公開をします（目安 20〜30分）
5. 途中で分からないことや不具合があれば、同じチャットで AI に「◯◯の画面で止まった」「◯◯と表示される」と聞けば案内してもらえます

> 💡 AI の出力は毎回少しずつ変わります。完成したら「プロンプト本文の『確認項目』をすべて自分で確認して、問題があれば直して」と頼むと仕上がりが安定します。

---

## プロンプト本文

````text
あなたは、プログラミング初心者のために Web アプリを作るエンジニアです。
次の仕様どおりの「10分単位で予定を共有できるスケジュール表」を作ってください。
インストール不要で、PC とスマホ（iPhone Safari / Android Chrome）のブラウザで動くものにします。

# 出力してほしいもの
1. index.html … アプリ本体。HTML・CSS・JavaScript をすべてこの1ファイルに入れる。外部ライブラリや CDN は使わない
2. firebase-config.js … Firebase の接続設定。最初は `window.FIREBASE_CONFIG = null;` とし、設定例をコメントで書く
3. firestore.rules … 下の「Firestore ルール」の内容
4. 公開までの手順書（初心者向け・日本語。下の「手順書に書くこと」を参照）
- コードは省略せず、ファイル全体を出力すること（「…省略…」は禁止）
- コメントは日本語で、要所だけに書く

# 画面
- 縦が時間、横がメンバーの表。1日を10分単位の144マス（0〜143番）で表す
- 左端に時刻列（1時間ごとに「09:00」の形で表示）、上端にメンバー名の見出し。どちらもスクロールしても固定（position: sticky）
- 罫線は 10分=点線、30分=薄い実線、1時間=濃い実線
- 各メンバーの列は最低幅 150px（スマホは 120px）。人数が多いときは表だけ横スクロール（ページ全体は横にはみ出さない）
- 予定はメンバーの色の角丸ブロックで、タイトル・「09:00–09:30」の時刻・リマインドありなら🔔を表示
- 今日を表示しているときは、現在時刻に赤い横線を引き、1分ごとに更新
- 開いたとき・「今日」ボタンで、現在時刻の1時間前あたりまで自動スクロール
- ズームボタンでマスの高さを 小12px／標準20px／大32px に切り替え（CSS 変数で管理、端末ごとに記憶）
- ヘッダー：アプリ名、状態バッジ、◀ 日付入力 ▶、「今日」、「🔍 ズーム」「🖨 印刷」「🔗 招待」「👥 メンバー」「🔔 通知」
- 状態バッジ：「共有中」（緑）／「接続待ち」（オレンジ）／「この端末のみ」（オレンジ）／「接続中…」「未作成」（灰）
- メンバーが0人のときは「まだメンバーがいません」と「＋ メンバーを追加」ボタンを中央に表示
- ライト／ダークの両テーマ（prefers-color-scheme）に対応。色は CSS 変数で定義
- スマホ：入力欄の文字は16px以上（iPhone で勝手に拡大されないように）、画面下のセーフエリアを考慮

# 操作
- PC（マウス）：空きマスをドラッグして範囲を選ぶと予定の入力画面が開く。選択中は「09:00–09:30」の点線枠でプレビュー
- スマホ（タッチ）：開始マスをタップ → 終了マスをタップで入力画面が開く（同じマスを2回タップで10分）。
  ドラッグだと縦スクロールとぶつかるため、タッチでは2タップ方式にする。touch-action: pan-x pan-y でスクロールはブラウザに任せ、指が8px以上動いたらタップ扱いしない
- 1回目のタップ後は「開始 09:00 を選択 → 終了のマスをタップ」とトースト表示。Esc キーで取り消し
- 予定ブロックをタップ／クリックすると編集画面
- 入力画面（<dialog>）：タイトル（60文字まで）、担当メンバー、開始、終了（10分刻みのセレクト）、リマインド（なし／5／10／15／30／60分前、初期値10分前）、保存・キャンセル・削除（編集時のみ）
- 保存前のチェック（エラーは入力画面の中に赤字で表示）：
  - 終了が開始より後であること
  - 同じメンバー・同じ日で時間が重なる予定がないこと（重なる予定のタイトルと時刻を表示）
  - 編集中の予定が他の人に削除されていたら知らせる
- 削除の確認は alert/confirm を使わず、ページ内の確認ダイアログ（<dialog>）で行う（埋め込み表示だと confirm が動かない環境があるため）
- 「👥 メンバー」画面：色（input type=color）と名前（20文字まで）を変更、✕で削除（「予定◯件も削除されます」と確認）、「＋ メンバーを追加」
- メンバー画面の下に「この端末で通知を受け取る予定」セレクト（全員の予定／◯◯の予定だけ）。端末ごとに localStorage へ保存

# 動作モード
- firebase-config.js が null のとき：「この端末のみ」モード。データは localStorage に保存し、初回は「（例）」付きのサンプルメンバー3人・予定9件を表示。別タブの変更は storage イベントで反映。JSON の書き出し（コピー／ファイル保存）と読み込み（確認してから置き換え）ボタンを表示
- firebase-config.js に設定があるとき：「リンク共有」モード（下記）。書き出し・読み込みボタンは隠す

# リンク共有（Firebase Firestore）
- ログインは使わない。「予定表ID」を知っている人だけが使える方式にする
- URL に `?b=予定表ID` がないときは「＋ 新しい予定表を作る」画面を出す。押したら crypto.getRandomValues で15バイト（120ビット）を作り、URL安全な Base64（20文字）にして `?b=` に付けて開き直す
- 予定表ID は `^[A-Za-z0-9_-]{16,64}$` の形だけ受け付ける
- 「🔗 招待」：navigator.share が使えれば共有シートを開き、使えなければリンクとコピーボタンのダイアログを表示。「リンクを知っている人は誰でも編集できるので仲間内だけで共有してください」と注意書き
- データの場所：
  - boards/{予定表ID}/members/{メンバーID} … name(文字列), color(#RRGGBB), order(数値)
  - boards/{予定表ID}/events/{予定ID} … date(YYYY-MM-DD), memberId, start(整数0-143), end(整数1-144), title, remind(整数), updatedAt(数値)
  - boards/{予定表ID}/meta/rev … rev(整数・更新番号)
- 【重要】Firebase の公式 JavaScript SDK は使わず、Firestore の REST API を fetch で直接呼ぶこと。
  理由：SDK のストリーミング通信は回線によって途中で切られ、保存がサーバーに届かないのに画面上は保存できたように見える事故が起きるため。
  - エンドポイント：https://firestore.googleapis.com/v1/projects/{projectId}/databases/(default)/documents/boards/{予定表ID}/...?key={apiKey}
  - 保存は PATCH（updateMask なしで文書全体を置き換え）、削除は DELETE、メンバー一覧は GET（pageToken で全件）
  - 値の変換：文字列→stringValue、整数→integerValue（文字列で送る）、小数→doubleValue。読み込み時は逆変換
  - 予定は全件読まず、runQuery（structuredQuery の date IN [表示中の日, 今日, 明日]）で必要な日付だけ読む。表示日を変えたら読み直す
- 同期のしかた（定期確認）：
  - 5秒ごとに meta/rev だけを読み（1件の読み取り）、前回と違うときだけメンバーと予定を読み直す。念のため5分ごとに全体を読み直す
  - 画面が非表示（document.hidden）の間は確認しない。表示に戻ったとき・オンラインに戻ったときはすぐ確認
  - 保存・削除が成功したら meta/rev を Date.now() に更新し、自分の画面をすぐ読み直してから入力画面を閉じる
  - 読み込みは同時に走らないよう1つずつ順番に行う
  - 前回と同じ内容なら再描画しない
  - meta/rev の読み取りが権限エラーのとき（ルール未更新）は、毎回全体を読み直して動作を続ける
- エラー時：
  - 通信できない／サーバーエラー → 1回だけ少し待って再試行し、だめなら「保存できませんでした。通信状態を確認して…」とトースト、入力画面は閉じない
  - 403（ルールに拒否）→「保存できませんでした。入力内容を確認して…」
  - 429 → 「操作が集中しています。少し待って…」
  - 定期確認が失敗したらバッジを「接続待ち」にし、つながったら「共有中」に戻して「つながりました」と表示
  - 最初の読み込みで失敗したら表の代わりに「共有サーバーにつながりません。つながると自動で表示されます」
  - 【重要】共有の予定表を開いているのにつながらない場合、勝手に「この端末のみ」に切り替えない（共有されていないことに気づけなくなるため）
- 他人が書いたデータは信用しない：描画前に形を整える（文字数の上限、色の形式、start/end の範囲、remind の許可値）。画面に出す文字はすべて HTML エスケープする

# Firestore ルール（この内容をそのまま firestore.rules に）
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /boards/{boardId}/members/{memberId} {
      allow read, delete: if true;
      allow create, update: if request.resource.data.keys().hasOnly(['name', 'color', 'order'])
        && request.resource.data.name is string && request.resource.data.name.size() <= 20
        && request.resource.data.color is string && request.resource.data.color.matches('^#[0-9a-fA-F]{6}$')
        && request.resource.data.order is number;
    }
    match /boards/{boardId}/meta/{docId} {
      allow read: if true;
      allow write: if docId == 'rev'
        && request.resource.data.keys().hasOnly(['rev'])
        && request.resource.data.rev is int;
    }
    match /boards/{boardId}/events/{eventId} {
      allow read, delete: if true;
      allow create, update: if request.resource.data.keys().hasOnly(['date', 'memberId', 'start', 'end', 'title', 'remind', 'updatedAt'])
        && request.resource.data.date is string && request.resource.data.date.matches('^[0-9]{4}-[0-9]{2}-[0-9]{2}$')
        && request.resource.data.memberId is string && request.resource.data.memberId.size() <= 64
        && request.resource.data.start is int && request.resource.data.start >= 0 && request.resource.data.start < 144
        && request.resource.data.end is int && request.resource.data.end > request.resource.data.start
        && request.resource.data.end <= 144
        && request.resource.data.title is string && request.resource.data.title.size() <= 60
        && request.resource.data.remind in [0, 5, 10, 15, 30, 60]
        && request.resource.data.updatedAt is number;
    }
  }
}
（予定表の一覧を取るルールは作らないので、IDを知らない人は他人の予定表を探せない）

# 通知（開始前リマインド）
- 「🔔 通知を許可」ボタンを押したときだけ Notification.requestPermission() を呼ぶ（ページを開いた瞬間には聞かない）
- ボタン表示：通知ON／通知ブロック中／通知を許可／（非対応ブラウザは）画面内で通知
- 15秒ごとと画面表示時に、「開始時刻 − リマインド分 ≦ 現在 < 開始時刻」の予定を通知。メンバー画面の設定で「◯◯の予定だけ」なら、その人の予定だけ
- 通知済みの予定は localStorage に記録して二重通知を防ぐ（2日より古い記録は削除）。Notification の tag も付ける
- 通知が使えない環境（iPhone の通常の Safari など）でも、画面内のトーストで必ず知らせる。new Notification が例外を出す環境（Android Chrome）は try/catch で無視

# 印刷・画像化
- 「🖨 印刷」を押すと、時間帯（開始・終了の時）と用紙（A4 縦／横）を選ぶダイアログを開き、プレビュー画像を表示
  - 初期値：予定のある範囲を含む時間帯（最低 8:00〜20:00）、メンバー5人以上なら横
- canvas に A4・300dpi 相当（縦 2480×3508px、横 3508×2480px）で描画して PNG にする
  - 見出し「2026年9月30日（水）のスケジュール」、時間帯と「1マス＝10分」、出力日時
  - メンバー名の見出し（色の丸付き）、時刻、罫線（1時間=濃い線、30分=薄い線、10分=点線）、予定ブロック（タイトルと時刻）
  - 文字は枠からはみ出さないよう、はみ出す分は「…」で省略し、各列・各予定の範囲で clip する
  - 低い予定は文字を小さくし、それでも12px未満になるなら色の帯だけにする
- 【重要】1ページに載せる人数の上限は 縦6人／横10人。超えたらページを分け、人数は均等に割り振る（例：20人・縦 → 5人×4ページ）。見出しに「（1/4）」を付け、「◯人ずつ◯ページに分けて出力します」と表示
- 「印刷」ボタン：画像を印刷専用の要素に並べ、@page { size: A4 縦/横; margin: 0 } を設定して window.print()。1枚＝1ページ（page-break）で余白ページが出ないこと
- 「画像を保存」ボタン：PNG をダウンロード（複数ページは連番）。スマホ向けに「画像を長押しで保存し、写真アプリから印刷」と案内
- iframe の中で開かれている場合（window.top !== window.self）は、印刷ボタンとファイル保存ボタンを隠し、長押し保存の案内だけにする

# 確認項目（作り終えたら、すべて満たしているか自分で見直して直すこと）
- ドラッグ（PC）と2回タップ（スマホ）の両方で予定が作れる
- 重なり・終了が開始以前のときは保存されず、理由が表示される
- 編集・削除（確認ダイアログでキャンセルすると残る）ができる
- メンバー削除でその人の予定も消え、件数の確認が出る
- 翌日に移動すると今日の予定は出ず、戻ると出る
- スマホ幅（375px）でページ全体が横にはみ出さない
- リンク共有：2つのブラウザで同じリンクを開き、片方の追加・変更・削除がもう片方に10秒以内に出る
- 通信を切ると「接続待ち」になり、保存しようとすると失敗が表示される。つながると「共有中」に戻る
- 別の予定表IDには他の予定表の中身が出ない
- 印刷：3人・8人・20人、縦・横で、PDFのページ数がプレビュー画像の枚数と一致し、名前や予定が枠からはみ出さない
- alert()/confirm()/prompt() を使っていない。コンソールにエラーが出ない

# 手順書に書くこと（プログラミングを知らない人向け。ボタン名を「」で書き、1手順1操作で）
1. Firebase：console.firebase.google.com → プロジェクトを作成（Gemini・アナリティクスはオフ）
2. 「構築」→「Firestore Database」→ データベースを作成（Standard、ID は (default)、ロケーション asia-northeast1 (Tokyo)、本番環境モード）
3. 「ルール」タブで中身を全部消して firestore.rules を貼り付け →「公開」
4. ⚙「プロジェクトの設定」→「マイアプリ」→ ウェブ（</>）→ アプリを登録 → firebaseConfig の { } の中身を firebase-config.js に貼る（秘密情報ではないことも説明）
5. Authentication（ログイン）の設定は不要と明記する
6. 公開：GitHub にリポジトリを作り3ファイルをアップロード →（公開リポジトリにして）Settings → Pages → Deploy from a branch → main / (root) → Save → 数分後の URL を開く
   - リポジトリを非公開にしたい人向けに Netlify Drop（app.netlify.com/drop にフォルダをドラッグ）も書く
7. 使い方：公開URLを開く →「新しい予定表を作る」→「👥 メンバー」で自分を追加 →「🔗 招待」で仲間にリンクを送る
   - 予定表のリンク（?b=… 付き）をブックマーク／ホーム画面に追加すること。トップページを開くと新しい予定表になること
8. 困ったとき：「接続待ち」なら通信と firebase-config.js、「保存できませんでした」ならルールの貼り付けと「公開」を確認
9. 無料枠の目安（Firestore 無料枠：1日 読み取り5万回・書き込み2万回。数人〜十数人なら収まる）
````

---
