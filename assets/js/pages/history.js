/**
 * @file history.js — Entry point halaman Riwayat Cuaca.
 * @owner Developer 3
 *
 * STARTER dari Maintainer: alur init → lokasi → load data → render/error
 * sudah berjalan dengan rentang default 30 hari. Ganti isi renderHistory()
 * dengan tampilan final.
 *
 * Ide fitur: form pilih rentang tanggal, tabel/grafik suhu & curah hujan,
 * statistik (rata-rata, hari terpanas, total hujan).
 *
 * Catatan: data arsip tertinggal ±HISTORY_DATA_DELAY_DAYS hari, jadi
 * tanggal akhir default dibuat mundur beberapa hari dari hari ini.
 */

import { getWeatherHistory, HISTORY_DATA_DELAY_DAYS } from '../shared/api.js';
import { resolveLocation, formatLocationName } from '../shared/geocoding.js';
import { renderNavbar, renderFooter } from '../shared/navigation.js';
import {
  escapeHTML, getWeatherInfo, formatTemperature, formatNumber, formatDate,
  toISODate, addDays, showLoading, showError, showEmpty, clearLoading, getErrorMessage,
} from '../shared/utils.js';

const els = {
  subtitle: document.getElementById('page-subtitle'),
  content: document.getElementById('page-content'),
};

let activeRequest = 0;

/** Rentang default: 30 hari, berakhir HISTORY_DATA_DELAY_DAYS hari yang lalu. */
function getDefaultRange() {
  const end = addDays(new Date(), -HISTORY_DATA_DELAY_DAYS);
  const start = addDays(end, -29);
  return { startDate: toISODate(start), endDate: toISODate(end) };
}

/**
 * TODO(Developer 3): ganti dengan tampilan final halaman History.
 * @param {Awaited<ReturnType<typeof getWeatherHistory>>} data
 * @param {{ startDate: string, endDate: string }} range
 */
function renderHistory(data, range) {
  if (data.daily.length === 0) {
    showEmpty(els.content, 'Tidak ada data riwayat untuk rentang ini.');
    return;
  }
  els.content.innerHTML = `
    <p class="notice">Starter: ${data.daily.length} hari data (${formatDate(range.startDate, { day: 'numeric', month: 'short' })} – ${formatDate(range.endDate, { day: 'numeric', month: 'short', year: 'numeric' })}) berhasil dimuat.</p>
    <div class="table-wrapper section">
      <table class="table">
        <thead><tr><th>Tanggal</th><th>Cuaca</th><th>Maks</th><th>Min</th><th>Rata-rata</th><th>Hujan</th></tr></thead>
        <tbody>
          ${data.daily.slice().reverse().map((day) => {
            const { label, icon } = getWeatherInfo(day.weatherCode);
            return `<tr>
              <td>${formatDate(day.date, { weekday: 'short', day: 'numeric', month: 'short' })}</td>
              <td>${icon} ${escapeHTML(label)}</td>
              <td>${formatTemperature(day.tempMax)}</td>
              <td>${formatTemperature(day.tempMin)}</td>
              <td>${formatTemperature(day.tempMean)}</td>
              <td>${formatNumber(day.precipitationSum, 1)} mm</td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>`;
  clearLoading(els.content);
}

async function loadPage(location, range = getDefaultRange()) {
  const requestId = ++activeRequest;
  els.subtitle.textContent = `Riwayat cuaca ${formatLocationName(location)}`;
  showLoading(els.content, 'Memuat data riwayat…');
  try {
    const data = await getWeatherHistory(location.latitude, location.longitude, range.startDate, range.endDate);
    if (requestId !== activeRequest) return;
    renderHistory(data, range);
  } catch (error) {
    if (requestId !== activeRequest) return;
    console.error('[history] gagal memuat:', error);
    showError(els.content, getErrorMessage(error), () => loadPage(location, range));
  }
}

function init() {
  renderNavbar({ activePage: 'history', onLocationChange: (location) => loadPage(location) });
  renderFooter();
  loadPage(resolveLocation());
}

init();
