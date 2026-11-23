/**
 * @file home.js — Entry point halaman Dashboard (index.html).
 * @owner Maintainer
 *
 * Menampilkan ringkasan: cuaca saat ini, kualitas udara, 3 hari ke depan,
 * dan tautan ke halaman fitur. Setiap bagian punya loading & error sendiri,
 * jadi bila API kualitas udara gagal, ringkasan cuaca tetap tampil.
 */

import { getForecast, getAirQuality } from '../shared/api.js';
import { resolveLocation, formatLocationName } from '../shared/geocoding.js';
import { renderNavbar, renderFooter, buildPageUrl } from '../shared/navigation.js';
import {
  escapeHTML, getWeatherInfo, getAqiCategory, getWindDirection,
  formatTemperature, formatNumber, formatDate, formatTime, toISODate,
  showLoading, showError, showEmpty, clearLoading, getErrorMessage,
} from '../shared/utils.js';

const els = {
  subtitle: document.getElementById('page-subtitle'),
  current: document.getElementById('weather-current'),
  airQuality: document.getElementById('air-quality-summary'),
  forecast: document.getElementById('forecast-summary'),
  features: document.getElementById('feature-links'),
};

/** Mencegah respons lama menimpa data lokasi yang baru dipilih. */
let activeRequest = 0;

/* ------------------------------------------------------------------ */
/* Render                                                              */
/* ------------------------------------------------------------------ */

function renderCurrentWeather({ current, daily, units }) {
  const today = daily[0] ?? {};
  const { label, icon } = getWeatherInfo(current.weatherCode, current.isDay);
  const windUnit = units.current.windSpeed ?? 'km/h';

  els.current.innerHTML = `
    <div class="hero__top">
      <span class="hero__icon" aria-hidden="true">${icon}</span>
      <div>
        <p class="hero__temp">${formatTemperature(current.temperature)}</p>
        <p class="hero__label">${escapeHTML(label)}</p>
      </div>
      <div class="hero__range">
        <span>↑ ${formatTemperature(today.tempMax)}</span>
        <span>↓ ${formatTemperature(today.tempMin)}</span>
      </div>
    </div>
    <p class="hero__meta">Terasa seperti ${formatTemperature(current.feelsLike)} · Diperbarui ${formatTime(current.time)}</p>
    <dl class="hero__stats">
      <div class="stat"><dt class="stat__label">Kelembapan</dt><dd class="stat__value">${formatNumber(current.humidity)}%</dd></div>
      <div class="stat"><dt class="stat__label">Angin</dt><dd class="stat__value">${formatNumber(current.windSpeed)} ${escapeHTML(windUnit)} <small>${getWindDirection(current.windDirection)}</small></dd></div>
      <div class="stat"><dt class="stat__label">Peluang hujan</dt><dd class="stat__value">${formatNumber(today.precipitationProbMax)}%</dd></div>
      <div class="stat"><dt class="stat__label">Indeks UV</dt><dd class="stat__value">${formatNumber(today.uvIndexMax, 1)}</dd></div>
      <div class="stat"><dt class="stat__label">Matahari terbit</dt><dd class="stat__value">${formatTime(today.sunrise)}</dd></div>
      <div class="stat"><dt class="stat__label">Terbenam</dt><dd class="stat__value">${formatTime(today.sunset)}</dd></div>
    </dl>`;
  clearLoading(els.current);
}

function dayLabel(dateISO, index) {
  if (index === 0) return 'Hari ini';
  if (index === 1) return 'Besok';
  return formatDate(dateISO, { weekday: 'long' });
}

function renderForecastSummary(daily) {
  const days = daily.slice(0, 3);
  if (days.length === 0) {
    showEmpty(els.forecast, 'Prakiraan harian tidak tersedia.');
    return;
  }
  els.forecast.innerHTML = `
    <div class="grid grid--3">
      ${days.map((day, i) => {
        const { label, icon } = getWeatherInfo(day.weatherCode);
        return `
          <article class="card day-card">
            <div>
              <h3 class="day-card__name">${dayLabel(day.date, i)}</h3>
              <p class="card__subtitle">${formatDate(day.date, { day: 'numeric', month: 'short' })}</p>
            </div>
            <span class="day-card__icon" aria-hidden="true">${icon}</span>
            <p class="day-card__label">${escapeHTML(label)}</p>
            <p class="day-card__temp">
              <strong>${formatTemperature(day.tempMax)}</strong>
              <span class="text-muted">${formatTemperature(day.tempMin)}</span>
            </p>
            <p class="text-muted text-sm">💧 ${formatNumber(day.precipitationProbMax)}% · 🌧️ ${formatNumber(day.precipitationSum, 1)} mm</p>
          </article>`;
      }).join('')}
    </div>`;
  clearLoading(els.forecast);
}

function renderAirQuality({ current }, location) {
  const category = getAqiCategory(current.europeanAqi, 'european');
  els.airQuality.innerHTML = `
    <div class="card__header">
      <div>
        <h2 class="card__title">Kualitas Udara</h2>
        <p class="card__subtitle">European AQI · ${formatTime(current.time)}</p>
      </div>
    </div>
    <div class="aqi-summary">
      <div class="aqi-summary__gauge" style="--aqi-color: ${category.color}">
        <span class="aqi-summary__value">${formatNumber(current.europeanAqi)}</span>
      </div>
      <div>
        <span class="badge" style="background: ${category.color}; color: #fff">${escapeHTML(category.label)}</span>
        <p class="text-muted text-sm aqi-summary__us">US AQI: ${formatNumber(current.usAqi)}</p>
      </div>
    </div>
    <dl class="aqi-summary__pollutants">
      <div class="stat"><dt class="stat__label">PM2.5</dt><dd class="stat__value">${formatNumber(current.pm2_5, 1)}</dd></div>
      <div class="stat"><dt class="stat__label">PM10</dt><dd class="stat__value">${formatNumber(current.pm10, 1)}</dd></div>
      <div class="stat"><dt class="stat__label">O₃</dt><dd class="stat__value">${formatNumber(current.o3, 0)}</dd></div>
    </dl>
    <p class="text-muted text-sm">Satuan polutan: μg/m³</p>
    <a class="btn btn--ghost aqi-summary__link" href="${buildPageUrl('air-quality', location)}">Detail kualitas udara →</a>`;
  clearLoading(els.airQuality);
}

function renderFeatureLinks(location) {
  const features = [
    { page: 'forecast', icon: '📅', title: 'Prakiraan Cuaca', text: 'Prakiraan per jam dan 7 hari ke depan.' },
    { page: 'air-quality', icon: '🍃', title: 'Kualitas Udara', text: 'Indeks AQI, PM2.5, PM10, dan polutan lain.' },
    { page: 'history', icon: '📊', title: 'Riwayat Cuaca', text: 'Data cuaca harian di masa lalu.' },
  ];
  els.features.innerHTML = features.map((f) => `
    <a class="card card--link feature-card" href="${buildPageUrl(f.page, location)}">
      <span class="feature-card__icon" aria-hidden="true">${f.icon}</span>
      <h3>${f.title}</h3>
      <p class="text-muted text-sm">${f.text}</p>
    </a>`).join('');

  document.querySelectorAll('[data-link]').forEach((link) => {
    link.href = buildPageUrl(link.dataset.link, location);
  });
}

/* ------------------------------------------------------------------ */
/* Load data                                                           */
/* ------------------------------------------------------------------ */

async function loadWeather(location, requestId) {
  showLoading(els.current, 'Memuat cuaca saat ini…');
  showLoading(els.forecast, 'Memuat prakiraan…');
  try {
    const data = await getForecast(location.latitude, location.longitude, { days: 3 });
    if (requestId !== activeRequest) return;
    renderCurrentWeather(data);
    renderForecastSummary(data.daily);
  } catch (error) {
    if (requestId !== activeRequest) return;
    console.error('[home] getForecast gagal:', error);
    const retry = () => loadWeather(location, requestId);
    showError(els.current, getErrorMessage(error), retry);
    showError(els.forecast, getErrorMessage(error));
  }
}

async function loadAirQuality(location, requestId) {
  showLoading(els.airQuality, 'Memuat kualitas udara…');
  try {
    const data = await getAirQuality(location.latitude, location.longitude, { days: 1 });
    if (requestId !== activeRequest) return;
    renderAirQuality(data, location);
  } catch (error) {
    if (requestId !== activeRequest) return;
    console.error('[home] getAirQuality gagal:', error);
    showError(els.airQuality, getErrorMessage(error), () => loadAirQuality(location, requestId));
  }
}

async function loadPage(location) {
  const requestId = ++activeRequest;
  els.subtitle.textContent = `${formatLocationName(location)} · ${formatDate(toISODate(new Date()), {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })}`;
  document.title = `${location.name} | Weather Dashboard`;
  renderFeatureLinks(location);
  await Promise.all([loadWeather(location, requestId), loadAirQuality(location, requestId)]);
}

/* ------------------------------------------------------------------ */
/* Init                                                                */
/* ------------------------------------------------------------------ */

function init() {
  renderNavbar({ activePage: 'home', onLocationChange: loadPage });
  renderFooter();
  loadPage(resolveLocation());
}

init();
