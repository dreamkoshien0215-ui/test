// Warning dialog shown whenever a soreness level of 4+ is recorded (or ignored at log time).
import { warnDialog } from './ui.js';

/** @param {{label:string,value:number,critical:boolean}[]} parts */
function lines(parts) {
  const names = parts.map((p) => `${p.label} ${p.value}/5`).join('・');
  const arm = parts.some((p) => p.critical);
  return [
    `${names} の違和感が記録されました。`,
    arm
      ? '投球（ブルペン・遠投・プルダウン）と出力系トレーニングは中止し、今日はレストにしてください。'
      : '該当部位に負荷のかかる種目は中止し、今日はレストにしてください。',
    '痛みが続く・しびれがある・日常動作でも痛む場合は、整形外科やトレーナーに相談してください。',
  ];
}

/** Shown right after the user records soreness >= 4. Resolves 'care' | 'ok' | null. */
export const soreAlert = (parts) => warnDialog({
  title: '違和感レベル 4以上：レスト推奨',
  lines: lines(parts),
  actions: [
    { label: 'ケア種目を見る', value: 'care', primary: true },
    { label: '了解', value: 'ok' },
  ],
});

/** Shown before logging a high-intensity drill on a day with soreness >= 4. Resolves 'log' | 'cancel' | null. */
export const soreLogGuard = (parts, drillName) => warnDialog({
  title: '今日は高強度種目を控えてください',
  lines: [...lines(parts).slice(0, 2), `「${drillName}」を記録しますか？`],
  actions: [
    { label: 'やめておく', value: 'cancel', primary: true },
    { label: 'それでも記録する', value: 'log', danger: true },
  ],
});
