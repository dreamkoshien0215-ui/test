// Derived view-models built from the stored state + pure logic.
import * as store from './db.js';
import { assessReadiness, calcNutritionTargets, sumMeals, progressPct, timeElapsedPct, dailyMax, SORE_PARTS } from './logic.js';

export function readinessFor(date) {
  const s = store.db();
  return assessReadiness({
    condition: store.conditionOn(date),
    workoutLogs: s.workoutLogs,
    date,
    throwingArm: s.profile.throwingArm,
  });
}

/** Current value of a metric up to `date` (inclusive) according to its aggregate rule. */
export function metricCurrent(key, date) {
  const def = store.metricDef(key);
  const series = store.metricSeries(key).filter((x) => !date || x.date <= date);
  if (!series.length) return null;
  if (def?.aggregate === 'max') return Math.max(...series.map((x) => Number(x.value)));
  return Number(series[series.length - 1].value);
}

export function milestoneView(ms, date) {
  const series = store.metricSeries(ms.metricKey);
  const start = ms.startValue ?? (series.length ? Number(series[0].value) : null);
  const current = metricCurrent(ms.metricKey, date);
  return {
    ...ms,
    def: store.metricDef(ms.metricKey),
    start,
    current,
    pct: current == null || start == null ? 0 : progressPct(start, current, ms.targetValue),
    timePct: timeElapsedPct(ms.startDate, ms.targetDate, date),
  };
}

export function velocityView(date) {
  const s = store.db();
  const ms = s.milestones.find((m) => m.metricKey === 'velocity') || { targetValue: 145, startDate: date, targetDate: date, metricKey: 'velocity' };
  const mv = milestoneView(ms, date);
  const todays = store.metricSeries('velocity').filter((x) => x.date === date).map((x) => Number(x.value));
  return {
    target: ms.targetValue,
    best: mv.current,
    today: todays.length ? Math.max(...todays) : null,
    // Velocity progress expressed as best / target, which reads more naturally than start→target for a single headline number.
    pct: mv.current ? Math.min(100, Math.round((mv.current / ms.targetValue) * 100)) : 0,
    milestone: mv,
    series: dailyMax(store.metricSeries('velocity')),
  };
}

export function nutritionView(date) {
  const p = store.db().profile;
  const targets = calcNutritionTargets({ weightKg: p.weightKg, heightCm: p.heightCm, age: p.age, sex: p.sex, activity: p.activity, goal: p.nutritionGoal });
  const meals = store.mealsOn(date);
  return { targets, totals: sumMeals(meals), meals };
}

export function workoutSummary(date) {
  return store.workoutsOn(date).map((w) => {
    const d = store.drillById(w.drillId);
    const kg = Number(w.weightKg) ? `${w.weightKg}kg×` : '';
    return { log: w, drill: d, name: d?.name || '(削除済み)', detail: `${kg}${w.reps}×${w.sets}` };
  });
}

export function shareData(date) {
  const s = store.db();
  const r = readinessFor(date);
  const c = store.conditionOn(date);
  return {
    date,
    handle: s.shareSettings.handle,
    workouts: workoutSummary(date).map(({ name, detail }) => ({ name: name.replace(/（.*?）/g, ''), detail })),
    velocity: velocityView(date),
    readiness: r,
    hasCondition: !!c,
    // Throwing-arm parts (肩・肘) only — what matters for a pitcher's status card.
    soreness: SORE_PARTS.filter((p) => p.critical).map((p) => ({ label: p.label, value: Number(c?.soreness?.[p.key]) || 1 })),
  };
}
