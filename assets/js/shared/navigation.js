/**
 * @file navigation.js — Navbar (menu + pencarian kota), footer, dan URL antarhalaman.
 * @owner Maintainer
 *
 * Setiap HTML cukup menyediakan <header id="app-header"> dan <footer id="app-footer">.
 * Menambah halaman baru = menambah satu entri di PAGES (koordinasi dengan Maintainer).
 */

import {
  searchLocation, getBrowserLocation, saveLocation, resolveLocation,
  locationToParams, formatLocationName,
} from './geocoding.js';
import { escapeHTML, debounce, getErrorMessage } from './utils.js';

/** Root project, dihitung dari lokasi file ini (assets/js/shared/ → ../../../). */
const ROOT_URL = new URL('../../../', import.meta.url);

/**
 * Daftar halaman aplikasi.
 * @type {ReadonlyArray<{ id: PageId, label: string, icon: string, path: string }>}
 */
export const PAGES = Object.freeze([
  { id: 'home', label: 'Dashboard', icon: '🏠', path: '' },
  { id: 'forecast', label: 'Prakiraan', icon: '📅', path: 'pages/forecast/' },
  { id: 'air-quality', label: 'Kualitas Udara', icon: '🍃', path: 'pages/air-quality/' },
  { id: 'history', label: 'Riwayat', icon: '📊', path: 'pages/history/' },
]);

/** @typedef {'home'|'forecast'|'air-quality'|'history'} PageId */

/**
 * URL halaman tujuan, membawa lokasi aktif sebagai query string.
 * @param {PageId} pageId
 * @param {import('./geocoding.js').Location} [location]
 * @returns {string}
 * @example
 * link.href = buildPageUrl('forecast', location);
 */
export function buildPageUrl(pageId, location) {
  const page = PAGES.find((p) => p.id === pageId);
  if (!page) throw new Error(`Halaman tidak dikenal: ${pageId}`);
  const url = new URL(page.path, ROOT_URL);
  if (location) url.search = locationToParams(location).toString();
  return url.toString();
}

function updateNavLinks(header, location) {
  header.querySelectorAll('[data-page-link]').forEach((link) => {
    link.href = buildPageUrl(link.dataset.pageLink, location);
  });
  const label = header.querySelector('[data-location-label]');
  if (label) label.textContent = formatLocationName(location);
}

/**
 * Render navbar ke <header id="app-header">.
 *
 * @param {{
 *   activePage: PageId,
 *   onLocationChange?: (location: import('./geocoding.js').Location) => void
 * }} options
 *   onLocationChange dipanggil setelah pengguna memilih kota baru
 *   (lokasi sudah disimpan & URL sudah diperbarui).
 *
 * @example
 * renderNavbar({ activePage: 'forecast', onLocationChange: (loc) => loadPage(loc) });
 */
export function renderNavbar({ activePage, onLocationChange } = {}) {
  const header = document.getElementById('app-header');
  if (!header) {
    console.warn('[navigation] Elemen #app-header tidak ditemukan.');
    return;
  }

  const location = resolveLocation();
  header.className = 'navbar';
  header.innerHTML = `
    <a class="skip-link" href="#app">Lewati ke konten utama</a>
    <div class="navbar__inner container">
      <a class="navbar__brand" data-page-link="home" href="#">
        <span aria-hidden="true">🌤️</span> Weather Dashboard
      </a>

      <button class="navbar__toggle" type="button" aria-expanded="false" aria-controls="nav-menu" aria-label="Buka menu">
        <span aria-hidden="true">☰</span>
      </button>

      <nav class="navbar__menu" id="nav-menu" aria-label="Navigasi utama">
        <ul>
          ${PAGES.map((page) => `
            <li>
              <a class="navbar__link${page.id === activePage ? ' is-active' : ''}"
                 data-page-link="${page.id}" href="#"
                 ${page.id === activePage ? 'aria-current="page"' : ''}>
                <span aria-hidden="true">${page.icon}</span> ${page.label}
              </a>
            </li>`).join('')}
        </ul>
      </nav>

      <div class="location-search" role="search">
        <div class="location-search__field">
          <label class="visually-hidden" for="location-input">Cari kota</label>
          <input id="location-input" class="location-search__input" type="search"
                 placeholder="Cari kota…" autocomplete="off" spellcheck="false"
                 role="combobox" aria-autocomplete="list" aria-expanded="false"
                 aria-controls="location-results">
          <button class="location-search__geo" type="button" data-geo title="Gunakan lokasi saya" aria-label="Gunakan lokasi saya">📍</button>
          <ul class="location-search__results" id="location-results" role="listbox" hidden></ul>
        </div>
        <p class="location-search__current">
          <span aria-hidden="true">📌</span> <span data-location-label></span>
        </p>
      </div>
    </div>`;

  updateNavLinks(header, location);
  setupMenuToggle(header);
  setupLocationSearch(header, (newLocation) => {
    saveLocation(newLocation);
    updateNavLinks(header, newLocation);
    if (typeof onLocationChange === 'function') onLocationChange(newLocation);
  });
}

function setupMenuToggle(header) {
  const toggle = header.querySelector('.navbar__toggle');
  const menu = header.querySelector('.navbar__menu');
  toggle.addEventListener('click', () => {
    const open = menu.classList.toggle('is-open');
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', open ? 'Tutup menu' : 'Buka menu');
  });
}

function setupLocationSearch(header, onSelect) {
  const root = header.querySelector('.location-search');
  const input = root.querySelector('.location-search__input');
  const list = root.querySelector('.location-search__results');
  const geoButton = root.querySelector('[data-geo]');

  let results = [];
  let activeIndex = -1;
  let requestId = 0;

  const open = () => { list.hidden = false; input.setAttribute('aria-expanded', 'true'); };
  const close = () => {
    list.hidden = true;
    input.setAttribute('aria-expanded', 'false');
    input.removeAttribute('aria-activedescendant');
    activeIndex = -1;
  };
  const showMessage = (text) => {
    results = [];
    list.innerHTML = `<li class="location-search__message" role="presentation">${escapeHTML(text)}</li>`;
    open();
  };

  const renderResults = () => {
    if (results.length === 0) {
      showMessage('Kota tidak ditemukan.');
      return;
    }
    list.innerHTML = results.map((loc, i) => `
      <li id="location-option-${i}" class="location-search__option${i === activeIndex ? ' is-active' : ''}"
          role="option" aria-selected="${i === activeIndex}" data-index="${i}">
        <strong>${escapeHTML(loc.name)}</strong>
        <small>${escapeHTML([loc.admin1, loc.country].filter(Boolean).join(', '))}</small>
      </li>`).join('');
    if (activeIndex >= 0) input.setAttribute('aria-activedescendant', `location-option-${activeIndex}`);
    open();
  };

  const select = (location) => {
    input.value = '';
    close();
    onSelect(location);
  };

  const runSearch = debounce(async (query) => {
    const id = ++requestId;
    if (query.trim().length < 2) {
      close();
      return;
    }
    showMessage('Mencari…');
    try {
      const found = await searchLocation(query);
      if (id !== requestId) return; // ada pencarian yang lebih baru
      results = found;
      activeIndex = -1;
      renderResults();
    } catch (err) {
      if (id !== requestId) return;
      showMessage(getErrorMessage(err));
    }
  }, 350);

  input.addEventListener('input', () => runSearch(input.value));

  input.addEventListener('keydown', (event) => {
    if (list.hidden || results.length === 0) {
      if (event.key === 'Escape') close();
      return;
    }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const step = event.key === 'ArrowDown' ? 1 : -1;
      activeIndex = (activeIndex + step + results.length) % results.length;
      renderResults();
    } else if (event.key === 'Enter') {
      event.preventDefault();
      select(results[Math.max(activeIndex, 0)]);
    } else if (event.key === 'Escape') {
      close();
    }
  });

  list.addEventListener('mousedown', (event) => {
    const option = event.target.closest('[data-index]');
    if (!option) return;
    event.preventDefault(); // cegah input kehilangan fokus sebelum klik diproses
    select(results[Number(option.dataset.index)]);
  });

  document.addEventListener('click', (event) => {
    if (!root.contains(event.target)) close();
  });

  geoButton.addEventListener('click', async () => {
    geoButton.disabled = true;
    showMessage('Mendeteksi lokasi…');
    try {
      select(await getBrowserLocation());
    } catch (err) {
      showMessage(getErrorMessage(err));
    } finally {
      geoButton.disabled = false;
    }
  });
}

/**
 * Render footer ke <footer id="app-footer">.
 * @example renderFooter();
 */
export function renderFooter() {
  const footer = document.getElementById('app-footer');
  if (!footer) return;
  footer.className = 'footer';
  footer.innerHTML = `
    <div class="container footer__inner">
      <p>Data cuaca: <a href="https://open-meteo.com/" target="_blank" rel="noopener">Open-Meteo.com</a> (CC BY 4.0)</p>
      <p>© ${new Date().getFullYear()} Weather Dashboard</p>
    </div>`;
}
