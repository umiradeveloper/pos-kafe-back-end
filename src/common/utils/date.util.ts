/**
 * Utilitas tanggal berbasis zona waktu toko (default Asia/Jakarta).
 * Database menyimpan waktu dalam UTC; fungsi ini menerjemahkan "hari" lokal.
 */

/** Dibaca saat dipakai (bukan saat import) agar nilai dari .env sudah termuat. */
export const appTimezone = () => process.env.APP_TIMEZONE || 'Asia/Jakarta';

/** Jam lokal (0–23) dari sebuah waktu */
export function localHour(date: Date, timeZone = appTimezone()): number {
  const h = new Intl.DateTimeFormat('en-US', { timeZone, hour: '2-digit', hourCycle: 'h23' }).format(date);
  return Number(h) % 24;
}

const pad = (n: number) => String(n).padStart(2, '0');

/** Selisih (ms) zona waktu terhadap UTC pada saat tertentu. */
function tzOffsetMs(timeZone: string, at: Date): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(at);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  const asUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'));
  return asUtc - Math.floor(at.getTime() / 1000) * 1000;
}

/** Tanggal lokal dalam format YYYY-MM-DD. */
export function localDateKey(date: Date, timeZone = appTimezone()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

/** Awal hari (00:00 lokal) untuk string YYYY-MM-DD, dikembalikan sebagai Date UTC. */
export function startOfLocalDay(dateKey: string, timeZone = appTimezone()): Date {
  const [y, m, d] = dateKey.split('-').map(Number);
  const guess = new Date(Date.UTC(y, m - 1, d));
  return new Date(guess.getTime() - tzOffsetMs(timeZone, guess));
}

/** Tambah n hari pada string YYYY-MM-DD. */
export function addDays(dateKey: string, days: number): string {
  const [y, m, d] = dateKey.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`;
}

const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Ubah rentang tanggal lokal (inklusif) menjadi rentang waktu UTC [gte, lt).
 * Jika kosong, dipakai hari ini.
 */
export function resolveRange(from?: string, to?: string) {
  const today = localDateKey(new Date());
  const fromKey = from && DATE_KEY.test(from) ? from : today;
  const toKey = to && DATE_KEY.test(to) ? to : fromKey;
  return {
    fromKey,
    toKey,
    gte: startOfLocalDay(fromKey),
    lt: startOfLocalDay(addDays(toKey, 1)),
  };
}
