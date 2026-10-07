// Local persistence layer. All data lives in a single JSON document in localStorage.
// Swap `load`/`persist` for IndexedDB or a backend API without touching the views.
import { SEED_CATEGORIES, SEED_DRILLS, SEED_FOODS, SEED_METRIC_DEFS } from './seed.js';
import { todayStr, addDays } from './logic.js';

const KEY = 'pitchlab:v1';
export const SCHEMA_VERSION = 1;

export const uid = (p = 'id') => `${p}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

function freshState() {
  const today = todayStr();
  return {
    schemaVersion: SCHEMA_VERSION,
    profile: {
      name: '', throwingArm: 'R', heightCm: 175, weightKg: 72, age: 20, sex: 'M',
      activity: 'mid', nutritionGoal: 'power',
    },
    categories: structuredClone(SEED_CATEGORIES),
    drills: structuredClone(SEED_DRILLS),
    workoutLogs: [], // {id,date,drillId,weightKg,reps,sets,rpe,note,createdAt}
    conditionLogs: [], // {id,date,soreness:{part:1-5},fatigue,sleepHours,rom:{item:{L,R}},note}
    metricDefs: structuredClone(SEED_METRIC_DEFS),
    metricLogs: [], // {id,date,metricKey,value,context,note}
    milestones: [
      { id: 'ms-145', title: '最速145km/h', metricKey: 'velocity', startValue: null, targetValue: 145, startDate: today, targetDate: addDays(today, 365) },
    ],
    foods: structuredClone(SEED_FOODS),
    mealLogs: [], // {id,date,meal,foodId,name,kcal,p,f,c,qty}
    shareSettings: {
      theme: 'sporty', size: 'feed', format: 'png', handle: '',
      sections: { workout: true, velocity: true, condition: true },
    },
  };
}

function migrate(state) {
  // Future schema migrations go here (state.schemaVersion < SCHEMA_VERSION).
  const base = freshState();
  for (const k of Object.keys(base)) if (state[k] === undefined) state[k] = base[k];
  state.profile = { ...base.profile, ...state.profile };
  state.shareSettings = { ...base.shareSettings, ...state.shareSettings, sections: { ...base.shareSettings.sections, ...(state.shareSettings?.sections || {}) } };
  state.schemaVersion = SCHEMA_VERSION;
  return state;
}

let state;
const listeners = new Set();

export function load() {
  try {
    const raw = localStorage.getItem(KEY);
    state = raw ? migrate(JSON.parse(raw)) : freshState();
  } catch {
    state = freshState();
  }
  return state;
}

export function persist() {
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { console.error('save failed', e); }
  listeners.forEach((fn) => fn(state));
}

export const db = () => state;
export const onChange = (fn) => listeners.add(fn);

// ---------- generic helpers ----------
export function insert(table, row) {
  const r = { id: uid(table.slice(0, 3)), createdAt: new Date().toISOString(), ...row };
  state[table].push(r);
  persist();
  return r;
}
export function update(table, id, patch) {
  const r = state[table].find((x) => x.id === id);
  if (r) { Object.assign(r, patch); persist(); }
  return r;
}
export function remove(table, id) {
  state[table] = state[table].filter((x) => x.id !== id);
  persist();
}

// ---------- domain queries ----------
export const drillById = (id) => state.drills.find((x) => x.id === id);
export const categoryById = (id) => state.categories.find((x) => x.id === id);
export const conditionOn = (date) => state.conditionLogs.find((x) => x.date === date);
export const workoutsOn = (date) => state.workoutLogs.filter((x) => x.date === date);
export const mealsOn = (date) => state.mealLogs.filter((x) => x.date === date);
export const lastWorkoutFor = (drillId) =>
  [...state.workoutLogs].filter((x) => x.drillId === drillId).sort((a, b) => (b.date + b.createdAt).localeCompare(a.date + a.createdAt))[0];
export const metricSeries = (key) =>
  state.metricLogs.filter((x) => x.metricKey === key).sort((a, b) => a.date.localeCompare(b.date));
export const metricDef = (key) => state.metricDefs.find((x) => x.key === key);

export function upsertCondition(date, patch) {
  const c = conditionOn(date);
  if (c) { Object.assign(c, patch); persist(); return c; }
  return insert('conditionLogs', { date, soreness: {}, fatigue: 1, sleepHours: null, rom: {}, note: '', ...patch });
}

// ---------- backup ----------
export const exportJson = () => JSON.stringify(state, null, 2);
export function importJson(text) {
  const parsed = JSON.parse(text);
  if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.drills)) throw new Error('不正なバックアップファイルです');
  state = migrate(parsed);
  persist();
}
export function resetAll() {
  state = freshState();
  persist();
}
