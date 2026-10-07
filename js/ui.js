// Small DOM helpers shared by the views.

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
export const num = (v) => (v === '' || v == null || Number.isNaN(Number(v)) ? null : Number(v));
export const fmt = (n, d = 0) => (n == null || Number.isNaN(n) ? '—' : Number(n).toFixed(d).replace(/\.0+$/, ''));

export function toast(msg) {
  const t = document.createElement('div');
  t.className = 'toast';
  t.textContent = msg;
  document.body.appendChild(t);
  requestAnimationFrame(() => t.classList.add('show'));
  setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 300); }, 1800);
}

/** Bottom sheet modal. `build(el)` receives the sheet body after insertion. */
export function openSheet(title, html, build) {
  closeSheet();
  const wrap = document.createElement('div');
  wrap.className = 'sheet-wrap';
  wrap.innerHTML = `<div class="sheet" role="dialog" aria-modal="true" aria-label="${esc(title)}">
    <div class="sheet-head"><h2>${esc(title)}</h2><button class="icon-btn" data-close aria-label="閉じる">✕</button></div>
    <div class="sheet-body">${html}</div></div>`;
  wrap.addEventListener('click', (e) => { if (e.target === wrap || e.target.closest('[data-close]')) closeSheet(); });
  document.body.appendChild(wrap);
  requestAnimationFrame(() => wrap.classList.add('open'));
  build?.($('.sheet-body', wrap));
  return wrap;
}
export function closeSheet() {
  $$('.sheet-wrap').forEach((w) => w.remove());
}

/**
 * Blocking warning dialog (role="alertdialog"). Resolves with the chosen action's value,
 * or null when dismissed with Esc. Backdrop taps are ignored so the warning is acknowledged.
 * @param {{title:string, lines:string[], actions:{label:string,value:string,primary?:boolean,danger?:boolean}[]}} opts
 */
export function warnDialog({ title, lines, actions }) {
  return new Promise((resolve) => {
    const prevFocus = document.activeElement;
    const wrap = document.createElement('div');
    wrap.className = 'dialog-wrap';
    wrap.innerHTML = `<div class="dialog" role="alertdialog" aria-modal="true" aria-labelledby="dlg-t" aria-describedby="dlg-b">
      <div class="dialog-icon" aria-hidden="true">⚠</div>
      <h2 id="dlg-t">${esc(title)}</h2>
      <div id="dlg-b" class="dialog-body">${lines.map((l) => `<p>${esc(l)}</p>`).join('')}</div>
      <div class="dialog-actions">${actions.map((a, i) =>
        `<button class="btn ${a.primary ? 'primary' : a.danger ? 'danger' : 'ghost'} block" data-i="${i}">${esc(a.label)}</button>`).join('')}</div>
    </div>`;
    const close = (v) => {
      wrap.remove();
      document.removeEventListener('keydown', onKey, true);
      prevFocus?.focus?.();
      resolve(v);
    };
    const onKey = (e) => {
      if (e.key === 'Escape') { e.preventDefault(); close(null); }
      if (e.key === 'Tab') { // keep focus inside the dialog
        const btns = $$('button', wrap);
        const i = btns.indexOf(document.activeElement);
        const next = e.shiftKey ? (i <= 0 ? btns.length - 1 : i - 1) : (i + 1) % btns.length;
        e.preventDefault(); btns[next].focus();
      }
    };
    wrap.addEventListener('click', (e) => {
      const b = e.target.closest('[data-i]');
      if (b) close(actions[Number(b.dataset.i)].value);
    });
    document.addEventListener('keydown', onKey, true);
    document.body.appendChild(wrap);
    navigator.vibrate?.([60, 40, 60]);
    ($('.btn.primary', wrap) || $('button', wrap)).focus();
  });
}

/** Number stepper with big +/- buttons (gloved / sweaty hands friendly). */
export const stepper = (name, value, step = 1, { label = '', unit = '', min = 0 } = {}) => `
  <label class="stepper-field"><span class="lbl">${esc(label)}</span>
    <div class="stepper" data-step="${step}" data-min="${min}">
      <button type="button" class="st-btn" data-dir="-1" aria-label="${esc(label)}を減らす">−</button>
      <input name="${name}" type="number" inputmode="decimal" step="any" value="${value ?? ''}">
      <button type="button" class="st-btn" data-dir="1" aria-label="${esc(label)}を増やす">＋</button>
    </div>${unit ? `<span class="unit">${esc(unit)}</span>` : ''}
  </label>`;

/** Segmented single-choice control backed by radio inputs. */
export const seg = (name, options, value, cls = '') => `
  <div class="seg ${cls}" role="radiogroup">${options.map(([v, l]) => `
    <label class="seg-opt"><input type="radio" name="${name}" value="${esc(v)}" ${String(v) === String(value) ? 'checked' : ''}><span>${esc(l)}</span></label>`).join('')}
  </div>`;

// Global delegated handler for steppers.
document.addEventListener('click', (e) => {
  const b = e.target.closest('.st-btn');
  if (!b) return;
  const box = b.closest('.stepper');
  const input = $('input', box);
  const step = Number(box.dataset.step) || 1;
  const min = Number(box.dataset.min);
  const cur = Number(input.value) || 0;
  const next = Math.max(Number.isFinite(min) ? min : -Infinity, +(cur + step * Number(b.dataset.dir)).toFixed(3));
  input.value = next;
  input.dispatchEvent(new Event('change', { bubbles: true }));
  navigator.vibrate?.(8);
});

export const formData = (form) => Object.fromEntries(new FormData(form).entries());

export const levelInfo = {
  go: { label: 'GO', ja: '良好', cls: 'lv-go' },
  caution: { label: 'CAUTION', ja: '注意', cls: 'lv-caution' },
  rest: { label: 'REST', ja: '休養推奨', cls: 'lv-rest' },
  unknown: { label: '—', ja: '未入力', cls: 'lv-unknown' },
};
