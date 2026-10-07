// Pure domain logic (no DOM / storage). Unit-tested in tests/logic.test.mjs.

export const SORE_PARTS = [
  { key: 'shoulder', label: '肩', critical: true },
  { key: 'elbow', label: '肘', critical: true },
  { key: 'lowBack', label: '腰', critical: false },
  { key: 'hip', label: '股関節', critical: false },
  { key: 'forearm', label: '前腕', critical: false },
  { key: 'knee', label: '膝', critical: false },
];

// ROM self-check items. side-specific values in degrees.
export const ROM_ITEMS = [
  { key: 'thoracicRot', label: '胸郭回旋', unit: '°', ref: 45 },
  { key: 'hipIR', label: '股関節 内旋', unit: '°', ref: 35 },
  { key: 'hipER', label: '股関節 外旋', unit: '°', ref: 45 },
  { key: 'shoulderER', label: '肩 外旋(90°外転)', unit: '°', ref: 110 },
  { key: 'shoulderIR', label: '肩 内旋(90°外転)', unit: '°', ref: 50 },
];

export const todayStr = (d = new Date()) => {
  const z = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`;
};

export const addDays = (dateStr, n) => {
  const [y, m, d] = dateStr.split('-').map(Number);
  return todayStr(new Date(y, m - 1, d + n));
};

export const daysBetween = (a, b) => {
  const pa = a.split('-').map(Number);
  const pb = b.split('-').map(Number);
  return Math.round((Date.UTC(pb[0], pb[1] - 1, pb[2]) - Date.UTC(pa[0], pa[1] - 1, pa[2])) / 86400000);
};

/** Session load = RPE × total sets (simplified sRPE proxy). */
export const workoutLoad = (log) => (Number(log.rpe) || 0) * (Number(log.sets) || 0);

/**
 * Acute:Chronic workload ratio. acute = last 7 days, chronic = weekly avg over last 28 days.
 * Returns null when there is less than 3 weeks of history.
 */
export function acwr(workoutLogs, date) {
  let acute = 0;
  let chronic = 0;
  let oldest = 0;
  for (const l of workoutLogs) {
    const age = daysBetween(l.date, date);
    if (age < 0 || age >= 28) continue;
    const load = workoutLoad(l);
    oldest = Math.max(oldest, age);
    chronic += load;
    if (age < 7) acute += load;
  }
  // Need ~3 weeks of history before the ratio means anything (avoids day-1 false alarms).
  const weekly = chronic / 4;
  return oldest >= 21 && weekly > 0 ? acute / weekly : null;
}

/** Throwing-side shoulder checks (GIRD / total-arc deficit) using left/right ROM values. */
export function shoulderRomFlags(rom, throwingArm = 'R') {
  if (!rom) return [];
  const t = throwingArm === 'L' ? 'L' : 'R';
  const n = t === 'R' ? 'L' : 'R';
  const ir = rom.shoulderIR || {};
  const er = rom.shoulderER || {};
  const flags = [];
  if (isNum(ir[t]) && isNum(ir[n])) {
    const irDeficit = ir[n] - ir[t];
    if (irDeficit >= 20) flags.push({ level: 'warn', msg: `投球側の肩内旋が非投球側より${irDeficit}°低下（GIRD傾向）。スリーパーストレッチ等で回復を。` });
    if (isNum(er[t]) && isNum(er[n])) {
      const arcDiff = (er[n] + ir[n]) - (er[t] + ir[t]);
      if (arcDiff > 5) flags.push({ level: 'caution', msg: `肩の総回旋可動域が非投球側より${arcDiff}°少ない。投球量を調整。` });
    }
  }
  return flags;
}

const isNum = (v) => typeof v === 'number' && !Number.isNaN(v);

/**
 * Readiness assessment for a given date.
 * level: 'go' | 'caution' | 'rest'
 */
export function assessReadiness({ condition, workoutLogs = [], date, throwingArm = 'R' }) {
  const reasons = [];
  let level = 'go';
  const bump = (l) => {
    const order = { go: 0, caution: 1, rest: 2 };
    if (order[l] > order[level]) level = l;
  };

  if (!condition) {
    return { level: 'unknown', score: null, reasons: [{ level: 'info', msg: '今日のコンディションが未入力です。' }] };
  }

  const s = condition.soreness || {};
  for (const p of SORE_PARTS) {
    const v = Number(s[p.key]) || 1;
    if (p.critical && v >= 4) { bump('rest'); reasons.push({ level: 'rest', msg: `${p.label}の違和感 ${v}/5：投球・高強度種目は中止し、レスト＆専門家へ相談を。` }); }
    else if (v >= 4) { bump('rest'); reasons.push({ level: 'rest', msg: `${p.label}の違和感 ${v}/5：該当部位に負荷のかかる種目は中止。` }); }
    else if (p.critical && v === 3) { bump('caution'); reasons.push({ level: 'caution', msg: `${p.label}に違和感 3/5：全力投球は避け、ケア種目中心に。` }); }
    else if (v === 3) { bump('caution'); reasons.push({ level: 'caution', msg: `${p.label}に違和感 3/5：強度を落として実施。` }); }
  }

  const fatigue = Number(condition.fatigue) || 1;
  if (fatigue >= 5) { bump('rest'); reasons.push({ level: 'rest', msg: '全身疲労 5/5：積極的休養日を推奨。' }); }
  else if (fatigue === 4) { bump('caution'); reasons.push({ level: 'caution', msg: '全身疲労 4/5：ボリュームを30〜50%カット。' }); }

  const sleep = Number(condition.sleepHours);
  if (isNum(sleep) && sleep > 0 && sleep < 6) { bump('caution'); reasons.push({ level: 'caution', msg: `睡眠 ${sleep}h：出力系・最大努力はリスク増。` }); }

  for (const f of shoulderRomFlags(condition.rom, throwingArm)) { bump(f.level === 'warn' ? 'caution' : f.level); reasons.push(f); }

  const ratio = acwr(workoutLogs, date);
  if (ratio !== null && ratio > 1.5) { bump('caution'); reasons.push({ level: 'caution', msg: `急性/慢性負荷比 ${ratio.toFixed(2)}：急な負荷増。今週は量を抑えて。` }); }

  // 0-100 readiness score
  const soreSum = SORE_PARTS.reduce((a, p) => a + ((Number(s[p.key]) || 1) - 1), 0);
  let score = 100 - soreSum * 6 - (fatigue - 1) * 8;
  if (isNum(sleep) && sleep > 0) score -= Math.max(0, 7.5 - sleep) * 6;
  if (ratio !== null && ratio > 1.3) score -= Math.min(25, (ratio - 1.3) * 30);
  score = Math.round(Math.max(0, Math.min(100, score)));
  if (level === 'rest') score = Math.min(score, 39);
  else if (level === 'caution') score = Math.min(score, 69);

  if (!reasons.length) reasons.push({ level: 'go', msg: 'コンディション良好。予定通りのメニューでOK。' });
  return { level, score, reasons, acwr: ratio };
}

export const ACTIVITY = {
  low: { label: '軽め（オフ・リカバリー期）', factor: 1.5 },
  mid: { label: '通常（練習＋トレ）', factor: 1.75 },
  high: { label: '高負荷（二部練・試合期）', factor: 1.95 },
};

export const NUTRITION_GOALS = {
  maintain: { label: '体重維持', kcalAdj: 0, proteinPerKg: 1.8 },
  recover: { label: '回復重視', kcalAdj: 150, proteinPerKg: 2.0 },
  power: { label: '出力向上（除脂肪↑）', kcalAdj: 350, proteinPerKg: 2.2 },
};

/** Mifflin-St Jeor BMR → TDEE → goal adjusted PFC targets. */
export function calcNutritionTargets({ weightKg, heightCm, age, sex = 'M', activity = 'mid', goal = 'maintain' }) {
  const w = Number(weightKg); const h = Number(heightCm); const a = Number(age);
  if (!(w > 0 && h > 0 && a > 0)) return null;
  const bmr = 10 * w + 6.25 * h - 5 * a + (sex === 'F' ? -161 : 5);
  const act = ACTIVITY[activity] || ACTIVITY.mid;
  const g = NUTRITION_GOALS[goal] || NUTRITION_GOALS.maintain;
  const kcal = Math.round(bmr * act.factor + g.kcalAdj);
  const p = Math.round(w * g.proteinPerKg);
  const f = Math.round((kcal * 0.25) / 9);
  const c = Math.max(0, Math.round((kcal - p * 4 - f * 9) / 4));
  return { bmr: Math.round(bmr), kcal, p, f, c };
}

export function sumMeals(meals) {
  return meals.reduce((t, m) => {
    const q = Number(m.qty) || 1;
    t.kcal += (Number(m.kcal) || 0) * q;
    t.p += (Number(m.p) || 0) * q;
    t.f += (Number(m.f) || 0) * q;
    t.c += (Number(m.c) || 0) * q;
    return t;
  }, { kcal: 0, p: 0, f: 0, c: 0 });
}

/** Progress (%) from start to target value. Works for decreasing targets too. */
export function progressPct(start, current, target) {
  const s = Number(start); const c = Number(current); const t = Number(target);
  if (![s, c, t].every(Number.isFinite) || t === s) return c >= t ? 100 : 0;
  return Math.round(Math.max(0, Math.min(1, (c - s) / (t - s))) * 100);
}

export function timeElapsedPct(startDate, targetDate, date) {
  const total = daysBetween(startDate, targetDate);
  if (total <= 0) return 100;
  return Math.round(Math.max(0, Math.min(1, daysBetween(startDate, date) / total)) * 100);
}

/** Extract YouTube video id from watch / youtu.be / shorts / embed URLs. */
export function youtubeId(url) {
  if (!url) return null;
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\.|^m\./, '');
    if (host === 'youtu.be') return u.pathname.slice(1).split('/')[0] || null;
    if (host === 'youtube.com' || host === 'music.youtube.com') {
      if (u.searchParams.get('v')) return u.searchParams.get('v');
      const m = u.pathname.match(/^\/(shorts|embed|live)\/([\w-]{6,})/);
      if (m) return m[2];
    }
  } catch { /* invalid url */ }
  return null;
}

export const youtubeSearchUrl = (q) => `https://www.youtube.com/results?search_query=${encodeURIComponent(q || '')}`;

/** Best (max) value per day, sorted ascending. items: [{date, value}] */
export function dailyMax(items) {
  const map = new Map();
  for (const it of items) {
    const v = Number(it.value);
    if (!Number.isFinite(v)) continue;
    if (!map.has(it.date) || map.get(it.date) < v) map.set(it.date, v);
  }
  return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([date, value]) => ({ date, value }));
}
