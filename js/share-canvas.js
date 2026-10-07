// SNS card renderer: draws today's summary directly with the Canvas 2D API
// (no html2canvas dependency → deterministic output, works offline).

export const THEMES = {
  sporty: {
    label: 'スポーティー・ダーク',
    bg: ['#0b0f17', '#151c2c'], fg: '#f8fafc', muted: '#94a3b8', accent: '#22d3ee', accent2: '#3b82f6',
    card: 'rgba(255,255,255,0.06)', stripe: true,
  },
  neon: {
    label: 'ネオン・アスリート',
    bg: ['#0a0014', '#1a0033'], fg: '#ffffff', muted: '#c4b5fd', accent: '#39ff14', accent2: '#ff2bd6',
    card: 'rgba(255,43,214,0.10)', glow: true,
  },
  minimal: {
    label: 'シンプル＆ミニマル',
    bg: ['#fafaf9', '#f5f5f4'], fg: '#111827', muted: '#6b7280', accent: '#111827', accent2: '#dc2626',
    card: '#ffffff', border: '#e5e7eb',
  },
};

export const SIZES = {
  feed: { label: 'フィード 1080×1080', w: 1080, h: 1080 },
  story: { label: 'ストーリーズ 1080×1920', w: 1080, h: 1920 },
};

const FONT = '"Hiragino Sans","Noto Sans JP","Yu Gothic",system-ui,sans-serif';
const LEVEL_TXT = { go: ['GO', '良好'], caution: ['CAUTION', '注意'], rest: ['REST', '休養推奨'], unknown: ['—', '未入力'] };

/**
 * @param {HTMLCanvasElement} canvas
 * @param {object} data  { date, handle, workouts:[{name,detail}], velocity:{today,best,target,pct}, readiness:{level,score}, soreness:[{label,value}] }
 * @param {{theme:string,size:string,sections:object}} settings
 */
export function renderCard(canvas, data, settings) {
  const th = THEMES[settings.theme] || THEMES.sporty;
  const sz = SIZES[settings.size] || SIZES.feed;
  canvas.width = sz.w; canvas.height = sz.h;
  const ctx = canvas.getContext('2d');
  const W = sz.w; const H = sz.h; const P = 72;
  const story = settings.size === 'story';

  // background
  const g = ctx.createLinearGradient(0, 0, W, H);
  g.addColorStop(0, th.bg[0]); g.addColorStop(1, th.bg[1]);
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  if (th.stripe) {
    ctx.save(); ctx.globalAlpha = 0.07; ctx.fillStyle = th.accent;
    for (let i = -H; i < W; i += 90) { ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i + 40, 0); ctx.lineTo(i + 40 + H, H); ctx.lineTo(i + H, H); ctx.fill(); }
    ctx.restore();
  }
  if (th.glow) {
    const rg = ctx.createRadialGradient(W * 0.85, H * 0.1, 0, W * 0.85, H * 0.1, W * 0.7);
    rg.addColorStop(0, th.accent2 + '55'); rg.addColorStop(1, th.accent2 + '00');
    ctx.fillStyle = rg; ctx.fillRect(0, 0, W, H);
  }

  // header
  let y = story ? 170 : P + 10;
  ctx.fillStyle = th.accent; ctx.font = `800 30px ${FONT}`; ctx.textBaseline = 'alphabetic';
  ctx.fillText('ROAD TO 145', P, y);
  ctx.fillStyle = th.muted; ctx.font = `500 28px ${FONT}`; ctx.textAlign = 'right';
  ctx.fillText(data.date.replaceAll('-', '.'), W - P, y);
  ctx.textAlign = 'left';
  y += 70;
  ctx.fillStyle = th.fg; ctx.font = `900 ${story ? 84 : 64}px ${FONT}`;
  ctx.fillText('TODAY’S WORK', P, y);
  y += story ? 60 : 40;

  const s = settings.sections || {};
  const gap = 28;
  const bottom = H - (story ? 260 : 116); // panels end here; footer sits below
  const fixedH = story ? 300 : 260;

  // Top: velocity + condition (side by side on feed, stacked on story)
  const top = [s.velocity && 'velocity', s.condition && 'condition'].filter(Boolean);
  const rows = top.length ? (story ? top.map((b) => [b]) : [top]) : [];
  for (const row of rows) {
    const cw = (W - P * 2 - gap * (row.length - 1)) / row.length;
    row.forEach((b, i) => {
      const x = P + i * (cw + gap);
      panel(ctx, th, x, y, cw, fixedH);
      if (b === 'velocity') drawVelocity(ctx, th, data.velocity, x, y, cw, fixedH);
      else drawCondition(ctx, th, data, x, y, cw, fixedH);
    });
    y += fixedH + gap;
  }

  // Bottom: menu sized to its content; leftover space goes to a velocity trend graph.
  const remaining = bottom - y;
  const series = (data.velocity.series || []).filter((p) => p.date <= data.date).slice(-12);
  const canTrend = s.velocity && series.length >= 2;
  const fullW = W - P * 2;
  if (s.workout) {
    const need = Math.max(200, workoutHeight(data.workouts.length, story));
    const split = canTrend && remaining - need - gap >= 170;
    const wh = split ? need : remaining;
    panel(ctx, th, P, y, fullW, wh);
    drawWorkout(ctx, th, data.workouts, P, y, fullW, wh, story);
    y += wh + gap;
    if (split) { panel(ctx, th, P, y, fullW, bottom - y); drawTrend(ctx, th, series, data.velocity.target, P, y, fullW, bottom - y); }
  } else if (canTrend && remaining >= 170) {
    panel(ctx, th, P, y, fullW, remaining);
    drawTrend(ctx, th, series, data.velocity.target, P, y, fullW, remaining);
  }

  // footer
  const fy = H - (story ? 170 : 56);
  ctx.fillStyle = th.muted; ctx.font = `500 26px ${FONT}`;
  ctx.fillText(data.handle ? `@${data.handle.replace(/^@/, '')}` : '#球速アップ #ピッチャー', P, fy);
  ctx.textAlign = 'right'; ctx.fillStyle = th.accent; ctx.font = `800 26px ${FONT}`;
  ctx.fillText('PITCH LAB', W - P, fy);
  ctx.textAlign = 'left';
}

const lineHeight = (story) => (story ? 76 : 60);
const workoutHeight = (n, story) => 92 + Math.max(1, n) * lineHeight(story);

function panel(ctx, th, x, y, w, h) {
  ctx.save();
  roundRect(ctx, x, y, w, h, 28);
  ctx.fillStyle = th.card; ctx.fill();
  if (th.border) { ctx.strokeStyle = th.border; ctx.lineWidth = 2; ctx.stroke(); }
  if (th.glow) { ctx.strokeStyle = th.accent2 + '88'; ctx.lineWidth = 2; ctx.shadowColor = th.accent2; ctx.shadowBlur = 20; ctx.stroke(); }
  ctx.restore();
}

function label(ctx, th, text, x, y) {
  ctx.fillStyle = th.muted; ctx.font = `700 24px ${FONT}`;
  ctx.fillText(text, x, y);
}

function drawVelocity(ctx, th, v, x, y, w, h) {
  const ix = x + 36;
  label(ctx, th, 'VELOCITY', ix, y + 56);
  const val = v.today ?? v.best;
  const fs = Math.round(Math.min(120, w * 0.2));
  ctx.fillStyle = th.fg; ctx.font = `900 ${fs}px ${FONT}`;
  const txt = val != null ? String(val) : '—';
  const base = y + 72 + fs * 0.8;
  ctx.fillText(txt, ix, base);
  const tw = ctx.measureText(txt).width;
  ctx.fillStyle = th.accent; ctx.font = `800 32px ${FONT}`;
  ctx.fillText('km/h', ix + tw + 12, base);
  ctx.fillStyle = th.muted; ctx.font = `500 24px ${FONT}`;
  const sub = v.today != null ? `本日最速 · PB ${v.best ?? '—'}` : '自己ベスト';
  ctx.fillText(sub, ix, y + h - 56);
  ctx.fillStyle = th.fg; ctx.font = `700 24px ${FONT}`; ctx.textAlign = 'right';
  ctx.fillText(`${v.target}まで ${v.pct}%`, x + w - 36, y + h - 56);
  ctx.textAlign = 'left';
  // progress bar
  const bw = w - 72; const by = y + h - 40;
  roundRect(ctx, ix, by, bw, 14, 7); ctx.fillStyle = th.muted + '44'; ctx.fill();
  roundRect(ctx, ix, by, Math.max(14, bw * (v.pct / 100)), 14, 7); ctx.fillStyle = th.accent; ctx.fill();
}

function drawCondition(ctx, th, data, x, y, w, h) {
  const ix = x + 36;
  const r = data.readiness;
  label(ctx, th, 'CONDITION', ix, y + 56);
  const color = { go: '#22c55e', caution: '#f59e0b', rest: '#ef4444' }[r.level] || th.muted;
  const [en, ja] = LEVEL_TXT[r.level] || LEVEL_TXT.unknown;
  ctx.fillStyle = color; ctx.font = `900 ${Math.min(64, w * 0.13)}px ${FONT}`;
  ctx.fillText(en, ix, y + 122);
  ctx.fillStyle = th.fg; ctx.font = `700 26px ${FONT}`;
  ctx.fillText(`${ja}${r.score != null ? ` · Readiness ${r.score}` : ''}`, ix, y + 158);
  // Throwing-arm status: shoulder / elbow
  const items = (data.soreness || []).slice(0, 2);
  const cw = (w - 72) / Math.max(1, items.length);
  items.forEach((it, i) => {
    const cx = ix + i * cw;
    const c = it.value >= 4 ? '#ef4444' : it.value === 3 ? '#f59e0b' : th.accent;
    ctx.fillStyle = th.fg; ctx.font = `800 28px ${FONT}`;
    ctx.fillText(it.label, cx, y + h - 52);
    ctx.fillStyle = c; ctx.font = `800 24px ${FONT}`;
    ctx.fillText(data.hasCondition ? `${it.value}/5` : '—', cx + ctx.measureText(it.label).width + 40, y + h - 52);
    for (let k = 1; k <= 5; k++) {
      ctx.beginPath(); ctx.arc(cx + (k - 1) * 26 + 9, y + h - 28, 9, 0, Math.PI * 2);
      ctx.fillStyle = data.hasCondition && k <= it.value ? c : th.muted + '44';
      ctx.fill();
    }
  });
}

function drawTrend(ctx, th, series, target, x, y, w, h) {
  const ix = x + 36;
  label(ctx, th, 'VELOCITY TREND', ix, y + 56);
  // Short panels (feed card) put the date range on the title row to give the line more room.
  const compact = h < 260;
  const range = `${series[0].date.slice(5).replace('-', '/')} → ${series.at(-1).date.slice(5).replace('-', '/')}`;
  if (compact) { ctx.fillStyle = th.muted; ctx.font = `600 20px ${FONT}`; ctx.fillText(range, ix + ctx.measureText('VELOCITY TREND').width * 1.2 + 24, y + 56); }
  const pad = { l: ix, r: x + w - 36, t: y + (compact ? 96 : 90), b: y + h - (compact ? 28 : 44) };
  const vals = series.map((p) => p.value).concat(target);
  let min = Math.min(...vals) - 2; const max = Math.max(...vals) + 1;
  if (max - min < 6) min = max - 6;
  const px = (i) => pad.l + (i / (series.length - 1)) * (pad.r - pad.l);
  const py = (v) => pad.b - ((v - min) / (max - min)) * (pad.b - pad.t);
  // target line
  ctx.save(); ctx.setLineDash([10, 8]); ctx.strokeStyle = th.accent2; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(pad.l, py(target)); ctx.lineTo(pad.r, py(target)); ctx.stroke(); ctx.restore();
  ctx.fillStyle = th.accent2; ctx.font = `800 22px ${FONT}`; ctx.textAlign = 'right';
  ctx.fillText(`TARGET ${target}`, pad.r, py(target) - 10); ctx.textAlign = 'left';
  // area + line
  const grad = ctx.createLinearGradient(0, pad.t, 0, pad.b);
  grad.addColorStop(0, th.accent + '66'); grad.addColorStop(1, th.accent + '00');
  ctx.beginPath(); series.forEach((p, i) => (i ? ctx.lineTo(px(i), py(p.value)) : ctx.moveTo(px(i), py(p.value))));
  ctx.lineTo(px(series.length - 1), pad.b); ctx.lineTo(px(0), pad.b); ctx.closePath(); ctx.fillStyle = grad; ctx.fill();
  ctx.beginPath(); series.forEach((p, i) => (i ? ctx.lineTo(px(i), py(p.value)) : ctx.moveTo(px(i), py(p.value))));
  ctx.strokeStyle = th.accent; ctx.lineWidth = 5; ctx.lineJoin = 'round'; ctx.stroke();
  series.forEach((p, i) => { ctx.beginPath(); ctx.arc(px(i), py(p.value), 7, 0, Math.PI * 2); ctx.fillStyle = th.accent; ctx.fill(); });
  if (compact) return;
  // axis dates
  ctx.fillStyle = th.muted; ctx.font = `600 20px ${FONT}`;
  ctx.fillText(series[0].date.slice(5).replace('-', '/'), pad.l, y + h - 16);
  ctx.textAlign = 'right'; ctx.fillText(series.at(-1).date.slice(5).replace('-', '/'), pad.r, y + h - 16); ctx.textAlign = 'left';
}

function drawWorkout(ctx, th, workouts, x, y, w, h, story) {
  const ix = x + 36;
  label(ctx, th, 'TRAINING MENU', ix, y + 56);
  const base = lineHeight(story);
  const maxLines = Math.max(1, Math.floor((h - 92) / base));
  // Spread a short list over the panel instead of leaving a block of empty space.
  const n = Math.max(1, workouts.length);
  const lineH = n <= maxLines ? Math.min(base * 1.5, Math.max(base, (h - 92) / n)) : base;
  const list = workouts.length ? workouts : [{ name: '本日の記録なし', detail: '' }];
  const shown = list.slice(0, list.length > maxLines ? maxLines - 1 : maxLines);
  shown.forEach((wk, i) => {
    const ly = y + 110 + i * lineH;
    ctx.fillStyle = th.accent; ctx.beginPath(); ctx.arc(ix + 8, ly - 10, 7, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = th.fg; ctx.font = `700 ${story ? 34 : 30}px ${FONT}`;
    const detailW = wk.detail ? (ctx.font = `600 26px ${FONT}`, ctx.measureText(wk.detail).width) : 0;
    ctx.font = `700 ${story ? 34 : 30}px ${FONT}`;
    ctx.fillText(fit(ctx, wk.name, w - 72 - 36 - detailW - 24), ix + 32, ly);
    if (wk.detail) {
      ctx.fillStyle = th.muted; ctx.font = `600 26px ${FONT}`; ctx.textAlign = 'right';
      ctx.fillText(wk.detail, x + w - 36, ly); ctx.textAlign = 'left';
    }
  });
  if (list.length > shown.length) {
    ctx.fillStyle = th.muted; ctx.font = `600 24px ${FONT}`;
    ctx.fillText(`ほか ${list.length - shown.length} 種目`, ix + 32, y + 110 + shown.length * lineH);
  }
}

function fit(ctx, text, maxW) {
  if (ctx.measureText(text).width <= maxW) return text;
  let t = text;
  while (t.length > 1 && ctx.measureText(t + '…').width > maxW) t = t.slice(0, -1);
  return t + '…';
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** Export canvas → Blob, then share via Web Share API (mobile) or fall back to download. */
export async function exportCard(canvas, format = 'png', filename = 'pitchlab') {
  const mime = format === 'jpeg' ? 'image/jpeg' : 'image/png';
  const blob = await new Promise((res) => canvas.toBlob(res, mime, 0.92));
  const file = new File([blob], `${filename}.${format === 'jpeg' ? 'jpg' : 'png'}`, { type: mime });
  return { blob, file };
}

export async function shareOrDownload(canvas, format, filename, preferShare = true) {
  const { blob, file } = await exportCard(canvas, format, filename);
  if (preferShare && navigator.canShare?.({ files: [file] })) {
    try { await navigator.share({ files: [file], title: 'Road to 145' }); return 'shared'; }
    catch (e) { if (e.name === 'AbortError') return 'cancelled'; }
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = file.name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  return 'downloaded';
}
