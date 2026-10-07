import * as store from '../db.js';
import { esc, $, $$, seg, toast } from '../ui.js';
import { shareData } from '../derive.js';
import { THEMES, SIZES, renderCard, shareOrDownload } from '../share-canvas.js';

export function render(root, ctx) {
  const st = store.db().shareSettings;
  root.innerHTML = `
  <section class="card share-preview ${st.size}"><canvas id="card"></canvas></section>
  <section class="card stack">
    <div class="eyebrow">テーマ</div>${seg('theme', Object.entries(THEMES).map(([k, t]) => [k, t.label]), st.theme)}
    <div class="eyebrow">サイズ</div>${seg('size', Object.entries(SIZES).map(([k, s]) => [k, s.label]), st.size)}
    <div class="eyebrow">形式</div>${seg('format', [['png', 'PNG'], ['jpeg', 'JPEG']], st.format)}
    <div class="eyebrow">表示項目</div>
    <div class="row gap wrap">
      ${[['workout', 'メニュー'], ['velocity', '球速'], ['condition', 'コンディション']].map(([k, l]) =>
        `<label class="check"><input type="checkbox" name="sec_${k}" ${st.sections[k] ? 'checked' : ''}> ${l}</label>`).join('')}
    </div>
    <label>SNSアカウント名<input class="input" name="handle" value="${esc(st.handle)}" placeholder="@your_id"></label>
  </section>
  <div class="row gap sticky-actions">
    <button class="btn ghost grow" data-dl>⬇ ${st.format === 'jpeg' ? 'JPEG' : 'PNG'}で保存</button>
    <button class="btn primary grow" data-share>↗ シェア</button>
  </div>`;

  const canvas = $('#card', root);
  const draw = async () => {
    await document.fonts?.ready;
    renderCard(canvas, shareData(ctx.date), st);
    $('.share-preview', root).className = `card share-preview ${st.size}`;
  };
  root.addEventListener('change', (e) => {
    const t = e.target;
    if (['theme', 'size', 'format'].includes(t.name)) st[t.name] = t.value;
    else if (t.name?.startsWith('sec_')) st.sections[t.name.slice(4)] = t.checked;
    else if (t.name === 'handle') st.handle = t.value.trim();
    store.persist();
    $('[data-dl]', root).textContent = `⬇ ${st.format === 'jpeg' ? 'JPEG' : 'PNG'}で保存`;
    draw();
  });
  const fname = () => `pitchlab_${ctx.date}_${st.size}`;
  $('[data-dl]', root).onclick = async () => { await shareOrDownload(canvas, st.format, fname(), false); toast(`${st.format.toUpperCase()}画像を保存しました`); };
  $('[data-share]', root).onclick = async () => {
    const r = await shareOrDownload(canvas, st.format, fname(), true);
    if (r === 'downloaded') toast('共有非対応のため画像を保存しました');
  };
  $$('input[name=handle]', root).forEach((i) => i.addEventListener('input', () => { st.handle = i.value.trim(); draw(); }));
  draw();
}
