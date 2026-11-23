/**
 * @file geocoding.js — Pencarian kota (Open-Meteo Geocoding) dan "lokasi aktif" aplikasi.
 * @owner Maintainer
 *
 * Lokasi aktif dibawa antarhalaman lewat URL (?lat=&lon=&name=&country=)
 * dengan cadangan di localStorage. Halaman cukup memanggil resolveLocation().
 */

import { fetchJSON, ApiError } from './api.js';

const GEOCODING_URL = 'https://geocoding-api.open-meteo.com/v1/search';
const STORAGE_KEY = 'weather-dashboard:location';

/**
 * @typedef {Object} Location
 * @property {string} name - mis. 'Jakarta'
 * @property {string} [admin1] - provinsi/negara bagian, mis. 'DKI Jakarta'
 * @property {string} [country] - mis. 'Indonesia'
 * @property {number} latitude
 * @property {number} longitude
 * @property {string} [timezone]
 */

/** Lokasi default bila belum ada lokasi tersimpan. */
export const DEFAULT_LOCATION = Object.freeze({
  name: 'Jakarta',
  admin1: 'DKI Jakarta',
  country: 'Indonesia',
  latitude: -6.2146,
  longitude: 106.8451,
  timezone: 'Asia/Jakarta',
});

/**
 * Cari kota berdasarkan nama.
 * @param {string} query - minimal 2 karakter.
 * @param {{ count?: number, language?: string }} [options]
 * @returns {Promise<Location[]>} array kosong bila tidak ditemukan.
 * @throws {ApiError}
 * @example
 * const results = await searchLocation('Bandung');
 * // [{ name: 'Bandung', admin1: 'Jawa Barat', country: 'Indonesia', latitude: -6.92, ... }]
 */
export async function searchLocation(query, { count = 5, language = 'id' } = {}) {
  const name = String(query ?? '').trim();
  if (name.length < 2) return [];

  const url = new URL(GEOCODING_URL);
  url.searchParams.set('name', name);
  url.searchParams.set('count', String(count));
  url.searchParams.set('language', language);
  url.searchParams.set('format', 'json');

  const data = await fetchJSON(url.toString());
  return (data.results ?? []).map((item) => ({
    name: item.name,
    admin1: item.admin1 ?? '',
    country: item.country ?? '',
    latitude: item.latitude,
    longitude: item.longitude,
    timezone: item.timezone ?? '',
  }));
}

/**
 * Lokasi perangkat pengguna (Geolocation API browser). Membutuhkan izin pengguna.
 * @param {{ timeout?: number }} [options]
 * @returns {Promise<Location>} name = 'Lokasi Saya'
 * @throws {ApiError} bila izin ditolak / tidak didukung / timeout.
 */
export function getBrowserLocation({ timeout = 10000 } = {}) {
  return new Promise((resolve, reject) => {
    if (!('geolocation' in navigator)) {
      reject(new ApiError('Browser Anda tidak mendukung deteksi lokasi.', 'invalid'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({
        name: 'Lokasi Saya',
        admin1: '',
        country: '',
        latitude: Number(pos.coords.latitude.toFixed(4)),
        longitude: Number(pos.coords.longitude.toFixed(4)),
        timezone: '',
      }),
      (err) => {
        const message = err.code === err.PERMISSION_DENIED
          ? 'Izin lokasi ditolak. Cari kota secara manual.'
          : 'Lokasi tidak dapat dideteksi. Cari kota secara manual.';
        reject(new ApiError(message, 'invalid', err.message));
      },
      { timeout, maximumAge: 10 * 60 * 1000 },
    );
  });
}

function isValidLocation(loc) {
  return loc
    && Number.isFinite(loc.latitude) && Number.isFinite(loc.longitude)
    && loc.latitude >= -90 && loc.latitude <= 90
    && loc.longitude >= -180 && loc.longitude <= 180;
}

function readLocationFromURL() {
  const params = new URLSearchParams(window.location.search);
  if (!params.has('lat') || !params.has('lon')) return null;
  const loc = {
    name: params.get('name') || 'Lokasi terpilih',
    admin1: params.get('admin1') || '',
    country: params.get('country') || '',
    latitude: Number(params.get('lat')),
    longitude: Number(params.get('lon')),
    timezone: '',
  };
  return isValidLocation(loc) ? loc : null;
}

function readLocationFromStorage() {
  try {
    const loc = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return isValidLocation(loc) ? loc : null;
  } catch {
    return null;
  }
}

/**
 * Lokasi aktif untuk halaman ini.
 * Prioritas: parameter URL → localStorage → DEFAULT_LOCATION (Jakarta).
 * @returns {Location}
 * @example
 * const location = resolveLocation();
 * const data = await getForecast(location.latitude, location.longitude);
 */
export function resolveLocation() {
  return readLocationFromURL() ?? readLocationFromStorage() ?? { ...DEFAULT_LOCATION };
}

/**
 * Ubah lokasi menjadi query string URL (?lat=&lon=&name=...).
 * @param {Location} location
 * @returns {URLSearchParams}
 */
export function locationToParams(location) {
  const params = new URLSearchParams();
  params.set('lat', String(location.latitude));
  params.set('lon', String(location.longitude));
  params.set('name', location.name);
  if (location.admin1) params.set('admin1', location.admin1);
  if (location.country) params.set('country', location.country);
  return params;
}

/**
 * Simpan lokasi aktif ke localStorage dan perbarui URL halaman (tanpa reload).
 * Biasanya dipanggil otomatis oleh navbar; halaman jarang perlu memanggilnya.
 * @param {Location} location
 */
export function saveLocation(location) {
  if (!isValidLocation(location)) return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(location));
  } catch {
    /* localStorage tidak tersedia (mode privat) — URL tetap diperbarui */
  }
  const url = new URL(window.location.href);
  url.search = locationToParams(location).toString();
  window.history.replaceState(null, '', url);
}

/**
 * Teks lokasi untuk ditampilkan, mis. 'Bandung, Jawa Barat, Indonesia'.
 * @param {Location} location
 * @returns {string}
 */
export function formatLocationName(location) {
  return [location.name, location.admin1, location.country]
    .filter((part, i, arr) => part && arr.indexOf(part) === i)
    .join(', ');
}
