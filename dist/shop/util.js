// Formato y validación compartidos. Módulo puro, probado en tests/shop.test.mjs.

const money0 = new Intl.NumberFormat('es-MX', {style:'currency', currency:'MXN', maximumFractionDigits:0});
const money2 = new Intl.NumberFormat('es-MX', {style:'currency', currency:'MXN', minimumFractionDigits:2, maximumFractionDigits:2});
export const money = n => (Number.isInteger(n) ? money0 : money2).format(n);

const ENTITIES = {'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'};
// Todo texto capturado por clientes pasa por aquí antes de llegar a innerHTML.
export const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ENTITIES[char]);

export const onlyDigits = value => String(value ?? '').replace(/\D/g, '');
export const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

// Celulares de México: 10 dígitos. Acepta el número con +52 o con el antiguo 521.
export function normalizePhone(value) {
  const digits = onlyDigits(value);
  if (digits.length === 12 && digits.startsWith('52')) return digits.slice(2);
  if (digits.length === 13 && digits.startsWith('521')) return digits.slice(3);
  return digits;
}
export const isValidPhone = digits => /^[1-9]\d{9}$/.test(digits);

export function formatPhone(value) {
  const d = onlyDigits(value).slice(0, 10);
  return [d.slice(0, 3), d.slice(3, 6), d.slice(6)].filter(Boolean).join(' ');
}
export const displayPhone = digits => `+52 ${formatPhone(digits)}`;

// Tarjetas: marca, Luhn, formato y vencimiento.
export const BRAND_NAMES = {visa:'Visa', mastercard:'Mastercard', amex:'American Express'};

export function cardBrand(value) {
  const d = onlyDigits(value);
  if (/^3[47]/.test(d)) return 'amex';
  if (/^4/.test(d)) return 'visa';
  if (/^(5[1-5]|222[1-9]|22[3-9]\d|2[3-6]\d\d|27[01]\d|2720)/.test(d)) return 'mastercard';
  return null;
}

export const cardLength = brand => brand === 'amex' ? 15 : 16;
export const cvcLength = brand => brand === 'amex' ? 4 : 3;

export function luhn(value) {
  const d = onlyDigits(value);
  if (d.length < 12) return false;
  let sum = 0;
  for (let i = 0; i < d.length; i++) {
    let n = Number(d[d.length - 1 - i]);
    if (i % 2) { n *= 2; if (n > 9) n -= 9; }
    sum += n;
  }
  return sum % 10 === 0;
}

export function formatCardNumber(value) {
  const brand = cardBrand(value);
  const d = onlyDigits(value).slice(0, cardLength(brand));
  const groups = brand === 'amex' ? [4, 6, 5] : [4, 4, 4, 4];
  const parts = [];
  let start = 0;
  for (const size of groups) {
    if (start >= d.length) break;
    parts.push(d.slice(start, start + size));
    start += size;
  }
  return parts.join(' ');
}

export function formatExpiry(value) {
  const d = onlyDigits(value).slice(0, 4);
  return d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d;
}

// "MM/AA" -> {valid, month, year} o {valid:false, reason}
export function parseExpiry(value, now = new Date()) {
  const match = /^(\d{2})\s*\/\s*(\d{2})$/.exec(String(value ?? '').trim());
  if (!match) return {valid:false, reason:'format'};
  const month = Number(match[1]);
  const year = 2000 + Number(match[2]);
  if (month < 1 || month > 12) return {valid:false, reason:'month'};
  // La tarjeta vale hasta el último día del mes impreso.
  if (new Date(year, month, 1) <= now) return {valid:false, reason:'expired'};
  if (year > now.getFullYear() + 20) return {valid:false, reason:'format'};
  return {valid:true, month, year};
}

// Fechas en español de México.
const dayMonth = new Intl.DateTimeFormat('es-MX', {day:'numeric', month:'short'});
const clock = new Intl.DateTimeFormat('es-MX', {hour:'numeric', minute:'2-digit'});
const longDay = new Intl.DateTimeFormat('es-MX', {weekday:'long', day:'numeric', month:'long'});
const shortWeekday = new Intl.DateTimeFormat('es-MX', {weekday:'short'});

export const startOfDay = date => { const d = new Date(date); d.setHours(0, 0, 0, 0); return d; };
export const sameDay = (a, b) => startOfDay(a).getTime() === startOfDay(b).getTime();
export const formatTime = date => clock.format(new Date(date));
export const formatLongDay = date => longDay.format(new Date(date));
export const formatWeekday = date => shortWeekday.format(new Date(date)).replace('.', '');

export function formatDay(date, now = new Date()) {
  const d = new Date(date);
  if (sameDay(d, now)) return 'Hoy';
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (sameDay(d, yesterday)) return 'Ayer';
  return dayMonth.format(d).replace('.', '');
}

export const formatDateTime = (date, now = new Date()) => `${formatDay(date, now)}, ${formatTime(date)}`;

export function timeAgo(date, now = Date.now()) {
  const minutes = Math.round((now - new Date(date).getTime()) / 60000);
  if (minutes < 1) return 'justo ahora';
  if (minutes < 60) return `hace ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `hace ${hours} h`;
  const days = Math.round(hours / 24);
  return `hace ${plural(days, 'día')}`;
}
