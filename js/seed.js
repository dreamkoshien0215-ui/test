// Initial master data loaded on first launch.

export const SEED_CATEGORIES = [
  { id: 'cat-thoracic', name: '胸郭・肩甲骨', nameEn: 'Mobility & Scapular', color: '#38bdf8', order: 1 },
  { id: 'cat-hip', name: '股関節・骨盤', nameEn: 'Hip Mobility & Power', color: '#a78bfa', order: 2 },
  { id: 'cat-core', name: '回転軸・体幹', nameEn: 'Rotational Core', color: '#f59e0b', order: 3 },
  { id: 'cat-power', name: '出力・爆発力', nameEn: 'Plyometrics & Power', color: '#ef4444', order: 4 },
  { id: 'cat-care', name: 'リカバリー・ショルダーケア', nameEn: 'Care & Readiness', color: '#22c55e', order: 5 },
];

const d = (id, categoryId, name, cue, notes, youtubeQuery, defaults = {}) => ({
  id, categoryId, name, cue, notes, youtubeQuery, youtubeUrl: '',
  defaultSets: defaults.sets ?? 2, defaultReps: defaults.reps ?? 10, defaultWeightKg: defaults.kg ?? 0,
  favorite: false, archived: false, seeded: true,
});

export const SEED_DRILLS = [
  d('drl-catcow', 'cat-thoracic', 'キャット＆カウ（胸郭拡張）', '胸椎を丸めて反らす',
    '骨盤ではなく「胸椎」をしっかり丸めて反らす。肩肘の負担を減らす基本。', '胸郭 可動域 キャットカウ 野球'),
  d('drl-tspine', 'cat-thoracic', 'Tスパイクロテーション（胸郭捻転）', '胸郭のしなり',
    '股関節を固定し、胸郭だけを左右に捻る。トップの位置での「しなり」を作る。', '胸骨 ロテーション 投球フォーム', { reps: 8 }),
  d('drl-ytwl', 'cat-thoracic', 'Y-T-W-L エクササイズ', '肩甲骨を寄せて下げる',
    '肩甲骨周囲筋（インナーマッスル）の強化。投球後の肩の安定性を確保。', 'YTWL インナーマッスル 肩 補強', { reps: 8, kg: 1 }),
  d('drl-9090', 'cat-hip', '90/90 ヒップモビリティ', '踏み込み足の受け',
    '股関節の内旋・外旋可動域を高める。踏み込み足の受けと体重移動のスムーズ化。', '90/90 股関節 柔軟 野球', { reps: 6 }),
  d('drl-hinge', 'cat-hip', 'ヒップヒンジ ＆ 前傾キープ', '右股関節のタメ',
    'お尻（大臀筋）でパワーを溜める感覚の習得。腰痛予防に直結。', 'ヒップヒンジ 野球 ピッチング'),
  d('drl-mbside', 'cat-core', 'メディシンボール・サイドスロー（1〜3kg）', '下半身→体幹→胸の順',
    '腕で投げず、下半身の回転→体幹→胸の開きの順でボールにパワーを伝える。', 'メディシンボール サイドスロー 球速アップ', { sets: 3, reps: 6, kg: 3 }),
  d('drl-chop', 'cat-core', 'ハーフニーリング・ケーブルチョップ', '軸をブラさず斜めに絞る',
    '膝立ちで軸をブレさせずに体幹を斜めに絞る。コントロール安定と出力向上。', 'ケーブルチョップ 体幹 野球', { sets: 3, reps: 8, kg: 10 }),
  d('drl-trapbar', 'cat-power', 'トラップバー・デッドリフト / ジャンプ', '床を強く押す',
    '下半身の最大出力向上。腰への負担を抑えつつ床反力を高める。', 'トラップバー デッドリフト 野球', { sets: 4, reps: 5, kg: 80 }),
  d('drl-plyo', 'cat-power', 'プライオボール（フェーズド・スロー）', '肘の通り道',
    '重量の異なるボールで肘の正しい通り道を意識しつつリリース加速。', 'プライオボール ピッチング ドリル', { sets: 2, reps: 8, kg: 0.45 }),
  d('drl-band', 'cat-care', 'バンデット・ショルダー・サーキット', '減速筋で肘を守る',
    'チューブを使った肩後面の補強。投球のブレーキ筋（減速筋）を鍛えて肘を守る。', 'チューブ エクササイズ ピッチング ショルダーケア', { reps: 15 }),
  d('drl-forearm', 'cat-care', '前腕・腕橈骨筋リリース', '前腕の張りを抜く',
    '投球後の肘の内側・外側のセルフケア。前腕の張りを取って肘痛を予防。', '前腕 ほぐし 肘痛 予防 野球', { sets: 1, reps: 60 }),
];

// Common athlete foods (per serving). Values are approximate.
export const SEED_FOODS = [
  { id: 'fd-rice', name: 'ごはん 200g', kcal: 312, p: 5, f: 0.6, c: 74 },
  { id: 'fd-chicken', name: '鶏むね肉(皮なし) 100g', kcal: 105, p: 23, f: 1.9, c: 0 },
  { id: 'fd-egg', name: '卵 1個', kcal: 76, p: 6.2, f: 5.2, c: 0.2 },
  { id: 'fd-natto', name: '納豆 1パック', kcal: 90, p: 7.4, f: 4.5, c: 5.4 },
  { id: 'fd-banana', name: 'バナナ 1本', kcal: 86, p: 1.1, f: 0.2, c: 22.5 },
  { id: 'fd-whey', name: 'プロテイン 1杯(30g)', kcal: 120, p: 24, f: 1.5, c: 3 },
  { id: 'fd-yogurt', name: 'ギリシャヨーグルト 100g', kcal: 59, p: 10, f: 0.4, c: 3.6 },
  { id: 'fd-onigiri', name: 'おにぎり(鮭)', kcal: 180, p: 5, f: 1.5, c: 38 },
  { id: 'fd-milk', name: '牛乳 200ml', kcal: 134, p: 6.6, f: 7.6, c: 9.6 },
  { id: 'fd-salmon', name: '鮭 1切れ 80g', kcal: 106, p: 17.8, f: 3.3, c: 0.1 },
].map((f) => ({ ...f, favorite: true, useCount: 0 }));

export const SEED_METRIC_DEFS = [
  // aggregate: how the "current" value is derived for milestones ('max' = personal best, 'latest' = last entry)
  { key: 'velocity', name: '球速（最速）', unit: 'km/h', aggregate: 'max', builtIn: true },
  { key: 'trapbarDL', name: 'トラップバーDL 1RM', unit: 'kg', aggregate: 'max' },
  { key: 'cmj', name: '垂直跳び(CMJ)', unit: 'cm', aggregate: 'max' },
  { key: 'mbThrow', name: 'MBサイドスロー速度', unit: 'km/h', aggregate: 'max' },
  { key: 'bodyWeight', name: '体重', unit: 'kg', aggregate: 'latest' },
];
