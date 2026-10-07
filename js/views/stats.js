import * as store from '../db.js';
import { esc, $, $$, num, stepper, seg, openSheet, closeSheet, toast, formData, fmt } from '../ui.js';
import { velocityView, milestoneView } from '../derive.js';
import { lineChart } from '../charts.js';
import { dailyMax, ROM_ITEMS, addDays } from '../logic.js';

let metricKey = 'trapbarDL';
let romKey = 'shoulderIR';
const CONTEXTS = [['bullpen', 'ブルペン'], ['game', '試合'], ['pulldown', 'プルダウン']];

export function render(root, ctx) {
  const s = store.db();
  const v = velocityView(ctx.date);
  const lastVelo = store.metricSeries('velocity').at(-1);
  const others = s.metricDefs.filter((d) => d.key !== 'velocity');
  if (!others.find((d) => d.key === metricKey)) metricKey = others[0]?.key;
  const mdef = store.metricDef(metricKey);
  const mseries = metricKey ? store.metricSeries(metricKey).map((x) => ({ date: x.date, value: Number(x.value) })) : [];
  const ms = s.milestones.map((m) => milestoneView(m, ctx.date));

  root.innerHTML = `
  <section class="card">
    <div class="eyebrow">球速を記録</div>
    <form id="velo-form" class="stack">
      ${stepper('value', lastVelo?.value ?? 130, 0.5, { label: '球速', unit: 'km/h' })}
      ${seg('context', CONTEXTS, lastVelo?.context ?? 'bullpen')}
      <button class="btn primary block">記録する</button>
    </form>
  </section>

  <section class="card">
    <div class="row between"><div class="eyebrow">球速推移（日別最速）</div><span class="small">PB <b>${fmt(v.best, 1)}</b> km/h</span></div>
    <canvas class="chart" id="velo-chart"></canvas>
    ${recentList('velocity')}
  </section>

  <section class="card">
    <div class="row between"><div class="eyebrow">マイルストーン</div><button class="link" data-new-ms>＋ 追加</button></div>
    ${ms.map((m) => `<div class="ms" data-ms="${m.id}">
      <div class="row between"><b>${esc(m.title)}</b><span class="small muted">${m.targetDate}</span></div>
      <div class="row between small"><span>${fmt(m.start, 1)} → <b>${fmt(m.current, 1)}</b> / ${fmt(m.targetValue, 1)}${esc(m.def?.unit || '')}</span><span><b>${m.pct}%</b></span></div>
      <div class="bar"><i style="width:${m.pct}%"></i><em style="left:${m.timePct}%" title="期間経過 ${m.timePct}%"></em></div>
      <div class="small muted">期間経過 ${m.timePct}%${m.pct >= m.timePct ? ' · 順調 ✓' : ' · ペース遅れ'}</div>
    </div>`).join('') || '<p class="muted small">マイルストーンなし</p>'}
  </section>

  <section class="card">
    <div class="row between"><div class="eyebrow">筋力・パフォーマンス指標</div><button class="link" data-new-metric>＋ 指標</button></div>
    <select class="input" id="metric-sel">${others.map((d) => `<option value="${d.key}" ${d.key === metricKey ? 'selected' : ''}>${esc(d.name)} (${esc(d.unit)})</option>`).join('')}</select>
    <canvas class="chart" id="metric-chart"></canvas>
    <form id="metric-form" class="row gap">
      <input class="input grow" name="value" type="number" step="any" inputmode="decimal" placeholder="${esc(mdef?.name || '')} を入力" required>
      <button class="btn primary">追加</button>
    </form>
    ${metricKey ? recentList(metricKey) : ''}
  </section>

  <section class="card">
    <div class="eyebrow">可動域（ROM）推移</div>
    <select class="input" id="rom-sel">${ROM_ITEMS.map((it) => `<option value="${it.key}" ${it.key === romKey ? 'selected' : ''}>${it.label}</option>`).join('')}</select>
    <canvas class="chart" id="rom-chart"></canvas>
    <div class="small muted">実線=投球側（${s.profile.throwingArm === 'R' ? '右' : '左'}）。コンディション画面で入力した値を表示します。</div>
  </section>`;

  lineChart($('#velo-chart', root), v.series, { target: v.target, unit: 'km/h' });
  lineChart($('#metric-chart', root), dailyMax(mseries), { unit: mdef?.unit, color: '#a78bfa' });
  const romSeries = s.conditionLogs
    .filter((c) => num(c.rom?.[romKey]?.[s.profile.throwingArm]) != null && c.date >= addDays(ctx.date, -180))
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((c) => ({ date: c.date, value: Number(c.rom[romKey][s.profile.throwingArm]) }));
  lineChart($('#rom-chart', root), romSeries, { unit: '°', color: '#22c55e' });

  $('#velo-form', root).onsubmit = (e) => {
    e.preventDefault();
    const f = formData(e.target);
    const val = num(f.value);
    if (!val || val < 40 || val > 180) { toast('球速の値を確認してください'); return; }
    const prevBest = v.best;
    store.insert('metricLogs', { date: ctx.date, metricKey: 'velocity', value: val, context: f.context });
    toast(prevBest && val > prevBest ? `🔥 自己ベスト更新！ ${val}km/h` : `✓ ${val}km/h を記録`);
    ctx.refresh();
  };
  $('#metric-sel', root).onchange = (e) => { metricKey = e.target.value; ctx.refresh(); };
  $('#rom-sel', root).onchange = (e) => { romKey = e.target.value; ctx.refresh(); };
  $('#metric-form', root).onsubmit = (e) => {
    e.preventDefault();
    store.insert('metricLogs', { date: ctx.date, metricKey, value: num(formData(e.target).value) });
    toast('✓ 記録しました'); ctx.refresh();
  };
  $$('[data-del-metric]', root).forEach((b) => b.onclick = () => { if (confirm('削除しますか？')) { store.remove('metricLogs', b.dataset.delMetric); ctx.refresh(); } });
  $$('[data-ms]', root).forEach((el) => el.onclick = () => msForm(ctx, el.dataset.ms));
  $('[data-new-ms]', root).onclick = () => msForm(ctx, null);
  $('[data-new-metric]', root).onclick = () => metricForm(ctx);
}

function recentList(key) {
  const def = store.metricDef(key);
  const items = store.metricSeries(key).slice(-5).reverse();
  if (!items.length) return '';
  const ctxLabel = Object.fromEntries(CONTEXTS);
  return `<ul class="list compact">${items.map((x) => `<li><span class="muted small">${x.date}</span><div class="grow"><b>${fmt(x.value, 1)}</b> ${esc(def?.unit || '')} ${x.context ? `<span class="chip">${esc(ctxLabel[x.context] || x.context)}</span>` : ''}</div>
    <button class="icon-btn" data-del-metric="${x.id}" aria-label="削除">🗑</button></li>`).join('')}</ul>`;
}

function msForm(ctx, id) {
  const s = store.db();
  const m = id ? s.milestones.find((x) => x.id === id) : { title: '', metricKey: 'velocity', startValue: null, targetValue: '', startDate: ctx.date, targetDate: addDays(ctx.date, 180) };
  openSheet(id ? 'マイルストーン編集' : 'マイルストーン追加', `
    <form class="stack">
      <label>タイトル<input class="input" name="title" required value="${esc(m.title)}"></label>
      <label>指標<select class="input" name="metricKey">${s.metricDefs.map((d) => `<option value="${d.key}" ${d.key === m.metricKey ? 'selected' : ''}>${esc(d.name)}</option>`).join('')}</select></label>
      <div class="grid2">
        <label>開始値（空=初回記録）<input class="input" name="startValue" type="number" step="any" value="${m.startValue ?? ''}"></label>
        <label>目標値<input class="input" name="targetValue" type="number" step="any" required value="${m.targetValue}"></label>
        <label>開始日<input class="input" name="startDate" type="date" required value="${m.startDate}"></label>
        <label>目標日<input class="input" name="targetDate" type="date" required value="${m.targetDate}"></label>
      </div>
      <button class="btn primary block">保存</button>
      ${id ? '<button type="button" class="btn danger block" data-del>削除</button>' : ''}
    </form>`, (body) => {
    $('form', body).onsubmit = (e) => {
      e.preventDefault();
      const f = formData(e.target);
      const row = { ...f, startValue: num(f.startValue), targetValue: num(f.targetValue) };
      if (id) store.update('milestones', id, row); else store.insert('milestones', row);
      closeSheet(); ctx.refresh();
    };
    $('[data-del]', body)?.addEventListener('click', () => { if (confirm('削除しますか？')) { store.remove('milestones', id); closeSheet(); ctx.refresh(); } });
  });
}

function metricForm(ctx) {
  openSheet('指標を追加', `
    <form class="stack">
      <label>名称<input class="input" name="name" required placeholder="例：ベンチプレス 1RM"></label>
      <label>単位<input class="input" name="unit" required placeholder="kg / cm / ° / 秒"></label>
      <label>現在値の扱い<select class="input" name="aggregate"><option value="max">自己ベスト（最大値）</option><option value="latest">最新値</option></select></label>
      <button class="btn primary block">追加</button>
    </form>`, (body) => {
    $('form', body).onsubmit = (e) => {
      e.preventDefault();
      const f = formData(e.target);
      const key = `m_${Date.now().toString(36)}`;
      store.db().metricDefs.push({ key, name: f.name.trim(), unit: f.unit.trim(), aggregate: f.aggregate });
      store.persist();
      metricKey = key;
      closeSheet(); ctx.refresh();
    };
  });
}
