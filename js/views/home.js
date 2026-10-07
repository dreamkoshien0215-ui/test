import * as store from '../db.js';
import { esc, fmt, levelInfo, $, toast } from '../ui.js';
import { renderCard, shareOrDownload } from '../share-canvas.js';
import { readinessFor, velocityView, nutritionView, workoutSummary, shareData } from '../derive.js';
import { daysBetween } from '../logic.js';

export function render(root, ctx) {
  const { date } = ctx;
  const r = readinessFor(date);
  const lv = levelInfo[r.level];
  const v = velocityView(date);
  const n = nutritionView(date);
  const wk = workoutSummary(date);
  const daysLeft = daysBetween(date, v.milestone.targetDate);
  const backupAge = store.backupAgeDays();

  root.innerHTML = `
  ${backupAge != null && backupAge >= 30 ? `<a class="alert lv-caution" href="#/settings">
    <b>💾 バックアップ推奨</b>${backupAge === Infinity ? 'まだ一度もバックアップしていません。' : `最終バックアップから${backupAge}日経過。`}データは端末内のみに保存されています。設定から書き出しを。</a>` : ''}
  <section class="card readiness ${lv.cls}">
    <div class="row between">
      <div>
        <div class="eyebrow">TODAY'S READINESS</div>
        <div class="big-level">${lv.label}<small>${lv.ja}</small></div>
      </div>
      <div class="ring" style="--p:${r.score ?? 0}"><span>${r.score ?? '—'}</span></div>
    </div>
    <ul class="reasons">${r.reasons.map((x) => `<li class="r-${x.level}">${esc(x.msg)}</li>`).join('')}</ul>
    <a class="btn ${r.level === 'unknown' ? 'primary' : 'ghost'} block" href="#/care">${r.level === 'unknown' ? '30秒コンディション入力' : 'コンディションを更新'}</a>
  </section>

  <section class="card">
    <div class="row between"><div class="eyebrow">ROAD TO ${v.target}</div><a class="link" href="#/stats">詳細 ›</a></div>
    <div class="velo">
      <span class="velo-num">${fmt(v.best, 1)}</span><span class="velo-unit">km/h</span>
      ${v.today != null ? `<span class="chip">本日 ${fmt(v.today, 1)}</span>` : ''}
    </div>
    <div class="bar"><i style="width:${v.pct}%"></i></div>
    <div class="row between small muted"><span>達成率 ${v.pct}%（あと ${v.best ? fmt(Math.max(0, v.target - v.best), 1) : '—'} km/h）</span><span>${daysLeft >= 0 ? `目標日まで ${daysLeft}日` : '目標日経過'}</span></div>
  </section>

  <section class="card">
    <div class="row between"><div class="eyebrow">TRAINING · ${wk.length}種目</div><a class="link" href="#/train">記録 ›</a></div>
    ${wk.length ? `<ul class="list compact">${wk.map((w) => `<li><span class="dot" style="background:${esc(ctx.catColor(w.drill?.categoryId))}"></span><div class="grow">${esc(w.name)}<div class="muted small">${esc(w.detail)} · RPE${esc(w.log.rpe)}</div></div></li>`).join('')}</ul>`
      : `<p class="muted small">まだ記録がありません。</p>`}
  </section>

  <section class="card">
    <div class="row between"><div class="eyebrow">NUTRITION</div><a class="link" href="#/food">入力 ›</a></div>
    ${n.targets ? macroBars(n) : '<p class="muted small">設定でプロフィールを入力してください。</p>'}
  </section>

  <div class="row gap">
    <a class="btn ghost grow lg" href="#/share">📸 カードを編集</a>
    <button class="btn primary grow lg" data-quick-save>⬇ 画像を保存</button>
  </div>`;

  // One-tap save: render the card off-screen with the current share settings and download it.
  $('[data-quick-save]', root).onclick = async () => {
    const st = store.db().shareSettings;
    const canvas = document.createElement('canvas');
    await document.fonts?.ready;
    renderCard(canvas, shareData(date), st);
    await shareOrDownload(canvas, st.format, `pitchlab_${date}_${st.size}`, false);
    toast(`${st.format.toUpperCase()}画像を保存しました`);
  };
}

export function macroBars(n) {
  const rows = [
    ['エネルギー', n.totals.kcal, n.targets.kcal, 'kcal', 'k'],
    ['P たんぱく質', n.totals.p, n.targets.p, 'g', 'p'],
    ['F 脂質', n.totals.f, n.targets.f, 'g', 'f'],
    ['C 炭水化物', n.totals.c, n.targets.c, 'g', 'c'],
  ];
  return `<div class="macros">${rows.map(([l, cur, tgt, u, k]) => {
    const pct = tgt ? Math.round((cur / tgt) * 100) : 0;
    return `<div class="macro m-${k}"><div class="row between small"><span>${l}</span><span><b>${fmt(cur)}</b> / ${fmt(tgt)}${u}</span></div>
      <div class="bar thin ${pct > 110 ? 'over' : ''}"><i style="width:${Math.min(100, pct)}%"></i></div></div>`;
  }).join('')}</div>`;
}
