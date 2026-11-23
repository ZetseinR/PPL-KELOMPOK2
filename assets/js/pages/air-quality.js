/**
 * @file air-quality.js — Entry point halaman Kualitas Udara.
 * @owner Developer 2
 *
 * STARTER dari Maintainer: alur init → lokasi → load data → render/error
 * sudah berjalan. Ganti isi renderAirQuality() dengan tampilan final.
 *
 * Ide fitur: gauge AQI (European & US), kartu tiap polutan, saran kesehatan
 * sesuai kategori, tren AQI per jam 3 hari ke depan.
 */

import { getAirQuality } from '../shared/api.js';
import { resolveLocation, formatLocationName } from '../shared/geocoding.js';
import { renderNavbar, renderFooter } from '../shared/navigation.js';
import {
  escapeHTML, getAqiCategory, formatNumber, formatTime,
  showLoading, showError, showEmpty, clearLoading, getErrorMessage,
} from '../shared/utils.js';

const els = {
  subtitle: document.getElementById('page-subtitle'),
  content: document.getElementById('page-content'),
};

let activeRequest = 0;

/**
 * TODO(Developer 2): ganti dengan tampilan final halaman Air Quality.
 * @param {Awaited<ReturnType<typeof getAirQuality>>} data
 */
function renderAirQuality(data) {
  const { current, units } = data;
  if (!current) {
    showEmpty(els.content, 'Data kualitas udara tidak tersedia untuk lokasi ini.');
    return;
  }
  const category = getAqiCategory(current.europeanAqi);
  const pollutants = [
    ['PM2.5', current.pm2_5, units.pm2_5],
    ['PM10', current.pm10, units.pm10],
    ['CO', current.co, units.co],
    ['NO₂', current.no2, units.no2],
    ['SO₂', current.so2, units.so2],
    ['O₃', current.o3, units.o3],
  ];
  els.content.innerHTML = `
    <p class="notice">Starter: data berhasil dimuat (${data.hourly.length} jam prakiraan). Ganti tampilan ini di <code>renderAirQuality()</code>.</p>
    <div class="card section">
      <p class="card__subtitle">European AQI · ${formatTime(current.time)}</p>
      <p><strong style="font-size: 2rem">${formatNumber(current.europeanAqi)}</strong>
        <span class="badge" style="background:${category.color};color:#fff">${escapeHTML(category.label)}</span></p>
    </div>
    <div class="table-wrapper section">
      <table class="table">
        <thead><tr><th>Polutan</th><th>Nilai</th><th>Satuan</th></tr></thead>
        <tbody>
          ${pollutants.map(([name, value, unit]) => `
            <tr><td>${name}</td><td>${formatNumber(value, 1)}</td><td>${escapeHTML(unit ?? '')}</td></tr>`).join('')}
        </tbody>
      </table>
    </div>`;
  clearLoading(els.content);
}

async function loadPage(location) {
  const requestId = ++activeRequest;
  els.subtitle.textContent = `Kualitas udara di ${formatLocationName(location)}`;
  showLoading(els.content, 'Memuat data kualitas udara…');
  try {
    const data = await getAirQuality(location.latitude, location.longitude, { days: 3 });
    if (requestId !== activeRequest) return;
    renderAirQuality(data);
  } catch (error) {
    if (requestId !== activeRequest) return;
    console.error('[air-quality] gagal memuat:', error);
    showError(els.content, getErrorMessage(error), () => loadPage(location));
  }
}

function init() {
  renderNavbar({ activePage: 'air-quality', onLocationChange: loadPage });
  renderFooter();
  loadPage(resolveLocation());
}

init();
