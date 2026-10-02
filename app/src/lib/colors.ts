export const theme = {
  bg: '#0b1020',
  surface: '#151b2f',
  surfaceAlt: '#1e2640',
  border: '#2a3352',
  text: '#f1f4ff',
  textDim: '#9aa3c0',
  primary: '#4f8cff',
  danger: '#ff5d6c',
};

/** 방문 횟수 → 나라 색상 (지구본/범례 공용) */
export const VISIT_LEVELS = [
  { min: 1, label: '1회', color: '#5eead4' },
  { min: 2, label: '2회', color: '#4ade80' },
  { min: 3, label: '3~4회', color: '#facc15' },
  { min: 5, label: '5~9회', color: '#fb923c' },
  { min: 10, label: '10회+', color: '#f43f5e' },
];

export function visitColor(count: number): string | null {
  if (count <= 0) return null;
  let color = VISIT_LEVELS[0].color;
  for (const level of VISIT_LEVELS) if (count >= level.min) color = level.color;
  return color;
}

/** 도시 색상 팔레트 */
export const CITY_COLORS = [
  '#f43f5e', '#fb923c', '#facc15', '#4ade80', '#2dd4bf', '#38bdf8', '#818cf8', '#e879f9',
];

export function flagEmoji(code: string) {
  if (!/^[A-Z]{2}$/.test(code)) return '🏳️';
  return String.fromCodePoint(...[...code].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65));
}
