import * as store from '../db.js';
import { esc, $, num, seg, stepper, levelInfo, fmt } from '../ui.js';
import { readinessFor } from '../derive.js';
import { SORE_PARTS, ROM_ITEMS, addDays, highSoreParts } from '../logic.js';
import { soreAlert } from '../sore-alert.js';
import { showCategory } from './train.js';

const SCALE = [1, 2, 3, 4, 5].map((v) => [v, String(v)]);

export function render(root, ctx) {
  const c = store.conditionOn(ctx.date) || { soreness: {}, fatigue: 1, sleepHours: '', rom: {}, note: '' };
  const arm = store.db().profile.throwingArm;

  root.innerHTML = `
  <div id="readiness-box"></div>

  <section class="card">
    <div class="eyebrow">部位別 違和感（1=なし 〜 5=強い痛み）</div>
    <form id="cond-form" class="stack">
      ${SORE_PARTS.map((p) => `<div class="sore-row"><span class="sore-lbl">${p.label}${p.critical ? '<i class="crit">投</i>' : ''}</span>${seg(`s_${p.key}`, SCALE, c.soreness?.[p.key] ?? 1, 'sore')}</div>`).join('')}
      <div class="sore-row"><span class="sore-lbl">全身疲労</span>${seg('fatigue', SCALE, c.fatigue ?? 1, 'sore')}</div>
      ${stepper('sleepHours', c.sleepHours ?? '', 0.5, { label: '睡眠', unit: '時間' })}

      <details class="rom" ${Object.keys(c.rom || {}).length ? 'open' : ''}>
        <summary>可動域（ROM）セルフチェック <span class="muted small">投球側=${arm === 'R' ? '右' : '左'}</span></summary>
        <div class="rom-grid">
          <span></span><span class="muted small">左 L</span><span class="muted small">右 R</span><span class="muted small">目安</span>
          ${ROM_ITEMS.map((it) => `
            <span class="small">${it.label}</span>
            <input class="input sm" type="number" inputmode="numeric" name="rom_${it.key}_L" value="${c.rom?.[it.key]?.L ?? ''}">
            <input class="input sm" type="number" inputmode="numeric" name="rom_${it.key}_R" value="${c.rom?.[it.key]?.R ?? ''}">
            <span class="muted small">${it.ref}${it.unit}</span>`).join('')}
        </div>
        <p class="muted small">ゴニオメーターアプリ等で測定。肩は仰向け・90°外転位で計測し、投球側内旋が非投球側より20°以上少ないとGIRD警告を出します。</p>
      </details>
      <textarea class="input" name="note" rows="2" placeholder="メモ（張り・痛みの出方など）">${esc(c.note || '')}</textarea>
    </form>
  </section>

  <section class="card"><div class="eyebrow">直近14日の推移</div>${history(ctx.date)}</section>`;

  const form = $('#cond-form', root);
  let prevSoreness = { ...(c.soreness || {}) };
  const save = async () => {
    const f = new FormData(form);
    const soreness = Object.fromEntries(SORE_PARTS.map((p) => [p.key, num(f.get(`s_${p.key}`)) ?? 1]));
    const rom = {};
    for (const it of ROM_ITEMS) {
      const L = num(f.get(`rom_${it.key}_L`)); const R = num(f.get(`rom_${it.key}_R`));
      if (L != null || R != null) rom[it.key] = { L, R };
    }
    store.upsertCondition(ctx.date, { soreness, fatigue: num(f.get('fatigue')) ?? 1, sleepHours: num(f.get('sleepHours')), rom, note: f.get('note') });
    paintReadiness(root, ctx);
    // Warn only when a part newly reaches 4+, so re-saving other fields doesn't re-open the dialog.
    const crossed = highSoreParts(soreness, prevSoreness);
    prevSoreness = soreness;
    if (crossed.length && (await soreAlert(crossed)) === 'care') {
      showCategory('cat-care');
      location.hash = '#/train';
    }
  };
  form.addEventListener('change', save);
  form.addEventListener('submit', (e) => e.preventDefault());
  paintReadiness(root, ctx);
}

function paintReadiness(root, ctx) {
  const r = readinessFor(ctx.date);
  const lv = levelInfo[r.level];
  $('#readiness-box', root).innerHTML = `
    <section class="card readiness ${lv.cls}">
      <div class="row between"><div><div class="eyebrow">判定（自動保存）</div><div class="big-level">${lv.label}<small>${lv.ja}</small></div></div>
      <div class="ring" style="--p:${r.score ?? 0}"><span>${r.score ?? '—'}</span></div></div>
      <ul class="reasons">${r.reasons.map((x) => `<li class="r-${x.level}">${esc(x.msg)}</li>`).join('')}</ul>
      ${r.acwr != null ? `<div class="muted small">急性/慢性負荷比 (ACWR)：${fmt(r.acwr, 2)}（0.8〜1.3が目安）</div>` : ''}
    </section>`;
}

function history(date) {
  const days = Array.from({ length: 14 }, (_, i) => addDays(date, i - 13));
  const rows = [...SORE_PARTS.slice(0, 4), { key: '_fatigue', label: '疲労' }];
  return `<div class="heat">
    ${rows.map((p) => `<div class="heat-row"><span class="small">${p.label}</span>${days.map((d) => {
      const c = store.conditionOn(d);
      const v = c ? (p.key === '_fatigue' ? c.fatigue : c.soreness?.[p.key]) ?? 1 : 0;
      return `<i class="h${v}" title="${d} : ${v || '未入力'}"></i>`;
    }).join('')}</div>`).join('')}
    <div class="heat-row"><span></span><span class="muted small heat-axis">${days[0].slice(5)}<span>${days[13].slice(5)}</span></span></div>
  </div>`;
}
