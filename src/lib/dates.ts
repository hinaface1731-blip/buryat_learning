// Дни считаются по локальной дате устройства в формате YYYY-MM-DD.

export type DateKey = string;

export function dateKey(d: Date = new Date()): DateKey {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function parse(key: DateKey): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d, 12); // полдень — без сюрпризов с переходом на летнее время
}

export function addDays(key: DateKey, n: number): DateKey {
  const d = parse(key);
  d.setDate(d.getDate() + n);
  return dateKey(d);
}

export function diffDays(a: DateKey, b: DateKey): number {
  return Math.round((parse(a).getTime() - parse(b).getTime()) / 86_400_000);
}
