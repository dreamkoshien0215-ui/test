import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  assessReadiness, acwr, shoulderRomFlags, calcNutritionTargets, sumMeals,
  progressPct, timeElapsedPct, youtubeId, dailyMax, addDays, daysBetween, channelHandle, channelSearchUrl,
} from '../js/logic.js';

const D = '2026-10-07';

test('date helpers', () => {
  assert.equal(addDays('2026-12-31', 1), '2027-01-01');
  assert.equal(daysBetween('2026-10-01', D), 6);
});

test('readiness: no condition → unknown', () => {
  assert.equal(assessReadiness({ condition: null, date: D }).level, 'unknown');
});

test('readiness: all clear → go', () => {
  const r = assessReadiness({ condition: { soreness: {}, fatigue: 1, sleepHours: 8 }, date: D });
  assert.equal(r.level, 'go');
  assert.equal(r.score, 100);
});

test('readiness: elbow 4 → rest', () => {
  const r = assessReadiness({ condition: { soreness: { elbow: 4 }, fatigue: 1 }, date: D });
  assert.equal(r.level, 'rest');
  assert.ok(r.score <= 39);
  assert.match(r.reasons[0].msg, /肘/);
});

test('readiness: shoulder 3 or short sleep → caution', () => {
  assert.equal(assessReadiness({ condition: { soreness: { shoulder: 3 } }, date: D }).level, 'caution');
  assert.equal(assessReadiness({ condition: { soreness: {}, sleepHours: 5 }, date: D }).level, 'caution');
  assert.equal(assessReadiness({ condition: { soreness: {}, fatigue: 4 }, date: D }).level, 'caution');
});

test('ACWR spike → caution', () => {
  const logs = [];
  // 3 quiet weeks, then a heavy week
  for (let i = 7; i < 28; i += 2) logs.push({ date: addDays(D, -i), rpe: 6, sets: 3 });
  for (let i = 0; i < 7; i++) logs.push({ date: addDays(D, -i), rpe: 9, sets: 6 });
  const ratio = acwr(logs, D);
  assert.ok(ratio > 1.5, `ratio ${ratio}`);
  assert.equal(assessReadiness({ condition: { soreness: {} }, workoutLogs: logs, date: D }).level, 'caution');
  assert.equal(acwr([], D), null);
  // Day-1 of use: heavy session but no history → no ratio, no false alarm
  assert.equal(acwr([{ date: D, rpe: 9, sets: 10 }], D), null);
});

test('GIRD detection on throwing side', () => {
  const rom = { shoulderIR: { L: 60, R: 35 }, shoulderER: { L: 100, R: 110 } };
  const flags = shoulderRomFlags(rom, 'R');
  assert.equal(flags.length, 2);
  assert.equal(shoulderRomFlags(rom, 'L').length, 0);
});

test('nutrition targets (Mifflin-St Jeor)', () => {
  const t = calcNutritionTargets({ weightKg: 72, heightCm: 175, age: 20, sex: 'M', activity: 'mid', goal: 'power' });
  // BMR = 720 + 1093.75 - 100 + 5 = 1718.75
  assert.equal(t.bmr, 1719);
  assert.equal(t.kcal, Math.round(1718.75 * 1.75 + 350));
  assert.equal(t.p, Math.round(72 * 2.2));
  assert.ok(Math.abs(t.p * 4 + t.f * 9 + t.c * 4 - t.kcal) < 10);
  assert.equal(calcNutritionTargets({ weightKg: 0, heightCm: 175, age: 20 }), null);
});

test('sumMeals honours qty', () => {
  assert.deepEqual(sumMeals([{ kcal: 100, p: 10, f: 1, c: 5, qty: 2 }, { kcal: 50, p: 0, f: 0, c: 10, qty: 1 }]), { kcal: 250, p: 20, f: 2, c: 20 });
});

test('progress percentages', () => {
  assert.equal(progressPct(130, 137.5, 145), 50);
  assert.equal(progressPct(130, 150, 145), 100);
  assert.equal(progressPct(80, 75, 70), 50); // decreasing target
  assert.equal(timeElapsedPct('2026-01-01', '2026-12-31', '2026-07-02'), 50);
});

test('youtubeId parses common URL shapes', () => {
  assert.equal(youtubeId('https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=3'), 'dQw4w9WgXcQ');
  assert.equal(youtubeId('https://youtu.be/dQw4w9WgXcQ'), 'dQw4w9WgXcQ');
  assert.equal(youtubeId('https://youtube.com/shorts/dQw4w9WgXcQ'), 'dQw4w9WgXcQ');
  assert.equal(youtubeId('https://m.youtube.com/watch?v=abc123def45'), 'abc123def45');
  assert.equal(youtubeId('https://example.com/watch?v=x'), null);
  assert.equal(youtubeId('not a url'), null);
});

test('dailyMax keeps best per day sorted', () => {
  assert.deepEqual(
    dailyMax([{ date: '2026-10-02', value: 130 }, { date: '2026-10-01', value: 128 }, { date: '2026-10-02', value: 133 }]),
    [{ date: '2026-10-01', value: 128 }, { date: '2026-10-02', value: 133 }],
  );
});

test('channelHandle accepts share links and bare handles', () => {
  assert.equal(channelHandle('https://youtube.com/@illstyle?si=hqnSgntGArd_BSpY'), 'illstyle');
  assert.equal(channelHandle('https://www.youtube.com/@illstyle/videos'), 'illstyle');
  assert.equal(channelHandle('@illstyle'), 'illstyle');
  assert.equal(channelHandle('https://example.com/@illstyle'), null);
  assert.equal(channelHandle('https://youtu.be/dQw4w9WgXcQ'), null);
  assert.equal(channelSearchUrl('illstyle', '90/90 股関節'), 'https://www.youtube.com/@illstyle/search?query=90%2F90%20%E8%82%A1%E9%96%A2%E7%AF%80');
});
