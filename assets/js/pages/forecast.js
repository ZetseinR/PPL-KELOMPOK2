/**
 * @file forecast.js — Entry point halaman Prakiraan Cuaca.
 * @owner Developer 1
 *
 * STARTER dari Maintainer: alur init → lokasi → load data → render/error
 * sudah berjalan. Ganti isi renderForecast() dengan tampilan final.
 *
 * Ide fitur: kartu 7 hari, daftar/grafik per jam (24 jam), detail per hari
 * (angin, UV, matahari terbit/terbenam), pilihan 3/7/14 hari.
 */

import { getForecast } from '../shared/api.js';
import { resolveLocation, formatLocationName } from '../shared/geocoding.js';
import { renderNavbar, renderFooter } from '../shared/navigation.js';
import {
  escapeHTML, getWeatherInfo, formatTemperature, formatNumber, formatDate,
  showLoading, showError, showEmpty, clearLoading, getErrorMessage,
} from '../shared/utils.js';

const els = {
  subtitle: document.getElementById('page-subtitle'),
  content: document.getElementById('page-content'),
};

let activeRequest = 0;

/**
 * TODO(Developer 1): ganti dengan tampilan final halaman Forecast.
 * @param {Awaited<ReturnType<typeof getForecast>>} data
 */
function renderForecast(data) {
  if (data.daily.length === 0) {
    showEmpty(els.content, 'Data prakiraan tidak tersedia.');
    return;
  }
  els.content.innerHTML = `
    <p class="notice">Starter: data ${data.daily.length} hari & ${data.hourly.length} jam berhasil dimuat. </p>
    <div class="table-wrapper section">
      <table class="table">
        <thead><tr><th>Tanggal</th><th>Cuaca</th><th>Maks</th><th>Min</th><th>Peluang hujan</th></tr></thead>
        <tbody>
          ${data.daily.map((day) => {
            const { label, icon } = getWeatherInfo(day.weatherCode);
            return `<tr>
              <td>${formatDate(day.date)}</td>
              <td>${icon} ${escapeHTML(label)}</td>
              <td>${formatTemperature(day.tempMax)}</td>
              <td>${formatTemperature(day.tempMin)}</td>
              <td>${formatNumber(day.precipitationProbMax)}%</td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>`;
  clearLoading(els.content);
}

async function loadPage(location) {
  const requestId = ++activeRequest;
  els.subtitle.textContent = `Prakiraan untuk ${formatLocationName(location)}`;
  showLoading(els.content, 'Memuat prakiraan cuaca…');
  try {
    const data = await getForecast(location.latitude, location.longitude, { days: 7 });
    if (requestId !== activeRequest) return; // lokasi sudah berganti
    renderForecast(data);
  } catch (error) {
    if (requestId !== activeRequest) return;
    console.error('[forecast] gagal memuat:', error);
    showError(els.content, getErrorMessage(error), () => loadPage(location));
  }
}

function init() {
  renderNavbar({ activePage: 'forecast', onLocationChange: loadPage });
  renderFooter();
  loadPage(resolveLocation());
}

init();
