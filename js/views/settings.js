import * as store from '../db.js';
import { esc, $, $$, num, seg, toast, formData } from '../ui.js';
import { channelHandle, channelUrl } from '../logic.js';

export function render(root, ctx) {
  const p = store.db().profile;
  root.innerHTML = `
  <section class="card">
    <div class="eyebrow">プロフィール</div>
    <form id="profile" class="stack">
      <label>名前<input class="input" name="name" value="${esc(p.name)}"></label>
      <div class="lbl">投球腕</div>${seg('throwingArm', [['R', '右投げ'], ['L', '左投げ']], p.throwingArm)}
      <div class="lbl">性別（代謝計算用）</div>${seg('sex', [['M', '男性'], ['F', '女性']], p.sex)}
      <div class="grid3">
        <label>身長 cm<input class="input" name="heightCm" type="number" step="any" value="${p.heightCm}"></label>
        <label>体重 kg<input class="input" name="weightKg" type="number" step="any" value="${p.weightKg}"></label>
        <label>年齢<input class="input" name="age" type="number" value="${p.age}"></label>
      </div>
      <button class="btn primary block">保存</button>
    </form>
  </section>
  <section class="card stack">
    <div class="eyebrow">参考YouTubeチャンネル</div>
    <p class="muted small" style="margin:0">ドリル詳細の「▶ @チャンネル で探す」から、そのチャンネル内を種目キーワードで検索できます。</p>
    <ul class="list compact">${store.db().refChannels.map((c) => `<li><a class="grow link" href="${esc(channelUrl(c.handle))}" target="_blank" rel="noopener">@${esc(c.handle)}</a>
      <button class="icon-btn" data-del-ch="${esc(c.id)}" aria-label="削除">🗑</button></li>`).join('') || '<li class="muted small">未登録</li>'}</ul>
    <form id="ch-form" class="row gap"><input class="input grow" name="ch" placeholder="チャンネルURL または @ハンドル" required><button class="btn primary">追加</button></form>
  </section>
  <section class="card stack">
    <div class="eyebrow">データ管理（端末内にのみ保存されています）</div>
    <button class="btn ghost block" data-export>⬇ バックアップをエクスポート (JSON)</button>
    <label class="btn ghost block">⬆ バックアップから復元<input type="file" accept="application/json" hidden data-import></label>
    <button class="btn danger block" data-reset>全データを初期化</button>
  </section>
  <p class="muted small center">PITCH LAB · 本アプリの警告は目安です。痛みが続く場合は医療機関を受診してください。</p>`;

  $('#profile', root).onsubmit = (e) => {
    e.preventDefault();
    const f = formData(e.target);
    Object.assign(p, { name: f.name.trim(), throwingArm: f.throwingArm, sex: f.sex, heightCm: num(f.heightCm), weightKg: num(f.weightKg), age: num(f.age) });
    store.persist(); toast('保存しました'); ctx.refresh();
  };
  $('#ch-form', root).onsubmit = (e) => {
    e.preventDefault();
    const handle = channelHandle(formData(e.target).ch);
    if (!handle) { toast('「youtube.com/@○○」形式のURLを入力してください'); return; }
    const list = store.db().refChannels;
    if (list.some((c) => c.handle.toLowerCase() === handle.toLowerCase())) { toast('登録済みです'); return; }
    list.push({ id: store.uid('ch'), handle, name: handle });
    store.persist(); toast(`@${handle} を追加しました`); ctx.refresh();
  };
  $$('[data-del-ch]', root).forEach((b) => b.onclick = () => {
    store.db().refChannels = store.db().refChannels.filter((c) => c.id !== b.dataset.delCh);
    store.persist(); ctx.refresh();
  });
  $('[data-export]', root).onclick = () => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([store.exportJson()], { type: 'application/json' }));
    a.download = `pitchlab-backup-${ctx.date}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  };
  $('[data-import]', root).onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      store.importJson(await file.text());
      toast('復元しました'); ctx.refresh();
    } catch (err) { toast(`復元失敗：${err.message}`); }
  };
  $('[data-reset]', root).onclick = () => {
    if (confirm('全ての記録を削除して初期状態に戻します。よろしいですか？')) { store.resetAll(); toast('初期化しました'); ctx.refresh(); }
  };
}
