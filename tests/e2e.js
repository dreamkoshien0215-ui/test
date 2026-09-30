// index.html の動作確認（Playwright + Chromium）
// 実行: node tests/e2e.js   （playwright がローカルかグローバルに入っていること）
const path = require('path');
const fs = require('fs');
let playwright;
try { playwright = require('playwright'); } catch {
  playwright = require(path.join(require('child_process').execSync('npm root -g').toString().trim(), 'playwright'));
}
const { chromium } = playwright;
const URL = 'file://' + path.resolve(__dirname, '..', 'index.html');

let passed = 0, failed = 0;
function check(name, ok, detail = '') {
  if (ok) { passed++; console.log(`  ✔ ${name}`); }
  else { failed++; console.log(`  ✘ ${name} ${detail}`); }
}

// claude.ai の共有データ(db)の代わり。同じブラウザ内の複数ページで共有される
const MOCK_DB = () => {
  const KEY = '__mockdb';
  const read = () => JSON.parse(localStorage.getItem(KEY) || '{}');
  const listeners = [];
  const emit = () => listeners.forEach((l) => l());
  const bc = new BroadcastChannel('mockdb');
  bc.onmessage = emit;
  const write = (fn) => { const d = read(); fn(d); localStorage.setItem(KEY, JSON.stringify(d)); emit(); bc.postMessage(1); };
  const deny = () => { if (localStorage.getItem('__readonly')) throw { code: 'invalid_argument', message: 'denied' }; };
  const collection = (name) => ({
    doc: (id) => ({
      set: async (data) => { deny(); write((d) => { (d[name] = d[name] || {})[id] = data; }); },
      delete: async () => { deny(); write((d) => { if (d[name]) delete d[name][id]; }); },
    }),
    onSnapshot: (next) => {
      const fire = () => {
        const docs = Object.entries(read()[name] || {}).map(([id, v]) => ({ id, exists: true, data: () => v, metadata: {} }));
        next({ docs, size: docs.length, empty: !docs.length, metadata: {} });
      };
      listeners.push(fire);
      setTimeout(fire, 0);
      return () => {};
    },
  });
  window.claude = { use: async (n) => (n === 'db' ? { collection } : null) };
};

// firebase-config.js の設定を無視させる（この端末モード・claude.ai モードの試験用）
const NO_FIREBASE = () => {
  Object.defineProperty(window, 'FIREBASE_CONFIG', { get: () => null, set() {}, configurable: false });
};

async function slotBox(page, col) {
  const s = (await page.$$('.slots'))[col];
  const r = await s.boundingBox();
  return { r, h: r.height / 144 };
}
async function scrollTo(page, slot) {
  await page.evaluate((y) => { document.querySelector('#scroller').scrollTop = y; }, slot * 20 - 60);
}
const evTexts = (page) => page.$$eval('.ev', (es) => es.map((e) => e.textContent));
const toastText = (page) => page.$eval('#toast', (t) => t.textContent);

(async () => {
  const browser = await chromium.launch();

  // ---------- この端末だけモード ----------
  console.log('この端末だけモード');
  {
    const ctx = await browser.newContext({ viewport: { width: 1100, height: 800 } });
    await ctx.addInitScript(NO_FIREBASE);
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(URL);
    await page.waitForSelector('.ev');

    check('サンプルが表示される', (await evTexts(page)).length === 9);
    check('状態表示が「この端末のみ」', (await page.textContent('#status')) === 'この端末のみ');

    // ドラッグで作成
    await scrollTo(page, 30);
    let { r, h } = await slotBox(page, 0);
    await page.mouse.move(r.x + 20, r.y + h * 36 + 2);
    await page.mouse.down();
    await page.mouse.move(r.x + 20, r.y + h * 38 + 2, { steps: 4 });
    await page.mouse.up();
    check('ドラッグで予定画面が開き、時刻が入る',
      (await page.$eval('#editor', (d) => d.open)) && (await page.inputValue('#fStart')) === '36' && (await page.inputValue('#fEnd')) === '39');
    await page.fill('#fTitle', 'ドラッグ予定');
    await page.fill('#fPlace', '第1会議室');
    await page.fill('#fPerson', '田中');
    await page.click('#editorForm button[type=submit]');
    check('保存した予定が表示される', (await evTexts(page)).some((t) => t.includes('ドラッグ予定06:00–06:30')));
    check('場所と担当者が予定に表示される', (await evTexts(page)).some((t) => t.includes('📍第1会議室') && t.includes('👤田中')));

    // タップ2回で作成（2列目）
    ({ r, h } = await slotBox(page, 1));
    await page.mouse.click(r.x + 20, r.y + h * 40 + 2);
    await page.mouse.click(r.x + 20, r.y + h * 40 + 2);
    check('同じマスを2回タップで10分予定', (await page.inputValue('#fStart')) === '40' && (await page.inputValue('#fEnd')) === '41');
    await page.fill('#fTitle', 'タップ予定');
    await page.click('#editorForm button[type=submit]');

    // 重なりチェック
    ({ r, h } = await slotBox(page, 0));
    await page.mouse.click(r.x + 20, r.y + h * 33 + 2);
    await page.mouse.click(r.x + 20, r.y + h * 33 + 2);
    await page.selectOption('#fEnd', '37');
    await page.click('#editorForm button[type=submit]');
    check('重なると保存されずエラー表示', (await page.$eval('#fError', (e) => !e.hidden && e.textContent.includes('重なっています'))));
    await page.selectOption('#fEnd', '35');
    await page.click('#editorForm button[type=submit]');
    check('時間を直すと保存できる', !(await page.$eval('#editor', (d) => d.open)));

    // 終了 <= 開始
    await page.click('.ev >> text=ドラッグ予定');
    await page.selectOption('#fEnd', '30');
    await page.click('#editorForm button[type=submit]');
    check('終了が開始より前だとエラー', await page.$eval('#fError', (e) => !e.hidden));

    // 編集
    await page.selectOption('#fEnd', '39');
    await page.fill('#fTitle', 'ドラッグ予定（変更）');
    await page.click('#editorForm button[type=submit]');
    check('編集が反映される', (await evTexts(page)).some((t) => t.includes('ドラッグ予定（変更）')));
    await page.click('.ev >> text=ドラッグ予定（変更）');
    check('編集画面に場所と担当者が入っている', (await page.inputValue('#fPlace')) === '第1会議室' && (await page.inputValue('#fPerson')) === '田中');
    await page.fill('#fPerson', 'A、B、C、D、E、F、G、H、I、J、K');
    await page.click('#editorForm button[type=submit]');
    check('担当者が11人だと保存されずエラー', await page.$eval('#fError', (e) => !e.hidden && e.textContent.includes('10人まで')));
    await page.fill('#fPerson', 'A, B　C、D、E、F、G、H、I、J');
    await page.click('#editorForm button[type=submit]');
    check('担当者10人は保存でき、区切りが「、」にそろう', (await evTexts(page)).some((t) => t.includes('👤A、B、C、D、E、F、G、H、I、J')));

    // 削除（確認でキャンセル→削除）
    await page.click('.ev >> text=タップ予定');
    await page.click('#fDelete');
    await page.click('#askNo');
    check('削除の確認でキャンセルすると残る', (await evTexts(page)).some((t) => t.includes('タップ予定')));
    await page.click('#fDelete');
    await page.click('#askYes');
    check('確認して削除すると消える', !(await evTexts(page)).some((t) => t.includes('タップ予定')));

    // メンバー
    await page.click('#members');
    await page.click('#addMember');
    await page.keyboard.type('鈴木');
    await page.keyboard.press('Tab');
    check('メンバー追加・名前変更', (await page.$$eval('.colhead', (hs) => hs.map((x) => x.textContent))).includes('鈴木'));
    const before = (await evTexts(page)).length;
    await page.click('#memberList .member-row:nth-child(2) button');
    check('メンバー削除時に予定件数を確認', (await page.textContent('#askMsg')).includes('予定 3 件'));
    await page.click('#askYes');
    check('メンバーと予定が削除される', (await page.$$('.col')).length === 3 && (await evTexts(page)).length === before - 3);
    await page.click('#memberForm button[type=submit]');

    // 日付移動
    await page.click('#next');
    check('翌日には今日の予定が出ない', (await evTexts(page)).length === 0);
    await page.click('#prev');
    check('戻ると表示される', (await evTexts(page)).length === before - 3);

    // ズーム
    await page.click('#zoom');
    const z = await page.textContent('#zoom');
    check('ズーム切替', z.includes('大'));

    // 再読み込みで保持
    await page.reload();
    await page.waitForSelector('.ev');
    check('再読み込み後もデータが残る', (await evTexts(page)).some((t) => t.includes('ドラッグ予定（変更）')));

    // 書き出し・読み込み
    await page.click('#export');
    const json = await page.inputValue('#exportText');
    check('書き出しでJSONが出る', JSON.parse(json).members.length === 3);
    await page.click('#exportForm button[type=submit]');
    const tmp = path.join(__dirname, '.import-test.json');
    fs.writeFileSync(tmp, JSON.stringify({ members: [{ id: 'x1', name: '読込太郎', color: '#16a34a' }], events: [] }));
    await page.setInputFiles('#importFile', tmp);
    await page.click('#askYes');
    await page.waitForTimeout(200);
    check('読み込みで置き換わる', (await page.$$eval('.colhead', (hs) => hs.map((x) => x.textContent))).join() === '読込太郎');
    fs.writeFileSync(tmp, '{"broken":');
    await page.setInputFiles('#importFile', tmp);
    await page.waitForTimeout(200);
    check('壊れたファイルはエラー表示', (await toastText(page)).includes('読み込めませんでした'));
    fs.unlinkSync(tmp);

    // リマインド（5分後に始まる予定・10分前通知）
    await page.evaluate(() => {
      const pad = (n) => String(n).padStart(2, '0');
      const d = new Date(Date.now() + 5 * 60000);
      const slot = Math.floor((d.getHours() * 60 + d.getMinutes()) / 10) + 1;
      if (slot >= 144) return;
      const date = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
      localStorage.setItem('tenmin-schedule-v1', JSON.stringify({
        members: [{ id: 'm1', name: 'A', color: '#2563eb' }],
        events: [{ id: 'e1', date, memberId: 'm1', start: slot, end: slot + 1, title: 'リマインドテスト', remind: 60 }],
      }));
      localStorage.removeItem('tenmin-notified-v1');
    });
    await page.reload();
    await page.waitForTimeout(500);
    check('開始前リマインドが画面に出る', (await toastText(page)).includes('リマインドテスト'));

    // 印刷（人数別のページ数）
    for (const [n, orient, pages] of [[3, 'portrait', 1], [8, 'portrait', 2], [8, 'landscape', 1], [20, 'portrait', 4], [20, 'landscape', 2]]) {
      await page.evaluate((n) => {
        const members = Array.from({ length: n }, (_, i) => ({ id: 'm' + i, name: 'メンバー' + (i + 1), color: '#2563eb' }));
        localStorage.setItem('tenmin-schedule-v1', JSON.stringify({ members, events: [] }));
      }, n);
      await page.reload();
      await page.waitForSelector('.col');
      await page.evaluate(() => { window.print = () => {}; });
      await page.click('#print');
      await page.selectOption('#pOrient', orient);
      const imgs = await page.$$eval('#pImgs img', (x) => x.length);
      await page.click('#pPrint');
      await page.waitForTimeout(300);
      const pdf = await page.pdf({ preferCSSPageSize: true });
      const pdfPages = (pdf.toString('latin1').match(/\/Type\s*\/Page[^s]/g) || []).length;
      check(`印刷 ${n}人・${orient === 'portrait' ? '縦' : '横'} → ${pages}ページ`, imgs === pages && pdfPages === pages, `(画像${imgs} / PDF${pdfPages})`);
    }

    check('ページ内エラーなし', errors.length === 0, errors.join(' / '));
    await ctx.close();
  }

  // ---------- スマホ幅 ----------
  console.log('スマホ幅');
  {
    const ctx = await browser.newContext({ viewport: { width: 375, height: 700 }, hasTouch: true, isMobile: true });
    await ctx.addInitScript(NO_FIREBASE);
    const page = await ctx.newPage();
    await page.goto(URL);
    await page.waitForSelector('.ev');
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    check('画面が横にはみ出さない', overflow <= 0, `(${overflow}px)`);
    const fontSize = await page.$eval('#date', (e) => parseFloat(getComputedStyle(e).fontSize));
    check('入力欄が16px以上（iPhoneで拡大されない）', fontSize >= 16);
    const hdr = await page.$eval('header', (e) => e.getBoundingClientRect().height);
    check('ヘッダーが画面の1/4以下', hdr < 700 / 4, `(${hdr}px)`);
    await ctx.close();
  }

  // ---------- 共有モード（2人で同時に開く） ----------
  console.log('共有モード');
  {
    const ctx = await browser.newContext({ viewport: { width: 1100, height: 800 } });
    await ctx.addInitScript(NO_FIREBASE);
    await ctx.addInitScript(MOCK_DB);
    const a = await ctx.newPage();
    const b = await ctx.newPage();
    const errors = [];
    a.on('pageerror', (e) => errors.push(e.message));
    b.on('pageerror', (e) => errors.push(e.message));
    await a.goto(URL);
    await b.goto(URL);
    await a.waitForSelector('#emptyAdd');
    check('状態表示が「共有中」', (await a.textContent('#status')) === '共有中');
    check('最初はメンバー追加の案内', !!(await b.$('#emptyAdd')));

    await a.click('#emptyAdd');
    await a.click('#addMember');
    await a.keyboard.type('Aさん');
    await a.keyboard.press('Tab');
    await a.click('#memberForm button[type=submit]');
    await b.waitForTimeout(300);
    check('Aが追加したメンバーがBに表示される', (await b.$$eval('.colhead', (hs) => hs.map((x) => x.textContent))).join() === 'Aさん');

    await b.click('#members');
    await b.click('#addMember');
    await b.keyboard.type('Bさん');
    await b.keyboard.press('Tab');
    await b.click('#memberForm button[type=submit]');
    await a.waitForTimeout(300);
    check('Bが追加したメンバーがAに表示される', (await a.$$eval('.colhead', (hs) => hs.map((x) => x.textContent))).join() === 'Aさん,Bさん');

    await scrollTo(a, 50);
    const { r, h } = await slotBox(a, 0);
    await a.mouse.move(r.x + 20, r.y + h * 54 + 2);
    await a.mouse.down();
    await a.mouse.move(r.x + 20, r.y + h * 56 + 2, { steps: 3 });
    await a.mouse.up();
    await a.fill('#fTitle', '共有の朝会');
    await a.click('#editorForm button[type=submit]');
    await b.waitForTimeout(300);
    check('Aの予定がBにすぐ表示される', (await evTexts(b)).some((t) => t.includes('共有の朝会09:00–09:30')));

    await b.click('.ev >> text=共有の朝会');
    await b.fill('#fTitle', '朝会（Bが変更）');
    await b.click('#editorForm button[type=submit]');
    await a.waitForTimeout(300);
    check('Bの変更がAに反映される', (await evTexts(a)).some((t) => t.includes('朝会（Bが変更）')));

    await a.click('.ev');
    await a.click('#fDelete');
    await a.click('#askYes');
    await b.waitForTimeout(300);
    check('Aの削除がBに反映される', (await evTexts(b)).length === 0);

    // 閲覧のみの人
    await a.evaluate(() => localStorage.setItem('__readonly', '1'));
    const { r: r2, h: h2 } = await slotBox(a, 1);
    await a.mouse.click(r2.x + 20, r2.y + h2 * 55 + 2);
    await a.mouse.click(r2.x + 20, r2.y + h2 * 55 + 2);
    await a.click('#editorForm button[type=submit]');
    await a.waitForTimeout(200);
    check('権限がないと保存できず案内が出る', (await toastText(a)).includes('権限がありません') && (await a.textContent('#status')) === '共有・閲覧のみ');
    check('ページ内エラーなし', errors.length === 0, errors.join(' / '));
    await ctx.close();
  }

  // ---------- Firebase モード（リンクを知っている人で共有） ----------
  console.log('Firebase モード（疑似サーバー）');
  {
    const http = require('http');
    const root = path.resolve(__dirname, '..');
    const server = http.createServer((req, res) => {
      const u = new globalThis.URL(req.url, 'http://x');
      const file = path.join(root, u.pathname === '/' ? 'index.html' : decodeURIComponent(u.pathname));
      if (!file.startsWith(root) || !fs.existsSync(file)) { res.writeHead(404); return res.end(); }
      res.writeHead(200, { 'Content-Type': file.endsWith('.js') ? 'text/javascript' : 'text/html; charset=utf-8' });
      fs.createReadStream(file).pipe(res);
    });
    await new Promise((r) => server.listen(0, r));
    const base = `http://127.0.0.1:${server.address().port}/index.html`;

    // Firestore REST API の疑似サーバー（テストプロセス内のメモリに保存。全ページで共有）
    const store = new Map();                  // 'boards/<id>/<col>/<doc>' -> fields
    let deny = false, offline = false;
    const PREFIX = '/v1/projects/test/databases/(default)/documents/';
    const docJson = (key) => ({ name: 'projects/test/databases/(default)/documents/' + key, fields: store.get(key) });
    const fsRoute = async (route) => {
      const req = route.request();
      if (offline) return route.abort('internetdisconnected');
      const u = new globalThis.URL(req.url());
      const p = decodeURIComponent(u.pathname);
      const reply = (status, body) => route.fulfill({ status, contentType: 'application/json',
        headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify(body) });
      if (!p.startsWith(PREFIX)) return reply(404, {});
      const rest = p.slice(PREFIX.length);
      if (req.method() === 'POST' && rest.endsWith(':runQuery')) {
        const parent = rest.slice(0, -':runQuery'.length);
        const q = JSON.parse(req.postData()).structuredQuery;
        const col = parent + '/' + q.from[0].collectionId + '/';
        const want = q.where.fieldFilter.value.arrayValue.values.map((v) => v.stringValue);
        const hits = [...store.keys()].filter((k) => k.startsWith(col) && !k.slice(col.length).includes('/')
          && want.includes(store.get(k).date.stringValue));
        return reply(200, hits.length ? hits.map((k) => ({ document: docJson(k) })) : [{ readTime: 'x' }]);
      }
      const segs = rest.split('/');
      if (segs.length % 2 === 1) {             // コレクションの一覧
        const col = rest + '/';
        const docs = [...store.keys()].filter((k) => k.startsWith(col) && !k.slice(col.length).includes('/')).map(docJson);
        return reply(200, docs.length ? { documents: docs } : {});
      }
      if (req.method() === 'GET') return store.has(rest) ? reply(200, docJson(rest)) : reply(404, { error: { code: 404 } });
      if (deny && !rest.includes('/meta/')) return reply(403, { error: { code: 403, status: 'PERMISSION_DENIED' } });
      if (req.method() === 'PATCH') { store.set(rest, JSON.parse(req.postData()).fields); return reply(200, docJson(rest)); }
      if (req.method() === 'DELETE') { store.delete(rest); return reply(200, {}); }
      return reply(400, {});
    };
    const ctx = await browser.newContext({ viewport: { width: 1100, height: 800 } });
    await ctx.addInitScript(() => { try { delete Navigator.prototype.share; } catch {} });
    await ctx.route('**/firebase-config.js', (route) => route.fulfill({
      contentType: 'text/javascript',
      body: "window.FIREBASE_CONFIG = { apiKey: 'test', projectId: 'test' };",
    }));
    await ctx.route('https://firestore.googleapis.com/**', fsRoute);
    const errors = [];
    const a = await ctx.newPage();
    a.on('pageerror', (e) => errors.push(e.message));
    await a.goto(base);
    await a.waitForSelector('#newBoard');
    check('最初は「新しい予定表を作る」画面', true);
    await a.click('#newBoard');
    await a.waitForSelector('#emptyAdd');
    const boardUrl = a.url();
    check('予定表IDがURLに入る', /\?b=[A-Za-z0-9_-]{20}$/.test(boardUrl), boardUrl);
    check('「共有中」と招待ボタンが出る', (await a.textContent('#status')) === '共有中' && !(await a.$eval('#invite', (e) => e.hidden)));

    await a.click('#emptyAdd');
    await a.click('#addMember');
    await a.keyboard.type('Aさん');
    await a.keyboard.press('Tab');
    await a.click('#memberForm button[type=submit]');
    await scrollTo(a, 50);
    const { r, h } = await slotBox(a, 0);
    await a.mouse.click(r.x + 20, r.y + h * 54 + 2);
    await a.mouse.click(r.x + 20, r.y + h * 56 + 2);
    await a.fill('#fTitle', 'リンク共有の予定');
    await a.click('#editorForm button[type=submit]');

    const b = await ctx.newPage();
    b.on('pageerror', (e) => errors.push(e.message));
    await b.goto(boardUrl);
    await b.waitForSelector('.ev');
    check('招待リンクを開いた人に同じ予定が見える', (await evTexts(b)).some((t) => t.includes('リンク共有の予定09:00–09:30')));
    await b.click('.ev');
    check('場所・担当者が空なら保存データに含めない', [...store.values()].some((f) => f.title && !('place' in f) && !('person' in f)));
    await b.fill('#fTitle', 'Bが変更');
    await b.fill('#fPlace', '体育館');
    await b.fill('#fPerson', '佐藤');
    await b.click('#editorForm button[type=submit]');
    const synced = await a.waitForFunction(() => [...document.querySelectorAll('.ev')].some((e) => e.textContent.includes('Bが変更')),
      null, { timeout: 8000 }).then(() => true, () => false);
    check('Bの変更が数秒以内にAに反映される', synced);
    check('場所・担当者もサーバーに保存され、Aに表示される',
      [...store.values()].some((f) => f.place && f.place.stringValue === '体育館' && f.person.stringValue === '佐藤')
      && (await evTexts(a)).some((t) => t.includes('📍体育館') && t.includes('👤佐藤')));

    const c = await ctx.newPage();
    await c.goto(base);
    await c.click('#newBoard');
    await c.waitForSelector('#emptyAdd');
    check('別の予定表には他の予定表の中身が出ない', (await c.$$('.ev')).length === 0 && c.url() !== boardUrl);

    await a.click('#invite');
    check('招待画面にリンクが表示される', (await a.inputValue('#inviteUrl')) === boardUrl);
    await a.click('#inviteForm button[type=submit]');

    // 通信が切れたら「接続待ち」になり、保存は失敗として知らされる
    offline = true;
    const waiting = await a.waitForFunction(() => document.querySelector('#status').textContent === '接続待ち',
      null, { timeout: 8000 }).then(() => true, () => false);
    check('通信が切れると「接続待ち」と表示される', waiting);
    await a.click('.ev');
    await a.fill('#fTitle', '届かない変更');
    await a.click('#editorForm button[type=submit]');
    await a.waitForTimeout(2000)   // 1回だけ自動で再試行してから知らせる;
    check('通信が切れている間の保存は失敗と表示される', (await toastText(a)).includes('保存できませんでした') && (await a.$eval('#editor', (d) => d.open)));
    await a.click('#fCancel');
    offline = false;
    const back = await a.waitForFunction(() => document.querySelector('#status').textContent === '共有中',
      null, { timeout: 8000 }).then(() => true, () => false);
    check('つながると「共有中」に戻る', back);

    deny = true;
    await a.click('.ev');
    await a.fill('#fTitle', '拒否される変更');
    await a.click('#editorForm button[type=submit]');
    await a.waitForTimeout(200);
    check('サーバーに拒否されたら保存されず案内が出る', (await toastText(a)).includes('保存できませんでした') && (await a.$eval('#editor', (d) => d.open)));
    check('サーバーには拒否された変更が残らない', ![...store.values()].some((f) => f.title && f.title.stringValue === '拒否される変更'));
    check('ページ内エラーなし', errors.length === 0, errors.join(' / '));
    await ctx.close();
    server.close();
  }

  await browser.close();
  console.log(`\n結果: ${passed} 件成功 / ${failed} 件失敗`);
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
