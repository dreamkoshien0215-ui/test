import * as store from '../db.js';
import { esc, $, $$, num, stepper, seg, openSheet, closeSheet, toast, formData, levelInfo } from '../ui.js';
import { readinessFor, workoutSummary } from '../derive.js';
import { youtubeId, youtubeSearchUrl, channelSearchUrl, highSoreParts } from '../logic.js';
import { soreLogGuard } from '../sore-alert.js';

let activeCat = 'all';
/** Pre-select a category filter (e.g. jump to care drills from the soreness warning). */
export const showCategory = (id) => { activeCat = id; };
// High-intensity categories that should not be trained on a soreness-4+ day.
const HIGH_INTENSITY = new Set(['cat-power', 'cat-core']);
const RPE_OPTS = [6, 7, 8, 9, 10].map((v) => [v, String(v)]);

export function render(root, ctx) {
  const s = store.db();
  const r = readinessFor(ctx.date);
  const cats = [...s.categories].sort((a, b) => a.order - b.order);
  const drills = s.drills.filter((d) => !d.archived && (activeCat === 'all' || (activeCat === 'fav' ? d.favorite : d.categoryId === activeCat)));
  const done = workoutSummary(ctx.date);
  const doneIds = new Set(done.map((x) => x.log.drillId));

  root.innerHTML = `
  ${r.level === 'rest' || r.level === 'caution' ? `<div class="alert ${levelInfo[r.level].cls}">
    <b>${r.level === 'rest' ? '⚠ レスト推奨日' : '⚠ 強度調整日'}</b>
    ${r.level === 'rest' ? '出力・爆発力系は中止し、リカバリー・ケア中心に。' : '最大努力・出力系はボリュームを落として。'}</div>` : ''}

  ${done.length ? `<section class="card"><div class="eyebrow">本日の記録</div><ul class="list">
    ${done.map((w) => `<li><span class="dot" style="background:${esc(ctx.catColor(w.drill?.categoryId))}"></span>
      <div class="grow"><div>${esc(w.name)}</div><div class="muted small">${esc(w.detail)} · RPE ${esc(w.log.rpe)}${w.log.note ? ` · ${esc(w.log.note)}` : ''}</div></div>
      <button class="icon-btn" data-del-log="${w.log.id}" aria-label="削除">🗑</button></li>`).join('')}
  </ul></section>` : ''}

  <div class="chips scroll-x">
    <button class="chip-btn ${activeCat === 'all' ? 'on' : ''}" data-cat="all">すべて</button>
    <button class="chip-btn ${activeCat === 'fav' ? 'on' : ''}" data-cat="fav">★</button>
    ${cats.map((c) => `<button class="chip-btn ${activeCat === c.id ? 'on' : ''}" data-cat="${c.id}" style="--c:${esc(c.color)}">${esc(c.name)}</button>`).join('')}
  </div>

  <div class="drills">
    ${drills.map((d) => {
      const c = store.categoryById(d.categoryId);
      const last = store.lastWorkoutFor(d.id);
      const risky = r.level === 'rest' && d.categoryId === 'cat-power';
      return `<article class="drill ${doneIds.has(d.id) ? 'done' : ''} ${risky ? 'risky' : ''}" style="--c:${esc(c?.color || '#888')}" data-open="${d.id}">
        <div class="drill-main">
          <div class="drill-cat">${esc(c?.name || '')}${d.favorite ? ' ★' : ''}</div>
          <div class="drill-name">${esc(d.name)}</div>
          ${d.cue ? `<div class="cue">💡 ${esc(d.cue)}</div>` : ''}
          <div class="muted small">${last ? `前回 ${last.date.slice(5)}：${Number(last.weightKg) ? `${last.weightKg}kg×` : ''}${last.reps}×${last.sets} RPE${last.rpe}` : '記録なし'}</div>
        </div>
        <button class="log-btn" data-quick="${d.id}" aria-label="${esc(d.name)}を記録">${doneIds.has(d.id) ? '✓' : '＋'}</button>
      </article>`;
    }).join('') || '<p class="muted">該当するドリルがありません。</p>'}
  </div>
  <button class="btn ghost block" data-new-drill>＋ ドリルを追加</button>`;

  $$('[data-cat]', root).forEach((b) => b.onclick = () => { activeCat = b.dataset.cat; ctx.refresh(); });
  $$('[data-del-log]', root).forEach((b) => b.onclick = () => { if (confirm('この記録を削除しますか？')) { store.remove('workoutLogs', b.dataset.delLog); ctx.refresh(); } });
  $$('[data-open]', root).forEach((el) => el.onclick = (e) => { if (!e.target.closest('[data-quick]')) openDrill(el.dataset.open, ctx); });
  $$('[data-quick]', root).forEach((b) => b.onclick = () => openDrill(b.dataset.quick, ctx, true));
  $('[data-new-drill]', root).onclick = () => editDrill(null, ctx);
}

function videoBlock(d) {
  const id = youtubeId(d.youtubeUrl);
  const thumb = id ? `<a class="yt" href="${esc(d.youtubeUrl)}" target="_blank" rel="noopener">
      <img src="https://i.ytimg.com/vi/${esc(id)}/mqdefault.jpg" alt="" loading="lazy"><span class="yt-play">▶</span></a>` : '';
  const q = d.youtubeQuery || d.name.replace(/（.*?）/g, '');
  // Search inside the user's reference channels first, then all of YouTube.
  const channels = store.db().refChannels.map((c) =>
    `<a class="btn ${id ? 'ghost' : 'primary'} yt-search" href="${esc(channelSearchUrl(c.handle, q))}" target="_blank" rel="noopener">▶ @${esc(c.handle)} で探す</a>`).join('');
  return `${thumb}<div class="yt-links">${channels}
    <a class="btn ghost yt-search" href="${esc(youtubeSearchUrl(q))}" target="_blank" rel="noopener">YouTube全体で検索</a></div>
    <div class="muted small">検索ワード：${esc(q)}${id ? '' : '<br>良い動画が見つかったら「編集」でURLを貼るとここにサムネイル表示されます。'}</div>`;
}

function openDrill(id, ctx, focusLog = false) {
  const d = store.drillById(id);
  const last = store.lastWorkoutFor(id);
  const init = {
    weightKg: last?.weightKg ?? d.defaultWeightKg,
    reps: last?.reps ?? d.defaultReps,
    sets: last?.sets ?? d.defaultSets,
    rpe: last?.rpe ?? 7,
  };
  openSheet(d.name, `
    ${!focusLog ? `${videoBlock(d)}
    ${d.cue ? `<div class="cue lg">💡 ${esc(d.cue)}</div>` : ''}
    <p class="notes">${esc(d.notes)}</p>` : `${d.cue ? `<div class="cue lg">💡 ${esc(d.cue)}</div>` : ''}`}
    <form class="log-form">
      <div class="grid3">
        ${stepper('weightKg', init.weightKg, weightStep(init.weightKg), { label: '重量', unit: 'kg' })}
        ${stepper('reps', init.reps, 1, { label: '回数', unit: 'reps' })}
        ${stepper('sets', init.sets, 1, { label: 'セット', unit: 'sets', min: 1 })}
      </div>
      <div class="lbl">実施感 RPE</div>
      ${seg('rpe', RPE_OPTS, init.rpe, 'rpe')}
      <input name="note" class="input" placeholder="メモ（感覚・フォームの気づき）">
      <button class="btn primary block lg">記録する</button>
    </form>
    <div class="row gap"><button class="btn ghost grow" data-edit>編集</button><button class="btn ghost grow" data-fav>${d.favorite ? '★ お気に入り解除' : '☆ お気に入り'}</button></div>`,
  (body) => {
    $('.log-form', body).onsubmit = async (e) => {
      e.preventDefault();
      const f = formData(e.target);
      const sore = highSoreParts(store.conditionOn(ctx.date)?.soreness);
      if (sore.length && HIGH_INTENSITY.has(d.categoryId) && (await soreLogGuard(sore, d.name)) !== 'log') return;
      store.insert('workoutLogs', {
        date: ctx.date, drillId: id, weightKg: num(f.weightKg) ?? 0, reps: num(f.reps) ?? 0, sets: num(f.sets) ?? 1, rpe: num(f.rpe) ?? 7, note: f.note.trim(),
      });
      closeSheet(); toast(`✓ ${d.name} を記録`); ctx.refresh();
    };
    $('[data-edit]', body).onclick = () => editDrill(id, ctx);
    $('[data-fav]', body).onclick = () => { store.update('drills', id, { favorite: !d.favorite }); closeSheet(); ctx.refresh(); };
  });
}

const weightStep = (w) => (Number(w) >= 20 ? 2.5 : Number(w) >= 5 ? 1 : 0.5);

function editDrill(id, ctx) {
  const s = store.db();
  const d = id ? store.drillById(id) : { name: '', categoryId: activeCat.startsWith('cat-') ? activeCat : s.categories[0].id, cue: '', notes: '', youtubeUrl: '', youtubeQuery: '', defaultSets: 3, defaultReps: 10, defaultWeightKg: 0 };
  openSheet(id ? 'ドリルを編集' : 'ドリルを追加', `
    <form class="stack">
      <label>種目名<input class="input" name="name" required value="${esc(d.name)}"></label>
      <label>カテゴリ<select class="input" name="categoryId">${s.categories.map((c) => `<option value="${c.id}" ${c.id === d.categoryId ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select></label>
      <label>意識するポイント<input class="input" name="cue" value="${esc(d.cue)}" placeholder="例：胸郭のしなり / 右股関節のタメ"></label>
      <label>メモ<textarea class="input" name="notes" rows="3">${esc(d.notes)}</textarea></label>
      <label>YouTube URL<input class="input" name="youtubeUrl" type="url" value="${esc(d.youtubeUrl)}" placeholder="https://youtu.be/..."></label>
      <label>YouTube検索キーワード<input class="input" name="youtubeQuery" value="${esc(d.youtubeQuery)}"></label>
      <div class="grid3">
        <label>既定kg<input class="input" name="defaultWeightKg" type="number" step="any" value="${d.defaultWeightKg}"></label>
        <label>既定reps<input class="input" name="defaultReps" type="number" value="${d.defaultReps}"></label>
        <label>既定sets<input class="input" name="defaultSets" type="number" value="${d.defaultSets}"></label>
      </div>
      <button class="btn primary block">保存</button>
      ${id ? '<button type="button" class="btn danger block" data-archive>このドリルを非表示にする</button>' : ''}
    </form>`,
  (body) => {
    $('form', body).onsubmit = (e) => {
      e.preventDefault();
      const f = formData(e.target);
      if (f.youtubeUrl && !youtubeId(f.youtubeUrl)) { toast('YouTubeのURLを認識できませんでした'); return; }
      const row = { ...f, name: f.name.trim(), defaultWeightKg: num(f.defaultWeightKg) ?? 0, defaultReps: num(f.defaultReps) ?? 10, defaultSets: num(f.defaultSets) ?? 3 };
      if (id) store.update('drills', id, row); else store.insert('drills', { ...row, favorite: false, archived: false });
      closeSheet(); toast('保存しました'); ctx.refresh();
    };
    $('[data-archive]', body)?.addEventListener('click', () => { store.update('drills', id, { archived: true }); closeSheet(); ctx.refresh(); });
  });
}
