import * as store from './db.js';
import { todayStr, addDays } from './logic.js';
import { $, $$, closeSheet, toast } from './ui.js';
import * as home from './views/home.js';
import * as train from './views/train.js';
import * as care from './views/care.js';
import * as food from './views/food.js';
import * as stats from './views/stats.js';
import * as share from './views/share.js';
import * as settings from './views/settings.js';

const ROUTES = {
  home: { view: home, title: 'TODAY' },
  train: { view: train, title: 'トレーニング' },
  care: { view: care, title: 'コンディション' },
  food: { view: food, title: '栄養' },
  stats: { view: stats, title: '数値・目標' },
  share: { view: share, title: 'SNSカード' },
  settings: { view: settings, title: '設定' },
};

const ctx = {
  date: todayStr(),
  refresh: () => render(),
  catColor: (id) => store.categoryById(id)?.color || '#888',
};

function route() {
  const name = location.hash.replace(/^#\/?/, '') || 'home';
  return ROUTES[name] ? name : 'home';
}

function render() {
  const name = route();
  const { view, title } = ROUTES[name];
  $('#title').textContent = title;
  const today = todayStr();
  $('#date-label').textContent = ctx.date === today ? '今日' : ctx.date.slice(5).replace('-', '/');
  $('#date-input').value = ctx.date;
  $('#date-next').disabled = ctx.date >= today;
  $$('.tabbar a').forEach((a) => a.classList.toggle('on', a.getAttribute('href') === `#/${name}`));

  // Fresh container per render so view-level listeners never accumulate.
  const host = $('#view');
  const scroll = host.dataset.route === name ? window.scrollY : 0;
  const root = document.createElement('div');
  root.className = 'view-inner';
  host.replaceChildren(root);
  host.dataset.route = name;
  view.render(root, ctx);
  window.scrollTo(0, scroll);
}

function setDate(d) {
  ctx.date = d > todayStr() ? todayStr() : d;
  render();
}

store.load();
store.setSaveErrorHandler(() => toast('⚠ 保存に失敗しました（容量不足/プライベートモード）。バックアップを書き出してください'));
store.watchOtherTabs(() => render());
store.requestPersistence();
window.addEventListener('hashchange', () => { closeSheet(); render(); });
$('#date-prev').onclick = () => setDate(addDays(ctx.date, -1));
$('#date-next').onclick = () => setDate(addDays(ctx.date, 1));
$('#date-input').onchange = (e) => e.target.value && setDate(e.target.value);
$('#date-label').onclick = () => $('#date-input').showPicker?.() ?? $('#date-input').focus();
// Roll over to the new day if the app was left open overnight.
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && ctx.date < todayStr() && ctx.date === addDays(todayStr(), -1)) setDate(todayStr());
});
render();

/**
 * PITCH LAB was briefly published at /test/, which belongs to another app (10分スケジュール).
 * That deployment left a service worker scoped to /test/ (cache 'pitchlab-v3').
 * Remove it once so it can never answer requests for the other app. The cache name is the
 * marker: it is deleted here, so this never touches a worker the other app registers later.
 */
async function retireLegacyWorker() {
  if (!(await caches.has('pitchlab-v3'))) return;
  const scope = `${location.origin}/test/`;
  if (new URL('./', location.href).href !== scope) {
    for (const reg of await navigator.serviceWorker.getRegistrations()) {
      const script = (reg.active || reg.waiting || reg.installing)?.scriptURL;
      if (reg.scope === scope && script === `${scope}sw.js`) await reg.unregister();
    }
  }
  await caches.delete('pitchlab-v3');
}

if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  retireLegacyWorker().catch(() => {});
  navigator.serviceWorker.register('./sw.js').catch(() => {});
}
