/**
 * @file api.js — Lapisan HTTP bersama untuk Open-Meteo (Forecast, Air Quality, Archive).
 * @owner Maintainer
 *
 * ATURAN:
 * - Halaman TIDAK boleh memanggil fetch() ke Open-Meteo secara langsung.
 *   Gunakan fungsi di file ini.
 * - Butuh field/parameter baru? Buat Issue berlabel `shared-request`.
 *
 * Semua fungsi mengembalikan data yang sudah dinormalisasi:
 * array paralel Open-Meteo ({ time: [...], temperature_2m: [...] })
 * diubah menjadi array of objects ([{ time, temperature }, ...]).
 */

const BASE_URL = {
  forecast: 'https://api.open-meteo.com/v1/forecast',
  airQuality: 'https://air-quality-api.open-meteo.com/v1/air-quality',
  archive: 'https://archive-api.open-meteo.com/v1/archive',
};

/** Data arsip tersedia mulai tanggal ini. */
export const HISTORY_MIN_DATE = '1940-01-01';

/** Data arsip (ERA5) biasanya tertinggal ±5 hari dari hari ini. */
export const HISTORY_DATA_DELAY_DAYS = 5;

const DEFAULT_TIMEOUT = 10000;

/* ------------------------------------------------------------------ */
/* Peta nama field Open-Meteo -> nama field yang dipakai di aplikasi   */
/* ------------------------------------------------------------------ */

const CURRENT_WEATHER_FIELDS = {
  temperature_2m: 'temperature',
  apparent_temperature: 'feelsLike',
  relative_humidity_2m: 'humidity',
  precipitation: 'precipitation',
  weather_code: 'weatherCode',
  is_day: 'isDay',
  wind_speed_10m: 'windSpeed',
  wind_direction_10m: 'windDirection',
  pressure_msl: 'pressure',
};

const HOURLY_WEATHER_FIELDS = {
  temperature_2m: 'temperature',
  apparent_temperature: 'feelsLike',
  relative_humidity_2m: 'humidity',
  precipitation_probability: 'precipitationProb',
  precipitation: 'precipitation',
  weather_code: 'weatherCode',
  wind_speed_10m: 'windSpeed',
  is_day: 'isDay',
};

const DAILY_WEATHER_FIELDS = {
  weather_code: 'weatherCode',
  temperature_2m_max: 'tempMax',
  temperature_2m_min: 'tempMin',
  precipitation_sum: 'precipitationSum',
  precipitation_probability_max: 'precipitationProbMax',
  wind_speed_10m_max: 'windSpeedMax',
  uv_index_max: 'uvIndexMax',
  sunrise: 'sunrise',
  sunset: 'sunset',
};

const AIR_QUALITY_FIELDS = {
  european_aqi: 'europeanAqi',
  us_aqi: 'usAqi',
  pm2_5: 'pm2_5',
  pm10: 'pm10',
  carbon_monoxide: 'co',
  nitrogen_dioxide: 'no2',
  sulphur_dioxide: 'so2',
  ozone: 'o3',
  dust: 'dust',
  uv_index: 'uvIndex',
};

const HISTORY_DAILY_FIELDS = {
  weather_code: 'weatherCode',
  temperature_2m_max: 'tempMax',
  temperature_2m_min: 'tempMin',
  temperature_2m_mean: 'tempMean',
  precipitation_sum: 'precipitationSum',
  rain_sum: 'rainSum',
  wind_speed_10m_max: 'windSpeedMax',
  sunshine_duration: 'sunshineDuration',
};

/* ------------------------------------------------------------------ */
/* Error & HTTP                                                        */
/* ------------------------------------------------------------------ */

/**
 * Error standar untuk semua kegagalan API.
 * `message` sudah dalam Bahasa Indonesia dan aman ditampilkan ke pengguna.
 */
export class ApiError extends Error {
  /**
   * @param {string} message - Pesan untuk pengguna.
   * @param {number|'timeout'|'network'|'invalid'|'parse'} status - Kode HTTP atau jenis error.
   * @param {string} [detail] - Detail teknis (alasan dari server), untuk console.
   */
  constructor(message, status, detail = '') {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.detail = detail;
  }
}

/**
 * Melakukan GET dan mengembalikan JSON. Menangani timeout, error jaringan,
 * dan error dari server Open-Meteo ({ error: true, reason }).
 *
 * @param {string} url - URL lengkap.
 * @param {{ timeout?: number }} [options]
 * @returns {Promise<any>}
 * @throws {ApiError}
 */
export async function fetchJSON(url, { timeout = DEFAULT_TIMEOUT } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);

  let response;
  try {
    response = await fetch(url, { signal: controller.signal });
  } catch (err) {
    if (err.name === 'AbortError') {
      throw new ApiError('Server terlalu lama merespons. Coba lagi sebentar lagi.', 'timeout');
    }
    throw new ApiError('Tidak dapat terhubung ke server. Periksa koneksi internet Anda.', 'network', err.message);
  } finally {
    clearTimeout(timer);
  }

  let data;
  try {
    data = await response.json();
  } catch {
    throw new ApiError('Respons server tidak dapat dibaca.', 'parse');
  }

  if (!response.ok || data?.error) {
    const reason = data?.reason || response.statusText;
    const message = response.status === 429
      ? 'Terlalu banyak permintaan. Tunggu sebentar lalu coba lagi.'
      : 'Server cuaca menolak permintaan. Coba lagi nanti.';
    throw new ApiError(message, response.status || 'invalid', reason);
  }

  return data;
}

/* ------------------------------------------------------------------ */
/* Helper internal                                                     */
/* ------------------------------------------------------------------ */

function buildUrl(base, params) {
  const url = new URL(base);
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null) return;
    url.searchParams.set(key, Array.isArray(value) ? value.join(',') : String(value));
  });
  return url.toString();
}

function assertCoordinates(lat, lon) {
  const valid = Number.isFinite(lat) && Number.isFinite(lon)
    && lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180;
  if (!valid) {
    throw new ApiError('Koordinat lokasi tidak valid.', 'invalid', `lat=${lat}, lon=${lon}`);
  }
}

/** Mengubah satu objek "current" Open-Meteo menjadi objek dengan nama field aplikasi. */
function mapObject(source, fieldMap) {
  if (!source) return null;
  const result = { time: source.time };
  Object.entries(fieldMap).forEach(([apiKey, appKey]) => {
    if (apiKey in source) result[appKey] = source[apiKey];
  });
  return result;
}

/**
 * Mengubah array paralel menjadi array of objects.
 * { time: [t1, t2], temperature_2m: [20, 21] } -> [{ time: t1, temperature: 20 }, ...]
 * @param {object} series
 * @param {Record<string,string>} fieldMap
 * @param {string} [timeKey='time'] - nama field waktu di hasil ('time' atau 'date').
 */
export function zipSeries(series, fieldMap, timeKey = 'time') {
  if (!series?.time) return [];
  return series.time.map((time, i) => {
    const row = { [timeKey]: time };
    Object.entries(fieldMap).forEach(([apiKey, appKey]) => {
      if (Array.isArray(series[apiKey])) row[appKey] = series[apiKey][i] ?? null;
    });
    return row;
  });
}

function mapUnits(units, fieldMap) {
  if (!units) return {};
  const result = {};
  Object.entries(fieldMap).forEach(([apiKey, appKey]) => {
    if (apiKey in units) result[appKey] = units[apiKey];
  });
  return result;
}

function isValidISODate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(new Date(`${value}T00:00`).getTime());
}

/* ------------------------------------------------------------------ */
/* Fungsi publik                                                       */
/* ------------------------------------------------------------------ */

/**
 * Cuaca saat ini (ringan, tanpa data per jam/harian).
 *
 * @param {number} lat
 * @param {number} lon
 * @returns {Promise<{ timezone: string, current: CurrentWeather, units: object }>}
 *
 * @example
 * const { current } = await getCurrentWeather(-6.2, 106.8);
 * console.log(current.temperature, current.weatherCode);
 */
export async function getCurrentWeather(lat, lon) {
  assertCoordinates(lat, lon);
  const url = buildUrl(BASE_URL.forecast, {
    latitude: lat,
    longitude: lon,
    current: Object.keys(CURRENT_WEATHER_FIELDS),
    timezone: 'auto',
  });
  const data = await fetchJSON(url);
  return {
    timezone: data.timezone,
    current: mapObject(data.current, CURRENT_WEATHER_FIELDS),
    units: mapUnits(data.current_units, CURRENT_WEATHER_FIELDS),
  };
}

/**
 * Prakiraan cuaca: kondisi saat ini + per jam + harian.
 *
 * @param {number} lat
 * @param {number} lon
 * @param {{ days?: number }} [options] - days: 1–16 (default 7).
 * @returns {Promise<{
 *   timezone: string,
 *   current: CurrentWeather,
 *   hourly: HourlyWeather[],
 *   daily: DailyWeather[],
 *   units: { current: object, hourly: object, daily: object }
 * }>}
 *
 * @example
 * const { daily } = await getForecast(-6.2, 106.8, { days: 7 });
 * daily.forEach(d => console.log(d.date, d.tempMax, d.tempMin));
 */
export async function getForecast(lat, lon, { days = 7 } = {}) {
  assertCoordinates(lat, lon);
  const forecastDays = Math.min(Math.max(Math.round(days), 1), 16);
  const url = buildUrl(BASE_URL.forecast, {
    latitude: lat,
    longitude: lon,
    current: Object.keys(CURRENT_WEATHER_FIELDS),
    hourly: Object.keys(HOURLY_WEATHER_FIELDS),
    daily: Object.keys(DAILY_WEATHER_FIELDS),
    forecast_days: forecastDays,
    timezone: 'auto',
  });
  const data = await fetchJSON(url);
  return {
    timezone: data.timezone,
    current: mapObject(data.current, CURRENT_WEATHER_FIELDS),
    hourly: zipSeries(data.hourly, HOURLY_WEATHER_FIELDS),
    daily: zipSeries(data.daily, DAILY_WEATHER_FIELDS, 'date'),
    units: {
      current: mapUnits(data.current_units, CURRENT_WEATHER_FIELDS),
      hourly: mapUnits(data.hourly_units, HOURLY_WEATHER_FIELDS),
      daily: mapUnits(data.daily_units, DAILY_WEATHER_FIELDS),
    },
  };
}

/**
 * Kualitas udara: kondisi saat ini + prakiraan per jam.
 *
 * @param {number} lat
 * @param {number} lon
 * @param {{ days?: number }} [options] - days: 1–7 (default 3).
 * @returns {Promise<{
 *   timezone: string,
 *   current: AirQuality,
 *   hourly: AirQuality[],
 *   units: object
 * }>}
 *
 * @example
 * const { current } = await getAirQuality(-6.2, 106.8);
 * console.log(current.europeanAqi, current.pm2_5);
 */
export async function getAirQuality(lat, lon, { days = 3 } = {}) {
  assertCoordinates(lat, lon);
  const forecastDays = Math.min(Math.max(Math.round(days), 1), 7);
  const url = buildUrl(BASE_URL.airQuality, {
    latitude: lat,
    longitude: lon,
    current: Object.keys(AIR_QUALITY_FIELDS),
    hourly: Object.keys(AIR_QUALITY_FIELDS),
    forecast_days: forecastDays,
    timezone: 'auto',
  });
  const data = await fetchJSON(url);
  return {
    timezone: data.timezone,
    current: mapObject(data.current, AIR_QUALITY_FIELDS),
    hourly: zipSeries(data.hourly, AIR_QUALITY_FIELDS),
    units: mapUnits(data.hourly_units, AIR_QUALITY_FIELDS),
  };
}

/**
 * Riwayat cuaca harian (data arsip).
 * Catatan: data beberapa hari terakhir (±HISTORY_DATA_DELAY_DAYS) bisa bernilai null.
 *
 * @param {number} lat
 * @param {number} lon
 * @param {string} startDate - 'YYYY-MM-DD'
 * @param {string} endDate - 'YYYY-MM-DD'
 * @returns {Promise<{ timezone: string, daily: HistoryDay[], units: object }>}
 * @throws {ApiError} status 'invalid' bila format/rentang tanggal salah.
 *
 * @example
 * const { daily } = await getWeatherHistory(-6.2, 106.8, '2026-10-01', '2026-10-31');
 */
export async function getWeatherHistory(lat, lon, startDate, endDate) {
  assertCoordinates(lat, lon);

  if (!isValidISODate(startDate) || !isValidISODate(endDate)) {
    throw new ApiError('Format tanggal harus YYYY-MM-DD.', 'invalid');
  }
  if (startDate > endDate) {
    throw new ApiError('Tanggal mulai tidak boleh setelah tanggal akhir.', 'invalid');
  }
  if (startDate < HISTORY_MIN_DATE) {
    throw new ApiError(`Data riwayat hanya tersedia mulai ${HISTORY_MIN_DATE}.`, 'invalid');
  }
  const today = new Date();
  const todayISO = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  if (endDate > todayISO) {
    throw new ApiError('Tanggal akhir tidak boleh melewati hari ini.', 'invalid');
  }

  const url = buildUrl(BASE_URL.archive, {
    latitude: lat,
    longitude: lon,
    start_date: startDate,
    end_date: endDate,
    daily: Object.keys(HISTORY_DAILY_FIELDS),
    timezone: 'auto',
  });
  const data = await fetchJSON(url, { timeout: 20000 });
  return {
    timezone: data.timezone,
    daily: zipSeries(data.daily, HISTORY_DAILY_FIELDS, 'date'),
    units: mapUnits(data.daily_units, HISTORY_DAILY_FIELDS),
  };
}

/**
 * @typedef {Object} CurrentWeather
 * @property {string} time - waktu lokal ISO, mis. '2026-11-23T14:00'
 * @property {number} temperature - °C
 * @property {number} feelsLike - °C
 * @property {number} humidity - %
 * @property {number} precipitation - mm
 * @property {number} weatherCode - kode WMO (lihat utils.getWeatherInfo)
 * @property {0|1} isDay
 * @property {number} windSpeed - km/h
 * @property {number} windDirection - derajat
 * @property {number} pressure - hPa
 *
 * @typedef {Object} HourlyWeather
 * @property {string} time
 * @property {number} temperature
 * @property {number} feelsLike
 * @property {number} humidity
 * @property {number} precipitationProb - %
 * @property {number} precipitation - mm
 * @property {number} weatherCode
 * @property {number} windSpeed
 * @property {0|1} isDay
 *
 * @typedef {Object} DailyWeather
 * @property {string} date - 'YYYY-MM-DD'
 * @property {number} weatherCode
 * @property {number} tempMax
 * @property {number} tempMin
 * @property {number} precipitationSum
 * @property {number} precipitationProbMax
 * @property {number} windSpeedMax
 * @property {number} uvIndexMax
 * @property {string} sunrise
 * @property {string} sunset
 *
 * @typedef {Object} AirQuality
 * @property {string} time
 * @property {number} europeanAqi
 * @property {number} usAqi
 * @property {number} pm2_5 - μg/m³
 * @property {number} pm10 - μg/m³
 * @property {number} co - μg/m³
 * @property {number} no2 - μg/m³
 * @property {number} so2 - μg/m³
 * @property {number} o3 - μg/m³
 * @property {number} dust - μg/m³
 * @property {number} uvIndex
 *
 * @typedef {Object} HistoryDay
 * @property {string} date
 * @property {number|null} weatherCode
 * @property {number|null} tempMax
 * @property {number|null} tempMin
 * @property {number|null} tempMean
 * @property {number|null} precipitationSum
 * @property {number|null} rainSum
 * @property {number|null} windSpeedMax
 * @property {number|null} sunshineDuration - detik
 */
