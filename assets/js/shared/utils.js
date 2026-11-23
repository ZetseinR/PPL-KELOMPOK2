/**
 * @file utils.js — Helper umum: format data, kategori cuaca/AQI, dan state UI.
 * @owner Maintainer
 *
 * Tidak ada HTTP request di file ini. Semua fungsi murni atau hanya menyentuh
 * elemen DOM yang diberikan lewat parameter.
 */

const LOCALE = 'id-ID';

/* ------------------------------------------------------------------ */
/* Keamanan                                                            */
/* ------------------------------------------------------------------ */

/**
 * Escape teks sebelum dimasukkan ke innerHTML (nama kota dari API, input user, dll).
 * @param {unknown} value
 * @returns {string}
 * @example el.innerHTML = `<h2>${escapeHTML(location.name)}</h2>`;
 */
export function escapeHTML(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/* ------------------------------------------------------------------ */
/* Kode cuaca WMO                                                      */
/* ------------------------------------------------------------------ */

const WEATHER_CODES = {
  0: { label: 'Cerah', icon: '☀️', nightIcon: '🌙' },
  1: { label: 'Cerah berawan', icon: '🌤️', nightIcon: '🌙' },
  2: { label: 'Berawan sebagian', icon: '⛅', nightIcon: '☁️' },
  3: { label: 'Mendung', icon: '☁️' },
  45: { label: 'Berkabut', icon: '🌫️' },
  48: { label: 'Kabut beku', icon: '🌫️' },
  51: { label: 'Gerimis ringan', icon: '🌦️' },
  53: { label: 'Gerimis', icon: '🌦️' },
  55: { label: 'Gerimis lebat', icon: '🌧️' },
  56: { label: 'Gerimis beku ringan', icon: '🌧️' },
  57: { label: 'Gerimis beku lebat', icon: '🌧️' },
  61: { label: 'Hujan ringan', icon: '🌦️' },
  63: { label: 'Hujan sedang', icon: '🌧️' },
  65: { label: 'Hujan lebat', icon: '🌧️' },
  66: { label: 'Hujan beku ringan', icon: '🌧️' },
  67: { label: 'Hujan beku lebat', icon: '🌧️' },
  71: { label: 'Salju ringan', icon: '🌨️' },
  73: { label: 'Salju sedang', icon: '🌨️' },
  75: { label: 'Salju lebat', icon: '❄️' },
  77: { label: 'Butiran salju', icon: '🌨️' },
  80: { label: 'Hujan lokal ringan', icon: '🌦️' },
  81: { label: 'Hujan lokal sedang', icon: '🌧️' },
  82: { label: 'Hujan lokal sangat lebat', icon: '⛈️' },
  85: { label: 'Hujan salju ringan', icon: '🌨️' },
  86: { label: 'Hujan salju lebat', icon: '❄️' },
  95: { label: 'Badai petir', icon: '⛈️' },
  96: { label: 'Badai petir + hujan es ringan', icon: '⛈️' },
  99: { label: 'Badai petir + hujan es lebat', icon: '⛈️' },
};

/**
 * Label dan ikon untuk kode cuaca WMO dari Open-Meteo.
 * @param {number} code - weatherCode
 * @param {boolean|0|1} [isDay=true]
 * @returns {{ label: string, icon: string }}
 * @example getWeatherInfo(61) // { label: 'Hujan ringan', icon: '🌦️' }
 */
export function getWeatherInfo(code, isDay = true) {
  const info = WEATHER_CODES[code];
  if (!info) return { label: 'Tidak diketahui', icon: '❔' };
  const icon = !isDay && info.nightIcon ? info.nightIcon : info.icon;
  return { label: info.label, icon };
}

/* ------------------------------------------------------------------ */
/* Kategori kualitas udara                                             */
/* ------------------------------------------------------------------ */

const AQI_SCALES = {
  european: [
    { max: 20, label: 'Baik', color: '#50c878' },
    { max: 40, label: 'Cukup', color: '#a3d65c' },
    { max: 60, label: 'Sedang', color: '#f2c94c' },
    { max: 80, label: 'Buruk', color: '#f2994a' },
    { max: 100, label: 'Sangat buruk', color: '#eb5757' },
    { max: Infinity, label: 'Berbahaya', color: '#8e44ad' },
  ],
  us: [
    { max: 50, label: 'Baik', color: '#50c878' },
    { max: 100, label: 'Sedang', color: '#f2c94c' },
    { max: 150, label: 'Tidak sehat (sensitif)', color: '#f2994a' },
    { max: 200, label: 'Tidak sehat', color: '#eb5757' },
    { max: 300, label: 'Sangat tidak sehat', color: '#8e44ad' },
    { max: Infinity, label: 'Berbahaya', color: '#7b1f3a' },
  ],
};

/**
 * Kategori AQI.
 * @param {number} value
 * @param {'european'|'us'} [scale='european']
 * @returns {{ label: string, level: number, color: string }} level 1 (terbaik) – 6 (terburuk), 0 bila tidak ada data.
 * @example getAqiCategory(35) // { label: 'Cukup', level: 2, color: '#a3d65c' }
 */
export function getAqiCategory(value, scale = 'european') {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return { label: 'Tidak ada data', level: 0, color: '#9aa5b1' };
  }
  const levels = AQI_SCALES[scale] ?? AQI_SCALES.european;
  const index = levels.findIndex((lvl) => value <= lvl.max);
  const { label, color } = levels[index];
  return { label, level: index + 1, color };
}

/* ------------------------------------------------------------------ */
/* Format angka & tanggal                                              */
/* ------------------------------------------------------------------ */

/**
 * @param {number|null} value
 * @param {number} [decimals=0]
 * @returns {string} '–' bila tidak ada data.
 */
export function formatNumber(value, decimals = 0) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '–';
  return Number(value).toLocaleString(LOCALE, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

/**
 * @param {number|null} value
 * @param {string} [unit='°C']
 * @returns {string} mis. '28°C'
 */
export function formatTemperature(value, unit = '°C') {
  const formatted = formatNumber(value, 0);
  return formatted === '–' ? formatted : `${formatted}${unit}`;
}

/** Tanggal 'YYYY-MM-DD' di-parse sebagai waktu lokal (bukan UTC) agar hari tidak bergeser. */
function parseDate(value) {
  if (value instanceof Date) return value;
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return new Date(`${value}T00:00`);
  }
  return new Date(value);
}

/**
 * @param {string|Date} value - ISO dari API ('2026-11-23' atau '2026-11-23T14:00').
 * @param {Intl.DateTimeFormatOptions} [options]
 * @returns {string} mis. 'Senin, 23 November'
 */
export function formatDate(value, options = { weekday: 'long', day: 'numeric', month: 'long' }) {
  const date = parseDate(value);
  if (Number.isNaN(date.getTime())) return '–';
  return date.toLocaleDateString(LOCALE, options);
}

/**
 * @param {string|Date} value
 * @returns {string} mis. '14.00'
 */
export function formatTime(value) {
  const date = parseDate(value);
  if (Number.isNaN(date.getTime())) return '–';
  return date.toLocaleTimeString(LOCALE, { hour: '2-digit', minute: '2-digit' });
}

/**
 * @param {Date} date
 * @returns {string} 'YYYY-MM-DD' (zona waktu lokal)
 */
export function toISODate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * @param {Date} date
 * @param {number} days - boleh negatif
 * @returns {Date} objek Date baru
 */
export function addDays(date, days) {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

/**
 * Arah mata angin dari derajat.
 * @param {number} degrees
 * @returns {string} mis. 'Barat Laut'
 */
export function getWindDirection(degrees) {
  if (degrees === null || degrees === undefined) return '–';
  const directions = ['Utara', 'Timur Laut', 'Timur', 'Tenggara', 'Selatan', 'Barat Daya', 'Barat', 'Barat Laut'];
  return directions[Math.round(degrees / 45) % 8];
}

/* ------------------------------------------------------------------ */
/* State UI: loading / error / kosong                                  */
/* ------------------------------------------------------------------ */

/**
 * Tampilkan indikator loading di dalam container.
 * @param {HTMLElement} container
 * @param {string} [text='Memuat data...']
 */
export function showLoading(container, text = 'Memuat data...') {
  container.setAttribute('aria-busy', 'true');
  container.innerHTML = `
    <div class="state state--loading" role="status" aria-live="polite">
      <span class="spinner" aria-hidden="true"></span>
      <p class="state__text">${escapeHTML(text)}</p>
    </div>`;
}

/**
 * Tampilkan pesan error + tombol coba lagi (opsional).
 * @param {HTMLElement} container
 * @param {string} message
 * @param {() => void} [onRetry]
 */
export function showError(container, message, onRetry) {
  container.removeAttribute('aria-busy');
  container.innerHTML = `
    <div class="state state--error" role="alert">
      <span class="state__icon" aria-hidden="true">⚠️</span>
      <p class="state__text">${escapeHTML(message)}</p>
      ${onRetry ? '<button type="button" class="btn btn--primary" data-retry>Coba lagi</button>' : ''}
    </div>`;
  if (onRetry) {
    container.querySelector('[data-retry]').addEventListener('click', onRetry, { once: true });
  }
}

/**
 * Tampilkan pesan data kosong.
 * @param {HTMLElement} container
 * @param {string} [message='Data tidak tersedia.']
 */
export function showEmpty(container, message = 'Data tidak tersedia.') {
  container.removeAttribute('aria-busy');
  container.innerHTML = `
    <div class="state state--empty">
      <span class="state__icon" aria-hidden="true">📭</span>
      <p class="state__text">${escapeHTML(message)}</p>
    </div>`;
}

/**
 * Hapus status loading (panggil setelah render konten).
 * @param {HTMLElement} container
 */
export function clearLoading(container) {
  container.removeAttribute('aria-busy');
}

/**
 * Pesan error yang aman untuk ditampilkan dari error apa pun.
 * @param {unknown} error
 * @returns {string}
 */
export function getErrorMessage(error) {
  if (error && error.name === 'ApiError') return error.message;
  return 'Terjadi kesalahan tak terduga. Silakan coba lagi.';
}

/* ------------------------------------------------------------------ */
/* Lain-lain                                                           */
/* ------------------------------------------------------------------ */

/**
 * @template {(...args: any[]) => void} F
 * @param {F} fn
 * @param {number} [wait=300]
 * @returns {F}
 */
export function debounce(fn, wait = 300) {
  let timer;
  return function debounced(...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), wait);
  };
}
