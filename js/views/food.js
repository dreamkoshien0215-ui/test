import * as store from '../db.js';
import { esc, $, $$, num, seg, openSheet, closeSheet, toast, formData, fmt } from '../ui.js';
import { nutritionView } from '../derive.js';
import { NUTRITION_GOALS, ACTIVITY } from '../logic.js';
import { macroBars } from './home.js';

const MEALS = [['breakfast', '朝'], ['lunch', '昼'], ['dinner', '夕'], ['snack', '間食']];
let meal = defaultMeal();

function defaultMeal() {
  const h = new Date().getHours();
  return h < 10 ? 'breakfast' : h < 15 ? 'lunch' : h < 21 ? 'dinner' : 'snack';
}

export function render(root, ctx) {
  const s = store.db();
  const n = nutritionView(ctx.date);
  const foods = [...s.foods].sort((a, b) => (b.useCount || 0) - (a.useCount || 0) || a.name.localeCompare(b.name));

  root.innerHTML = `
  <section class="card">
    <div class="eyebrow">目的</div>
    ${seg('goal', Object.entries(NUTRITION_GOALS).map(([k, g]) => [k, g.label]), s.profile.nutritionGoal)}
    <div class="eyebrow mt">活動量</div>
    ${seg('activity', Object.entries(ACTIVITY).map(([k, a]) => [k, a.label.split('（')[0]]), s.profile.activity)}
    ${n.targets ? `<p class="muted small mt">基礎代謝 ${n.targets.bmr}kcal × ${ACTIVITY[s.profile.activity].factor} ＋ 目的補正 → <b>${n.targets.kcal}kcal</b>（P ${n.targets.p}g / F ${n.targets.f}g / C ${n.targets.c}g）</p>` : ''}
  </section>

  <section class="card">${n.targets ? macroBars(n) : '<p class="muted">設定でプロフィール（身長・体重・年齢）を入力してください。</p>'}</section>

  <section class="card">
    <div class="row between"><div class="eyebrow">ワンタップ追加</div>${seg('meal', MEALS, meal, 'mini')}</div>
    <div class="food-chips">
      ${foods.map((f) => `<button class="food-chip" data-add="${f.id}"><b>${esc(f.name)}</b><span>${fmt(f.kcal)}kcal · P${fmt(f.p, 1)}</span></button>`).join('')}
    </div>
    <div class="row gap"><button class="btn ghost grow" data-new-food>＋ 食品を登録</button><button class="btn ghost grow" data-manual>手入力</button></div>
  </section>

  <section class="card"><div class="eyebrow">本日の食事</div>
    ${MEALS.map(([k, l]) => {
      const items = n.meals.filter((m) => m.meal === k);
      if (!items.length) return '';
      return `<div class="meal-group"><div class="small muted">${l}</div><ul class="list compact">${items.map((m) => `
        <li><div class="grow">${esc(m.name)}${m.qty !== 1 ? ` ×${m.qty}` : ''}</div><span class="muted small">${fmt(m.kcal * m.qty)}kcal</span>
        <button class="icon-btn" data-qty="${m.id}" aria-label="数量を増やす">＋</button><button class="icon-btn" data-del="${m.id}" aria-label="削除">🗑</button></li>`).join('')}</ul></div>`;
    }).join('') || '<p class="muted small">まだ記録がありません。</p>'}
  </section>`;

  const setProfile = (patch) => { Object.assign(s.profile, patch); store.persist(); ctx.refresh(); };
  $$('input[name=goal]', root).forEach((i) => i.onchange = () => setProfile({ nutritionGoal: i.value }));
  $$('input[name=activity]', root).forEach((i) => i.onchange = () => setProfile({ activity: i.value }));
  $$('input[name=meal]', root).forEach((i) => i.onchange = () => { meal = i.value; });
  $$('[data-add]', root).forEach((b) => b.onclick = () => {
    const f = s.foods.find((x) => x.id === b.dataset.add);
    store.insert('mealLogs', { date: ctx.date, meal, foodId: f.id, name: f.name, kcal: f.kcal, p: f.p, f: f.f, c: f.c, qty: 1 });
    f.useCount = (f.useCount || 0) + 1; store.persist();
    toast(`＋ ${f.name}`); ctx.refresh();
  });
  $$('[data-del]', root).forEach((b) => b.onclick = () => { store.remove('mealLogs', b.dataset.del); ctx.refresh(); });
  $$('[data-qty]', root).forEach((b) => b.onclick = () => {
    const m = s.mealLogs.find((x) => x.id === b.dataset.qty);
    store.update('mealLogs', m.id, { qty: +(m.qty + 0.5).toFixed(1) }); ctx.refresh();
  });
  $('[data-new-food]', root).onclick = () => foodForm(ctx, true);
  $('[data-manual]', root).onclick = () => foodForm(ctx, false);
}

function foodForm(ctx, register) {
  openSheet(register ? '食品を登録' : '手入力で追加', `
    <form class="stack">
      <label>食品名<input class="input" name="name" required placeholder="例：牛丼 並"></label>
      <div class="grid4">
        <label>kcal<input class="input" name="kcal" type="number" step="any" required></label>
        <label>P(g)<input class="input" name="p" type="number" step="any" value="0"></label>
        <label>F(g)<input class="input" name="f" type="number" step="any" value="0"></label>
        <label>C(g)<input class="input" name="c" type="number" step="any" value="0"></label>
      </div>
      ${register ? '<label class="check"><input type="checkbox" name="addNow" checked> 今の食事にも追加する</label>' : '<label class="check"><input type="checkbox" name="save"> よく食べる食品として登録</label>'}
      <button class="btn primary block">保存</button>
    </form>`, (body) => {
    $('form', body).onsubmit = (e) => {
      e.preventDefault();
      const f = formData(e.target);
      const food = { name: f.name.trim(), kcal: num(f.kcal) ?? 0, p: num(f.p) ?? 0, f: num(f.f) ?? 0, c: num(f.c) ?? 0 };
      let saved = null;
      if (register || f.save) saved = store.insert('foods', { ...food, favorite: true, useCount: 1 });
      if (!register || f.addNow) store.insert('mealLogs', { date: ctx.date, meal, foodId: saved?.id ?? null, ...food, qty: 1 });
      closeSheet(); toast('保存しました'); ctx.refresh();
    };
  });
}
