# 🌤️ Weather Dashboard

Aplikasi web cuaca multi-halaman: **Dashboard**, **Prakiraan Cuaca**, **Kualitas Udara**, dan **Riwayat Cuaca**.
Dibangun dengan HTML, CSS, dan JavaScript murni (ES Modules) menggunakan data dari [Open-Meteo](https://open-meteo.com/) (gratis, tanpa API key).

Project ini dikerjakan paralel oleh 4 anggota. Setiap anggota memiliki halaman dan file sendiri sehingga kontribusi terlihat jelas di commit history dan Pull Request.

---

## Daftar Isi

1. [Menjalankan Project](#1-menjalankan-project)
2. [Struktur Folder](#2-struktur-folder)
3. [Pembagian Tugas & Kepemilikan File](#3-pembagian-tugas--kepemilikan-file)
4. [Arsitektur & Hubungan Antarfile](#4-arsitektur--hubungan-antarfile)
5. [Dokumentasi Fungsi Bersama (shared)](#5-dokumentasi-fungsi-bersama-shared)
6. [Pola Entry Point Halaman](#6-pola-entry-point-halaman)
7. [Workflow GitHub](#7-workflow-github)
8. [Aturan Menghindari Merge Conflict](#8-aturan-menghindari-merge-conflict)
9. [Checklist Sebelum Pull Request](#9-checklist-sebelum-pull-request)

---

## 1. Menjalankan Project

ES Modules **tidak berjalan** bila `index.html` dibuka langsung (`file://`). Jalankan lewat server lokal:

| Cara | Perintah |
|---|---|
| VS Code Live Server | Klik kanan `index.html` → **Open with Live Server** |
| Node.js | `npx serve .` |
| Python | `python -m http.server 5500` lalu buka `http://localhost:5500` |

Setiap halaman bisa diuji mandiri dengan membuka URL-nya langsung, misalnya:

```
http://localhost:5500/pages/forecast/?lat=-6.9175&lon=107.6191&name=Bandung
http://localhost:5500/pages/air-quality/
http://localhost:5500/pages/history/
```

Tanpa parameter, halaman memakai lokasi terakhir yang dipilih (localStorage). Jika belum ada, dipakai **Jakarta**.

## 2. Struktur Folder

```
weather-dashboard/
├── index.html                       # Dashboard
├── README.md
├── .github/
│   ├── CODEOWNERS                   # reviewer wajib per file
│   ├── pull_request_template.md
│   └── ISSUE_TEMPLATE/shared-request.md
├── pages/
│   ├── forecast/index.html
│   ├── air-quality/index.html
│   └── history/index.html
└── assets/
    ├── css/
    │   ├── global.css               # variabel, reset, tipografi, layout
    │   ├── components.css           # navbar, card, button, state, tabel, dll
    │   ├── responsive.css           # breakpoint global
    │   └── pages/                   # CSS khusus per halaman
    │       ├── home.css
    │       ├── forecast.css
    │       ├── air-quality.css
    │       └── history.css
    └── js/
        ├── shared/                  # dipakai semua halaman (owner: Maintainer)
        │   ├── api.js
        │   ├── geocoding.js
        │   ├── navigation.js
        │   └── utils.js
        └── pages/                   # 1 entry point per halaman
            ├── home.js
            ├── forecast.js
            ├── air-quality.js
            └── history.js
```

## 3. Pembagian Tugas & Kepemilikan File

| Peran | Halaman | File milik |
|---|---|---|
| **Maintainer** | Dashboard | `index.html`, `assets/js/pages/home.js`, `assets/js/shared/*`, `assets/css/global.css`, `components.css`, `responsive.css`, `assets/css/pages/home.css`, `README.md`, `.github/*` |
| **Developer 1** | Prakiraan Cuaca | `pages/forecast/index.html`, `assets/js/pages/forecast.js`, `assets/css/pages/forecast.css` |
| **Developer 2** | Kualitas Udara | `pages/air-quality/index.html`, `assets/js/pages/air-quality.js`, `assets/css/pages/air-quality.css` |
| **Developer 3** | Riwayat Cuaca | `pages/history/index.html`, `assets/js/pages/history.js`, `assets/css/pages/history.css` |

> Isi nama & username GitHub anggota di sini:
>
> | Peran | Nama | GitHub |
> |---|---|---|
> | Maintainer | … | @… |
> | Developer 1 | … | @… |
> | Developer 2 | … | @… |
> | Developer 3 | … | @… |

## 4. Arsitektur & Hubungan Antarfile

```
             Open-Meteo API (forecast, air-quality, archive, geocoding)
                                   ▲
                                   │ fetch (HANYA dari shared/)
        ┌──────────────────────────┴───────────────────────────┐
        │  shared/api.js  ◄── shared/geocoding.js ◄── shared/navigation.js
        │                                    shared/utils.js (dipakai semua)
        └───────▲──────────────▲───────────────▲──────────────▲─┘
                │              │               │              │
            home.js      forecast.js    air-quality.js    history.js
                ▲              ▲               ▲              ▲
           index.html   pages/forecast/  pages/air-quality/  pages/history/
```

Aturan dependensi:

- `pages/*.js` → boleh import dari `shared/`.
- `shared/` → **tidak boleh** import dari `pages/`.
- Antar-halaman **tidak boleh** saling import. Logika yang dibutuhkan 2+ halaman diajukan untuk dipindah ke `shared/`.
- Halaman **tidak boleh** memanggil `fetch()` ke Open-Meteo secara langsung. Semua lewat `api.js` / `geocoding.js`.

**Lokasi aktif** dibawa antarhalaman lewat query string (`?lat=&lon=&name=&admin1=&country=`) dan disimpan juga di localStorage. Pencarian kota ada di navbar (dibuat sekali di `navigation.js`), jadi halaman cukup menerima callback `onLocationChange`.

## 5. Dokumentasi Fungsi Bersama (shared)

Semua fungsi juga didokumentasikan dengan JSDoc di file masing-masing (hover di VS Code untuk melihatnya).

### 5.1 `assets/js/shared/api.js`

Semua fungsi `async` mengembalikan data yang **sudah dinormalisasi**: array paralel Open-Meteo diubah menjadi array of objects dengan nama field camelCase.

| Fungsi | Parameter | Return |
|---|---|---|
| `getCurrentWeather(lat, lon)` | `number, number` | `{ timezone, current, units }` |
| `getForecast(lat, lon, { days })` | `days`: 1–16, default 7 | `{ timezone, current, hourly[], daily[], units: { current, hourly, daily } }` |
| `getAirQuality(lat, lon, { days })` | `days`: 1–7, default 3 | `{ timezone, current, hourly[], units }` |
| `getWeatherHistory(lat, lon, startDate, endDate)` | tanggal `'YYYY-MM-DD'` | `{ timezone, daily[], units }` |
| `fetchJSON(url, { timeout })` | URL lengkap | JSON (dipakai internal) |
| `zipSeries(series, fieldMap, timeKey)` | — | helper normalisasi (internal) |
| `class ApiError` | `message, status, detail` | error standar |
| `HISTORY_MIN_DATE` | konstanta | `'1940-01-01'` |
| `HISTORY_DATA_DELAY_DAYS` | konstanta | `5` (data arsip tertinggal ±5 hari) |

**Bentuk data**

```js
// current (getForecast / getCurrentWeather)
{ time: '2026-11-23T14:00', temperature: 31.2, feelsLike: 35.1, humidity: 62,
  precipitation: 0, weatherCode: 2, isDay: 1, windSpeed: 11.5, windDirection: 320, pressure: 1009.4 }

// hourly[i] (getForecast)
{ time: '2026-11-23T15:00', temperature: 30.8, feelsLike: 34.2, humidity: 65,
  precipitationProb: 40, precipitation: 0.2, weatherCode: 80, windSpeed: 12.1, isDay: 1 }

// daily[i] (getForecast)
{ date: '2026-11-23', weatherCode: 95, tempMax: 32.4, tempMin: 24.9, precipitationSum: 12.3,
  precipitationProbMax: 85, windSpeedMax: 17.3, uvIndexMax: 9.1,
  sunrise: '2026-11-23T05:29', sunset: '2026-11-23T17:56' }

// current / hourly[i] (getAirQuality) — satuan μg/m³
{ time, europeanAqi: 48, usAqi: 92, pm2_5: 31.5, pm10: 44.0, co: 410, no2: 28.1, so2: 12.0, o3: 61, dust: 3, uvIndex: 6.2 }

// daily[i] (getWeatherHistory) — nilai bisa null untuk hari-hari terakhir
{ date: '2026-10-01', weatherCode: 63, tempMax: 32.1, tempMin: 24.6, tempMean: 27.8,
  precipitationSum: 8.4, rainSum: 8.4, windSpeedMax: 14.2, sunshineDuration: 25200 }
```

**Contoh**

```js
import { getForecast, getAirQuality, getWeatherHistory } from '../shared/api.js';

const { current, daily } = await getForecast(-6.2146, 106.8451, { days: 7 });
console.log(current.temperature, daily[0].tempMax);

const aq = await getAirQuality(-6.2146, 106.8451);
console.log(aq.current.europeanAqi);

const history = await getWeatherHistory(-6.2146, 106.8451, '2026-10-01', '2026-10-31');
console.log(history.daily.length); // 31
```

**Error handling.** Semua fungsi melempar `ApiError` dengan `message` berbahasa Indonesia yang aman ditampilkan:

| `status` | Arti |
|---|---|
| `'timeout'` | server tidak merespons dalam batas waktu |
| `'network'` | tidak ada koneksi / CORS / DNS |
| `'invalid'` | parameter salah (koordinat, format/rentang tanggal) |
| `'parse'` | respons bukan JSON |
| `400`, `429`, `5xx` | error HTTP dari server (`detail` berisi alasan dari Open-Meteo) |

### 5.2 `assets/js/shared/geocoding.js`

| Fungsi | Parameter | Return |
|---|---|---|
| `searchLocation(query, { count, language })` | nama kota (min. 2 huruf), default `count=5`, `language='id'` | `Promise<Location[]>` |
| `getBrowserLocation({ timeout })` | — | `Promise<Location>` (`name: 'Lokasi Saya'`) |
| `resolveLocation()` | — | `Location` (URL → localStorage → Jakarta) |
| `saveLocation(location)` | `Location` | simpan ke localStorage + update URL |
| `locationToParams(location)` | `Location` | `URLSearchParams` |
| `formatLocationName(location)` | `Location` | `'Bandung, Jawa Barat, Indonesia'` |
| `DEFAULT_LOCATION` | konstanta | Jakarta |

```js
// Location
{ name: 'Bandung', admin1: 'Jawa Barat', country: 'Indonesia',
  latitude: -6.92222, longitude: 107.60694, timezone: 'Asia/Jakarta' }
```

### 5.3 `assets/js/shared/navigation.js`

| Fungsi | Parameter | Keterangan |
|---|---|---|
| `renderNavbar({ activePage, onLocationChange })` | `activePage`: `'home' \| 'forecast' \| 'air-quality' \| 'history'` | Render menu + pencarian kota ke `#app-header`. `onLocationChange(location)` dipanggil setelah kota baru dipilih. |
| `renderFooter()` | — | Render footer ke `#app-footer` |
| `buildPageUrl(pageId, location?)` | id halaman, `Location` | URL halaman lengkap dengan query lokasi |
| `PAGES` | konstanta | daftar halaman (id, label, icon, path) |

### 5.4 `assets/js/shared/utils.js`

| Fungsi | Contoh |
|---|---|
| `getWeatherInfo(code, isDay?)` | `getWeatherInfo(61)` → `{ label: 'Hujan ringan', icon: '🌦️' }` |
| `getAqiCategory(value, scale?)` | `getAqiCategory(35)` → `{ label: 'Cukup', level: 2, color: '#a3d65c' }`. `scale`: `'european'` (default) / `'us'` |
| `formatTemperature(value, unit?)` | `formatTemperature(28.4)` → `'28°C'` |
| `formatNumber(value, decimals?)` | `formatNumber(12.345, 1)` → `'12,3'`. `null` → `'–'` |
| `formatDate(value, options?)` | `formatDate('2026-11-23')` → `'Senin, 23 November'` |
| `formatTime(value)` | `formatTime('2026-11-23T14:00')` → `'14.00'` |
| `toISODate(date)` | `toISODate(new Date())` → `'2026-11-23'` |
| `addDays(date, n)` | `addDays(new Date(), -7)` |
| `getWindDirection(deg)` | `getWindDirection(320)` → `'Barat Laut'` |
| `escapeHTML(text)` | **Wajib** untuk teks dari API/user sebelum masuk `innerHTML` |
| `showLoading(el, text?)` | spinner standar |
| `showError(el, message, onRetry?)` | pesan error + tombol "Coba lagi" |
| `showEmpty(el, message?)` | pesan data kosong |
| `clearLoading(el)` | hapus status `aria-busy` setelah render |
| `getErrorMessage(error)` | pesan aman dari error apa pun |
| `debounce(fn, ms?)` | menunda pemanggilan (mis. input) |

### 5.5 Komponen CSS bersama

Gunakan class ini daripada membuat ulang: `.container`, `.page-header`, `.section`, `.grid .grid--2/3/4`, `.card`, `.card__title`, `.card--link`, `.btn .btn--primary/.btn--ghost`, `.badge`, `.stat .stat__label .stat__value`, `.table-wrapper .table`, `.notice`, `.form-field .form-label .form-input`, `.text-muted`, `.visually-hidden`.
Variabel desain ada di `:root` dalam `global.css` (warna, spasi, radius, shadow).

## 6. Pola Entry Point Halaman

Setiap file di `assets/js/pages/` mengikuti pola yang sama:

```js
import { getForecast } from '../shared/api.js';
import { resolveLocation } from '../shared/geocoding.js';
import { renderNavbar, renderFooter } from '../shared/navigation.js';
import { showLoading, showError, getErrorMessage } from '../shared/utils.js';

const content = document.getElementById('page-content');
let activeRequest = 0;

async function loadPage(location) {
  const requestId = ++activeRequest;
  showLoading(content, 'Memuat…');
  try {
    const data = await getForecast(location.latitude, location.longitude);
    if (requestId !== activeRequest) return;   // abaikan respons lama
    render(data);                               // fungsi milik halaman
  } catch (error) {
    if (requestId !== activeRequest) return;
    showError(content, getErrorMessage(error), () => loadPage(location));
  }
}

renderNavbar({ activePage: 'forecast', onLocationChange: loadPage });
renderFooter();
loadPage(resolveLocation());
```

Kerangka HTML halaman:

```html
<link rel="stylesheet" href="../../assets/css/global.css">
<link rel="stylesheet" href="../../assets/css/components.css">
<link rel="stylesheet" href="../../assets/css/responsive.css">
<link rel="stylesheet" href="../../assets/css/pages/forecast.css">

<header id="app-header"></header>   <!-- navbar otomatis -->
<main id="app"> … <div id="page-content"></div> </main>
<footer id="app-footer"></footer>   <!-- footer otomatis -->
<script type="module" src="../../assets/js/pages/forecast.js"></script>
```

Bila butuh library tambahan (mis. Chart.js), import di file halaman sendiri via ESM CDN:

```js
import Chart from 'https://cdn.jsdelivr.net/npm/chart.js@4/auto/+esm';
```

## 7. Workflow GitHub

### Branch

- `main`: branch utama, selalu bisa dijalankan. **Diproteksi**: tidak boleh push langsung, wajib lewat Pull Request + 1 approval.
- Satu branch per halaman/fitur:

| Anggota | Branch |
|---|---|
| Maintainer | `feature/dashboard`, `feature/shared-<nama>` (mis. `feature/shared-api-uv`) |
| Developer 1 | `feature/forecast` |
| Developer 2 | `feature/air-quality` |
| Developer 3 | `feature/history` |
| Perbaikan bug | `fix/<halaman>-<deskripsi>` |

Untuk fitur besar, boleh dipecah: `feature/forecast-hourly`, `feature/forecast-chart`, dst.

### Alur kerja harian

```bash
# 1. Pertama kali
git clone https://github.com/<org>/weather-dashboard.git
cd weather-dashboard

# 2. Buat branch dari main terbaru
git checkout main
git pull origin main
git checkout -b feature/forecast

# 3. Kerjakan HANYA file milik sendiri, commit kecil & sering
git add assets/js/pages/forecast.js pages/forecast/index.html
git commit -m "feat(forecast): tampilkan kartu prakiraan 7 hari"

# 4. Sinkronkan dengan main sebelum push / PR
git fetch origin
git rebase origin/main          # atau: git merge origin/main

# 5. Push & buka Pull Request ke main
git push -u origin feature/forecast
```

### Konvensi commit (Conventional Commits)

```
<tipe>(<scope>): <deskripsi singkat>
```

| Tipe | Kapan |
|---|---|
| `feat` | fitur baru |
| `fix` | perbaikan bug |
| `style` | perubahan tampilan/CSS tanpa mengubah logika |
| `refactor` | merapikan kode tanpa mengubah perilaku |
| `docs` | dokumentasi |
| `chore` | konfigurasi, file pendukung |

Scope: `dashboard`, `forecast`, `air-quality`, `history`, `api`, `geocoding`, `navigation`, `utils`, `css`.
Contoh: `feat(history): tambah filter rentang tanggal`, `fix(api): tangani timeout archive`.

### Pull Request

1. Buka PR ke `main`. Template otomatis muncul. Isi semuanya, termasuk screenshot desktop & mobile.
2. Tautkan Issue: `Closes #12`.
3. Minimal **1 approval**. File shared otomatis meminta review Maintainer (lihat `.github/CODEOWNERS`).
4. Setelah disetujui: **Squash and merge**, lalu hapus branch.
5. Anggota lain melakukan `git pull origin main` lalu `git rebase origin/main` di branch masing-masing.

### Meminta perubahan file shared

Jangan mengedit `assets/js/shared/*` atau CSS global sendiri. Buat **Issue** dengan template *Shared Request* (label `shared-request`), jelaskan fungsi/field yang dibutuhkan. Maintainer mengerjakannya di branch `feature/shared-…`, lalu developer melakukan rebase.

### Pengaturan repo (dilakukan Maintainer sekali)

1. **Settings → Branches → Add rule** untuk `main`: centang *Require a pull request before merging*, *Require approvals (1)*, *Require review from Code Owners*.
2. Ganti username di `.github/CODEOWNERS`.
3. Buat label: `shared-request`, `forecast`, `air-quality`, `history`, `dashboard`, `bug`.
4. (Opsional) **Projects** dengan kolom *To Do / In Progress / Review / Done*.
5. (Opsional) **Settings → Pages** → deploy dari `main` agar ada demo online.

## 8. Aturan Menghindari Merge Conflict

1. Edit **hanya** file milik sendiri (lihat tabel kepemilikan).
2. Jangan mengubah `shared/`, `global.css`, `components.css`, `responsive.css` tanpa Issue `shared-request`.
3. Jangan mengganti nama/memindahkan file yang dipakai anggota lain.
4. CSS halaman: prefix semua selector dengan nama halaman (`.forecast-…`, `.aq-…`, `.history-…`).
5. Jangan menulis `fetch()` ke Open-Meteo di file halaman. Pakai fungsi `api.js`.
6. Jangan menyalin fungsi dari `utils.js` ke file halaman. Import saja.
7. Rebase ke `main` minimal sekali sehari dan sebelum membuka PR.
8. Penamaan: `camelCase` untuk variabel/fungsi, `kebab-case` untuk file & class CSS, `UPPER_SNAKE_CASE` untuk konstanta.

## 9. Checklist Sebelum Pull Request

- [ ] Halaman berjalan via server lokal tanpa error di Console.
- [ ] Data diambil dari API sungguhan lewat fungsi shared.
- [ ] Ada tampilan **loading**, **error** (+ coba lagi), dan **data kosong**.
- [ ] Ganti kota lewat navbar → data halaman ikut berganti.
- [ ] Responsif di 375px (mobile), 768px (tablet), dan ≥1200px (desktop).
- [ ] Teks dari API/user melewati `escapeHTML()` sebelum `innerHTML`.
- [ ] Hanya file milik sendiri yang berubah (`git diff --stat origin/main`).
- [ ] Sudah rebase/merge dengan `main` terbaru.

---

Data cuaca © [Open-Meteo.com](https://open-meteo.com/), lisensi CC BY 4.0.
