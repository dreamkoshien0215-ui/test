// Minimal dependency-free Canvas line chart (HiDPI aware).

const css = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

/**
 * @param {HTMLCanvasElement} canvas
 * @param {{date:string,value:number}[]} points
 * @param {{target?:number, unit?:string, color?:string}} opts
 */
export function lineChart(canvas, points, opts = {}) {
  const dpr = window.devicePixelRatio || 1;
  const w = canvas.clientWidth || 320;
  const h = canvas.clientHeight || 180;
  canvas.width = w * dpr;
  canvas.height = h * dpr;
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, w, h);

  const fg = css('--muted') || '#888';
  const grid = css('--line') || '#333';
  const accent = opts.color || css('--accent') || '#22d3ee';
  const warn = css('--warn') || '#f59e0b';
  ctx.font = '11px system-ui, sans-serif';

  if (!points.length) {
    ctx.fillStyle = fg;
    ctx.textAlign = 'center';
    ctx.fillText('データがありません', w / 2, h / 2);
    return;
  }

  const pad = { l: 36, r: 12, t: 14, b: 22 };
  const vals = points.map((p) => p.value);
  if (Number.isFinite(opts.target)) vals.push(opts.target);
  let min = Math.min(...vals);
  let max = Math.max(...vals);
  if (min === max) { min -= 1; max += 1; }
  const span = max - min;
  min -= span * 0.1; max += span * 0.1;

  const t0 = Date.parse(points[0].date);
  const t1 = Date.parse(points[points.length - 1].date);
  const x = (d) => pad.l + (t1 === t0 ? (w - pad.l - pad.r) / 2 : ((Date.parse(d) - t0) / (t1 - t0)) * (w - pad.l - pad.r));
  const y = (v) => pad.t + (1 - (v - min) / (max - min)) * (h - pad.t - pad.b);

  // grid + y labels
  ctx.strokeStyle = grid; ctx.fillStyle = fg; ctx.lineWidth = 1; ctx.textAlign = 'right';
  for (let i = 0; i <= 3; i++) {
    const v = min + ((max - min) * i) / 3;
    const yy = y(v);
    ctx.beginPath(); ctx.moveTo(pad.l, yy); ctx.lineTo(w - pad.r, yy); ctx.stroke();
    ctx.fillText(v.toFixed(span < 10 ? 1 : 0), pad.l - 4, yy + 4);
  }
  // x labels (first / last)
  ctx.textAlign = 'left'; ctx.fillText(points[0].date.slice(5), pad.l, h - 6);
  ctx.textAlign = 'right'; ctx.fillText(points[points.length - 1].date.slice(5), w - pad.r, h - 6);

  // target line
  if (Number.isFinite(opts.target)) {
    ctx.setLineDash([5, 4]); ctx.strokeStyle = warn;
    ctx.beginPath(); ctx.moveTo(pad.l, y(opts.target)); ctx.lineTo(w - pad.r, y(opts.target)); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = warn; ctx.textAlign = 'right';
    ctx.fillText(`目標 ${opts.target}${opts.unit || ''}`, w - pad.r, y(opts.target) - 4);
  }

  // area + line
  const grad = ctx.createLinearGradient(0, pad.t, 0, h - pad.b);
  grad.addColorStop(0, accent + '55'); grad.addColorStop(1, accent + '00');
  ctx.beginPath();
  points.forEach((p, i) => (i ? ctx.lineTo(x(p.date), y(p.value)) : ctx.moveTo(x(p.date), y(p.value))));
  ctx.lineTo(x(points[points.length - 1].date), h - pad.b);
  ctx.lineTo(x(points[0].date), h - pad.b);
  ctx.closePath(); ctx.fillStyle = grad; ctx.fill();

  ctx.beginPath(); ctx.strokeStyle = accent; ctx.lineWidth = 2.5; ctx.lineJoin = 'round';
  points.forEach((p, i) => (i ? ctx.lineTo(x(p.date), y(p.value)) : ctx.moveTo(x(p.date), y(p.value))));
  ctx.stroke();

  ctx.fillStyle = accent;
  for (const p of points) { ctx.beginPath(); ctx.arc(x(p.date), y(p.value), 3, 0, Math.PI * 2); ctx.fill(); }

  // latest value label
  const last = points[points.length - 1];
  ctx.fillStyle = css('--fg') || '#fff'; ctx.font = 'bold 12px system-ui, sans-serif'; ctx.textAlign = 'right';
  ctx.fillText(`${last.value}${opts.unit || ''}`, Math.min(x(last.date), w - pad.r), y(last.value) - 8);
}
