// --- Core Configuration and Shortcuts ---
const defaultShortcuts = [
    { name: 'YouTube', url: 'https://www.youtube.com' },
    { name: 'GitHub', url: 'https://www.github.com' },
    { name: 'Reddit', url: 'https://www.reddit.com' },
    { name: 'Gmail', url: 'https://mail.google.com' }
];

const defaultBg = "https://picsum.photos/id/10/1920/1080";

// Grab DOM Elements
const shortcutsGrid = document.getElementById('shortcuts-grid');
const settingsBtn = document.getElementById('settings-btn');
const settingsModal = document.getElementById('settings-modal');
const closeModal = document.getElementById('close-modal');
const manageList = document.getElementById('manage-list');

// Wallpaper DOM elements
const bgTypeSelect = document.getElementById('bg-type-select');
const bgRotationGroup = document.getElementById('bg-rotation-group');
const bgIntervalSelect = document.getElementById('bg-interval-select');
const bgWebGroup = document.getElementById('bg-web-group');
const bgLocalGroup = document.getElementById('bg-local-group');
const bgUrlInput = document.getElementById('bg-url-input');
const saveBgUrlBtn = document.getElementById('save-bg-url-btn');
const bgFileInput = document.getElementById('bg-file-input');

// Blur Slider DOM elements
const blurSlider = document.getElementById('blur-slider');
const blurValueDisplay = document.getElementById('blur-value-display');
const resetBlurBtn = document.getElementById('reset-blur-btn');

// Darkness Slider DOM elements
const darknessSlider = document.getElementById('darkness-slider');
const darknessValueDisplay = document.getElementById('darkness-value-display');
const resetDarknessBtn = document.getElementById('reset-darkness-btn');

// Texture Overlay DOM elements
const textureSelect       = document.getElementById('texture-overlay-select');
const textureOpacitySlider   = document.getElementById('texture-opacity-slider');
const textureOpacityDisplay  = document.getElementById('texture-opacity-display');
const textureDensitySlider   = document.getElementById('texture-density-slider');
const textureDensityDisplay  = document.getElementById('texture-density-display');
const textureSlidersWrap     = document.getElementById('texture-sliders-wrap');

// Dark Text Toggle DOM elements
const darkTextToggle = document.getElementById('dark-text-toggle');
const toggleTrack = document.getElementById('toggle-track');
const toggleThumb = document.getElementById('toggle-thumb');

// --- Search Engine Detection ---
// Attempt to match browser's default search engine via chrome.search API
function initSearchEngine() {
    const searchForm = document.getElementById('search-form');
    if (!searchForm) return;

    // Use chrome.search.query to open results in the current tab via the user's
    // default search engine; fall through to the form's action (Google) if unavailable.
    searchForm.addEventListener('submit', function(e) {
        const query = this.querySelector('input[name="q"]').value.trim();
        if (!query) return;

        if (chrome && chrome.search && chrome.search.query) {
            e.preventDefault();
            chrome.search.query({ text: query, disposition: 'CURRENT_TAB' });
        }
    });
}
initSearchEngine();

// Global index pointer for Drag-and-Drop operations
let draggedItemIndex = null;

// --- CRITICAL: High-Priority Wallpaper Preloader ---
(function preloadWallpaper() {
    // Fast image-only preview to prevent flash of unstyled background.
    // Video and Pixabay backgrounds are fully restored in initExtension()
    // once applyVideoBackground() and all helpers are defined.
    // NOTE: 'pixabay' type was previously stored as 'pexels' — both are accepted below.
    if (chrome && chrome.storage && chrome.storage.local) {
        chrome.storage.local.get(['bgSetting'], function(result) {
            const bgConfig = result.bgSetting || {};
            // Only set a background-image for non-video types
            if (bgConfig.type === 'rotation' && bgConfig.value) {
                document.body.style.backgroundImage = `url('${bgConfig.value}')`;
            } else if (bgConfig.type === 'local' && bgConfig.value && !bgConfig.isVideo) {
                document.body.style.backgroundImage = `url('${bgConfig.value}')`;
            } else if (bgConfig.type === 'web' && bgConfig.value) {
                document.body.style.backgroundImage = `url('${bgConfig.value}')`;
            } else if (!bgConfig.type || bgConfig.type === 'default') {
                document.body.style.backgroundImage = `url('${defaultBg}')`;
            }
            // Video types (local isVideo, pixabay/pexels): leave body black — initExtension will mount the <video>
        });
    }
})();

let clockFormat   = '24';
let clockType     = 'digital';
let clockEnabled  = true;
let analogShape   = 'round';
let analogFace    = 'numbers';
let analogHands   = 'classic';
let analogBgOp    = 0.6;
let analogBordOp  = 0.7;
let dateEnabled   = false;
let dateFormat    = 'long';
let weatherUnit   = 'C';
let weatherDisplay= 'both';
let _rawWeatherTemp = null;
let _rawWeatherCode = null;

// --- Cached DOM references (queried once at startup) ---
const _digitalEl  = document.getElementById('clock');
const _analogWrap = document.getElementById('analog-clock-wrap');
const _dateEl     = document.getElementById('date-display');
const _greetingEl = document.getElementById('greeting');

// --- Date format options (hoisted so objects aren't recreated every tick) ---
const _dateFmtLong      = { weekday:'long',  year:'numeric', month:'long',  day:'numeric' };
const _dateFmtMedium    = { year:'numeric',  month:'short',  day:'numeric' };
const _dateFmtShort     = { year:'numeric',  month:'2-digit',day:'2-digit' };
const _dateFmtDayMonth  = { day:'numeric',   month:'long',   year:'numeric' };

// --- Time & Greeting Logic ---
function updateDashboard() {
    const now = new Date();
    const hours24 = now.getHours();
    const minutes  = now.getMinutes();
    const seconds  = now.getSeconds();

    const digitalEl  = _digitalEl;
    const analogWrap = _analogWrap;
    const dateEl     = _dateEl;

    // ── Clock visibility ──
    if (!clockEnabled) {
        digitalEl.classList.add('hidden');
        if (analogWrap) analogWrap.classList.add('hidden');
    } else if (clockType === 'analog') {
        digitalEl.classList.add('hidden');
        if (analogWrap) analogWrap.classList.remove('hidden');
        drawAnalogClock(now);
    } else {
        digitalEl.classList.remove('hidden');
        if (analogWrap) analogWrap.classList.add('hidden');
        // Digital text
        if (clockFormat === '12') {
            const ampm  = hours24 >= 12 ? 'PM' : 'AM';
            const h12   = hours24 % 12 || 12;
            const mm    = minutes < 10 ? '0' + minutes : minutes;
            digitalEl.textContent = `${h12}:${mm} ${ampm}`;
        } else {
            const hh = hours24 < 10 ? '0' + hours24 : hours24;
            const mm = minutes < 10 ? '0' + minutes : minutes;
            digitalEl.textContent = `${hh}:${mm}`;
        }
    }

    // ── Date display ──
    if (dateEl) {
        if (dateEnabled) {
            dateEl.classList.remove('hidden');
            dateEl.textContent = formatDate(now, dateFormat);
        } else {
            dateEl.classList.add('hidden');
        }
    }

    // ── Greeting ──
    let greeting = "Good evening";
    if (hours24 < 12)      greeting = "Good morning";
    else if (hours24 < 18) greeting = "Good afternoon";
    if (_greetingEl) _greetingEl.textContent = greeting;
}

function formatDate(d, fmt) {
    if (fmt === 'long')      return d.toLocaleDateString(undefined, _dateFmtLong);
    if (fmt === 'medium')    return d.toLocaleDateString(undefined, _dateFmtMedium);
    if (fmt === 'short')     return d.toLocaleDateString(undefined, _dateFmtShort);
    if (fmt === 'iso')       return d.toISOString().slice(0, 10);
    if (fmt === 'daymonth')  return d.toLocaleDateString(undefined, _dateFmtDayMonth);
    return d.toLocaleDateString();
}

// ── Analog Clock Canvas Renderer ──
function drawAnalogClock(now) {
    const canvas = document.getElementById('analog-clock-canvas');
    if (!canvas) return;

    const shape = analogShape;
    const isRect = (shape === 'rectangle');
    const W = isRect ? 240 : 180;
    const H = isRect ? 140 : 180;
    if (canvas.width !== W)  canvas.width  = W;
    if (canvas.height !== H) canvas.height = H;

    const cx = W / 2, cy = H / 2;
    const radius = Math.min(W, H) / 2 - 6;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, W, H);

    const isDark = document.body.classList.contains('dark-text');
    const fgColor = isDark ? 'rgba(0,0,0,VAL)' : 'rgba(255,255,255,VAL)';
    const fg = (a) => fgColor.replace('VAL', a);

    // ── Background / border ──
    ctx.save();
    const bgA  = analogBgOp;
    const brdA = analogBordOp;

    if (shape === 'round') {
        ctx.beginPath();
        ctx.arc(cx, cy, radius, 0, Math.PI * 2);
        ctx.fillStyle = isDark ? `rgba(0,0,0,${bgA*0.35})` : `rgba(255,255,255,${bgA*0.25})`;
        ctx.fill();
        ctx.strokeStyle = fg(brdA);
        ctx.lineWidth = 2.5;
        ctx.stroke();
    } else {
        const r = shape === 'square' ? 16 : 12;
        roundRect(ctx, 3, 3, W-6, H-6, r);
        ctx.fillStyle = isDark ? `rgba(0,0,0,${bgA*0.35})` : `rgba(255,255,255,${bgA*0.25})`;
        ctx.fill();
        ctx.strokeStyle = fg(brdA);
        ctx.lineWidth = 2.5;
        ctx.stroke();
    }
    ctx.restore();

    const h  = now.getHours() % 12;
    const m  = now.getMinutes();
    const s  = now.getSeconds();
    const ms = now.getMilliseconds();

    // ── Face markers / numbers ──
    ctx.save();
    ctx.translate(cx, cy);
    if (analogFace === 'marks' || analogFace === 'swiss' || analogFace === 'braun') {
        for (let i = 0; i < 60; i++) {
            const ang  = (i / 60) * Math.PI * 2 - Math.PI / 2;
            const isMaj = i % 5 === 0;
            const len  = analogFace === 'braun' ? (isMaj ? 14 : 8) : (isMaj ? 12 : 6);
            const wid  = analogFace === 'braun' ? (isMaj ? 3 : 1.5) : (isMaj ? 2 : 1);
            const r1   = radius - 3;
            const r2   = r1 - len;
            ctx.beginPath();
            ctx.moveTo(Math.cos(ang)*r1, Math.sin(ang)*r1);
            ctx.lineTo(Math.cos(ang)*r2, Math.sin(ang)*r2);
            ctx.strokeStyle = fg(isMaj ? 0.9 : 0.5);
            ctx.lineWidth = wid;
            ctx.stroke();
        }
    } else if (analogFace === 'numbers' || analogFace === 'romans') {
        const romans = ['XII','I','II','III','IV','V','VI','VII','VIII','IX','X','XI'];
        ctx.fillStyle = fg(0.9);
        ctx.font = `${analogFace==='romans'?'600 11px':'bold 12px'} system-ui,sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        for (let i = 0; i < 12; i++) {
            const ang = (i / 12) * Math.PI * 2 - Math.PI / 2;
            const r2  = radius - 16;
            const label = analogFace === 'romans' ? romans[i] : (i === 0 ? '12' : String(i));
            ctx.fillText(label, Math.cos(ang)*r2, Math.sin(ang)*r2);
        }
    }
    ctx.restore();

    // ── Swiss railway red second dot ──
    if (analogFace === 'swiss') {
        ctx.save();
        ctx.translate(cx, cy);
        ctx.beginPath();
        ctx.arc(0, 0, 5, 0, Math.PI * 2);
        ctx.fillStyle = '#e8000d';
        ctx.fill();
        ctx.restore();
    }

    // ── Hands ──
    const smoothS  = s + ms / 1000;
    const smoothM  = m + smoothS / 60;
    const smoothH  = h + smoothM / 60;
    const hAng  = (smoothH / 12) * Math.PI * 2 - Math.PI / 2;
    const mAng  = (smoothM / 60) * Math.PI * 2 - Math.PI / 2;
    const sAng  = (analogHands === 'swiss' ? s : smoothS) / 60 * Math.PI * 2 - Math.PI / 2;

    function drawHand(ang, len, width, color, cap, tailLen) {
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(ang);
        ctx.lineCap = cap || 'round';
        ctx.strokeStyle = color;
        ctx.lineWidth = width;
        ctx.beginPath();
        ctx.moveTo(0, tailLen ? tailLen : 0);
        ctx.lineTo(0, -len);
        ctx.stroke();
        ctx.restore();
    }

    if (analogHands === 'classic') {
        drawHand(hAng, radius*0.52, 5, fg(1), 'round');
        drawHand(mAng, radius*0.76, 3.5, fg(0.95), 'round');
        drawHand(sAng, radius*0.82, 1.5, '#e74c3c', 'round');
    } else if (analogHands === 'swiss') {
        // Swiss: blunt rectangular hands + red lollipop second
        ctx.save(); ctx.translate(cx,cy); ctx.rotate(hAng);
        ctx.fillStyle = fg(1);
        roundRect(ctx, -4, -radius*0.52, 8, radius*0.52+8, 2);
        ctx.fill(); ctx.restore();

        ctx.save(); ctx.translate(cx,cy); ctx.rotate(mAng);
        ctx.fillStyle = fg(0.95);
        roundRect(ctx, -3, -radius*0.76, 6, radius*0.76+8, 2);
        ctx.fill(); ctx.restore();

        // Lollipop second hand
        ctx.save(); ctx.translate(cx,cy); ctx.rotate(sAng);
        ctx.strokeStyle = '#e8000d'; ctx.lineWidth = 1.8;
        ctx.beginPath(); ctx.moveTo(0, 12); ctx.lineTo(0, -radius*0.6); ctx.stroke();
        ctx.beginPath(); ctx.arc(0, -radius*0.72, 8, 0, Math.PI*2);
        ctx.fillStyle = '#e8000d'; ctx.fill();
        ctx.restore();
    } else if (analogHands === 'braun') {
        drawHand(hAng, radius*0.5, 6, fg(1), 'butt');
        drawHand(mAng, radius*0.74, 4, fg(0.95), 'butt');
        drawHand(sAng, radius*0.82, 1.5, '#ff6600', 'butt', 14);
    } else if (analogHands === 'apple') {
        // Thin rounded white hands
        drawHand(hAng, radius*0.54, 4.5, fg(1), 'round');
        drawHand(mAng, radius*0.78, 3, fg(0.95), 'round');
        drawHand(sAng, radius*0.84, 1.2, '#ff3b30', 'round', 12);
    }

    // Centre dot
    ctx.beginPath();
    ctx.arc(cx, cy, analogHands === 'apple' ? 3 : 4.5, 0, Math.PI*2);
    ctx.fillStyle = (analogHands === 'braun') ? '#ff6600' : fg(1);
    ctx.fill();
}

function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x+r, y);
    ctx.arcTo(x+w, y, x+w, y+h, r);
    ctx.arcTo(x+w, y+h, x, y+h, r);
    ctx.arcTo(x, y+h, x, y, r);
    ctx.arcTo(x, y, x+w, y, r);
    ctx.closePath();
}

updateDashboard();
let _clockInterval = setInterval(updateDashboard, 1000);


// --- Weather Fetch Engine ---
function initWeather() {
    chrome.storage.local.get(['weatherCache'], function(result) {
        const cache = result.weatherCache;
        const now = Date.now();
        
        if (cache && (now - cache.timestamp < 30 * 60 * 1000)) {
            renderWeatherUI(cache.temp, cache.code);
            return;
        }

        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    const lat = position.coords.latitude;
                    const lon = position.coords.longitude;
                    fetchWeatherFromAPI(lat, lon);
                },
                (error) => {
                    console.log("Geolocation unavailable. Defaulting to NYC coordinates.");
                    fetchWeatherFromAPI(40.7128, -74.0060);
                }
            );
        } else {
            document.getElementById('weather-desc').textContent = "Weather unavailable";
        }
    });
}

function fetchWeatherFromAPI(lat, lon) {
    const apiUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true`;

    fetch(apiUrl)
        .then(response => response.json())
        .then(data => {
            if (data && data.current_weather) {
                const temp = Math.round(data.current_weather.temperature);
                const code = data.current_weather.weathercode;
                
                chrome.storage.local.set({
                    weatherCache: { temp: temp, code: code, timestamp: Date.now() }
                });

                renderWeatherUI(temp, code);
            }
        })
        .catch(err => {
            console.error("Failed to fetch weather:", err);
            document.getElementById('weather-desc').textContent = "Offline";
        });
}

function renderWeatherUI(temp, code) {
    const iconEl = document.getElementById('weather-icon');
    const tempEl = document.getElementById('weather-temp');
    const descEl = document.getElementById('weather-desc');
    const container = document.getElementById('weather-container');

    _rawWeatherTemp = temp;
    _rawWeatherCode = code;

    let icon = "☀️", desc = "Clear sky";
    if (code === 0)                        { icon = "☀️";  desc = "Clear sky"; }
    else if (code >= 1 && code <= 3)       { icon = "⛅";  desc = "Partly Cloudy"; }
    else if (code === 45 || code === 48)   { icon = "🌫️"; desc = "Foggy"; }
    else if (code >= 51 && code <= 55)     { icon = "🌧️"; desc = "Drizzle"; }
    else if (code >= 61 && code <= 65)     { icon = "🌧️"; desc = "Rainy"; }
    else if (code >= 71 && code <= 75)     { icon = "❄️";  desc = "Snowy"; }
    else if (code >= 80 && code <= 82)     { icon = "🌦️"; desc = "Rain Showers"; }
    else if (code >= 95)                   { icon = "⛈️"; desc = "Thunderstorm"; }

    const displayTemp = weatherUnit === 'F' ? Math.round(temp * 9/5 + 32) : temp;
    const unitLabel   = weatherUnit === 'F' ? '°F' : '°C';

    tempEl.textContent  = `${displayTemp}${unitLabel}`;
    iconEl.textContent  = icon;
    descEl.textContent  = desc;

    // Visibility by display mode
    iconEl.style.display = (weatherDisplay === 'desc') ? 'none' : '';
    descEl.style.display = (weatherDisplay === 'icon') ? 'none' : '';
    tempEl.style.display = '';
}

function initExtension() {
    if (chrome && chrome.storage && chrome.storage.local) {
        chrome.storage.local.get(['myShortcuts', 'bgSetting', 'blurSetting', 'darknessSetting', 'darkTextSetting', 'clockFormatSetting', 'lockShortcuts', 'lockSideBtns', 'sideBtnOrder', 'sideBtnVisibility', 'clockSettings', 'weatherSettings', 'quotesEnabled', 'quoteInterval', 'greetingEnabled', 'tabTitle', 'searchPlaceholder', 'groupsEnabled', 'shortcutGroups', 'activeGroup', 'mostVisitedEnabled', 'mostVisitedCount', 'shortcutCols', 'textureSetting'], function(result) {
            let shortcuts = result.myShortcuts;
            if (!shortcuts) {
                shortcuts = defaultShortcuts;
                chrome.storage.local.set({ myShortcuts: shortcuts });
            }
            // Apply active group filter if groups enabled
            const _ag = result.activeGroup || null;
            const _ge = result.groupsEnabled || false;
            let displayShortcuts = shortcuts;
            if (_ge && _ag) {
                displayShortcuts = shortcuts.filter(s => s.groupId === _ag);
            }
            renderShortcuts(displayShortcuts);
            renderManageList(shortcuts);

            // Wallpaper UI syncing
            let bgConfig = result.bgSetting || { type: 'default', value: defaultBg, interval: '1', lastUpdated: 0 };
            // Migrate legacy 'pexels' type name to 'pixabay'
            if (bgConfig.type === 'pexels') {
                bgConfig = { ...bgConfig, type: 'pixabay' };
                chrome.storage.local.set({ bgSetting: bgConfig });
            }
            bgTypeSelect.value = bgConfig.type || 'default';
            if (bgConfig.interval && (bgConfig.type === 'rotation')) bgIntervalSelect.value = bgConfig.interval;
            if (bgConfig.interval && bgConfig.type === 'pixabay') {
                const pi = document.getElementById('pixabay-interval-select');
                if (pi) pi.value = bgConfig.interval;
            }
            
            updateBgSettingsUI(bgConfig.type, bgConfig.value);

            if (bgConfig.type === 'rotation' || bgConfig.type === 'pixabay') {
                handleRotationCheck(bgConfig);
            } else if (bgConfig.type === 'local' && bgConfig.isVideo) {
                loadVideoBlobFromIDB(function(blobUrl) {
                    if (blobUrl) { applyVideoBackground(blobUrl, null); showVideoControls(); }
                });
            } else if (bgConfig.type === 'local' && !bgConfig.isVideo && bgConfig.value) {
                removeVideoBackground();
                hideVideoControls();
            }

            // Glass Blur dynamic setup
            let storedBlur = (result.blurSetting !== undefined) ? result.blurSetting : 25;
            blurSlider.value = storedBlur;
            blurValueDisplay.textContent = `${storedBlur}px`;
            document.documentElement.style.setProperty('--blur-amount', `${storedBlur}px`);

            // Glass Darkness dynamic setup
            let storedDarkness = (result.darknessSetting !== undefined) ? result.darknessSetting : 0;
            darknessSlider.value = storedDarkness;
            darknessValueDisplay.textContent = `${storedDarkness}%`;
            applyDarknessValue(storedDarkness);

            // ── Texture Overlay ──
            const textureSetting = result.textureSetting || { type: 'none', opacity: 30, density: 3 };
            applyTextureOverlay(textureSetting.type, textureSetting.opacity, textureSetting.density);

            // Dark Text Mode setup
            let storedDarkText = result.darkTextSetting || false;
            applyDarkTextMode(storedDarkText);
            darkTextToggle.checked = storedDarkText;

            // Clock settings
            clockFormat = result.clockFormatSetting || '24';
            const cs = result.clockSettings || {};
            clockEnabled  = cs.enabled  !== false;
            clockType     = cs.type     || 'digital';
            analogShape   = cs.shape    || 'round';
            analogFace    = cs.face     || 'numbers';
            analogHands   = cs.hands    || 'classic';
            analogBgOp    = cs.bgOp    !== undefined ? cs.bgOp    : 0.6;
            analogBordOp  = cs.bordOp  !== undefined ? cs.bordOp  : 0.7;
            dateEnabled   = cs.dateEnabled || false;
            dateFormat    = cs.dateFormat  || 'long';

            // Sync clock settings UI
            const clockEnabledToggle = document.getElementById('clock-enabled-toggle');
            const clockTypeSelect    = document.getElementById('clock-type-select');
            const analogShapeSelect  = document.getElementById('analog-shape-select');
            const analogFaceSelect   = document.getElementById('analog-face-select');
            const analogHandsSelect  = document.getElementById('analog-hands-select');
            const analogBgOpInput    = document.getElementById('analog-bg-opacity');
            const analogBordOpInput  = document.getElementById('analog-border-opacity');
            const dateEnabledToggle  = document.getElementById('date-enabled-toggle');
            const dateFormatSelect   = document.getElementById('date-format-select');

            if (clockEnabledToggle) clockEnabledToggle.checked = clockEnabled;
            if (clockTypeSelect)    clockTypeSelect.value = clockType;
            if (analogShapeSelect)  analogShapeSelect.value = analogShape;
            if (analogFaceSelect)   analogFaceSelect.value = analogFace;
            if (analogHandsSelect)  analogHandsSelect.value = analogHands;
            if (analogBgOpInput)    { analogBgOpInput.value = Math.round(analogBgOp*100); document.getElementById('analog-bg-opacity-val').textContent = Math.round(analogBgOp*100)+'%'; }
            if (analogBordOpInput)  { analogBordOpInput.value = Math.round(analogBordOp*100); document.getElementById('analog-border-opacity-val').textContent = Math.round(analogBordOp*100)+'%'; }
            if (dateEnabledToggle)  dateEnabledToggle.checked = dateEnabled;
            if (dateFormatSelect)   dateFormatSelect.value = dateFormat;
            document.getElementById('clock-format-select').value = clockFormat;

            updateClockTypeUI(clockType);
            if (dateEnabled && document.getElementById('date-format-opts')) document.getElementById('date-format-opts').classList.remove('hidden');

            // Weather settings
            const ws = result.weatherSettings || {};
            weatherUnit    = ws.unit    || 'C';
            weatherDisplay = ws.display || 'both';
            const wUnitSel = document.getElementById('weather-unit-select');
            const wDispSel = document.getElementById('weather-display-select');
            if (wUnitSel) wUnitSel.value = weatherUnit;
            if (wDispSel) wDispSel.value = weatherDisplay;

            updateDashboard();

            // Lock toggles
            const lockShortcutsToggle = document.getElementById('lock-shortcuts-toggle');
            const lockSideBtnsToggle = document.getElementById('lock-side-btns-toggle');
            if (lockShortcutsToggle) lockShortcutsToggle.checked = result.lockShortcuts || false;
            if (lockSideBtnsToggle) lockSideBtnsToggle.checked = result.lockSideBtns || false;
            applyShortcutLock(result.lockShortcuts || false);

            // Initialize side buttons order/visibility
            initSideButtons(result.sideBtnOrder, result.sideBtnVisibility, result.lockSideBtns || false);

            // ── Quotes ──
            const quotesEnabled = result.quotesEnabled || false;
            const quotesToggle = document.getElementById('quotes-toggle');
            const quoteIntervalWrap = document.getElementById('quote-interval-wrap');
            if (quotesToggle) quotesToggle.checked = quotesEnabled;
            if (quoteIntervalWrap) quoteIntervalWrap.classList.toggle('hidden', !quotesEnabled);
            // Sync interval select
            const quoteIntSel = document.getElementById('quote-interval-select');
            if (quoteIntSel) quoteIntSel.value = result.quoteInterval || '1';
            if (quotesEnabled) initQuotes();

            // ── Greeting ──
            const greetingEnabled = result.greetingEnabled !== false; // default ON
            const greetingToggle = document.getElementById('greeting-toggle');
            if (greetingToggle) greetingToggle.checked = greetingEnabled;
            const greetingEl = document.getElementById('greeting');
            if (greetingEl) greetingEl.classList.toggle('hidden', !greetingEnabled);

            // ── Tab title ──
            const tabTitle = result.tabTitle || '';
            const tabTitleInput = document.getElementById('tab-title-input');
            if (tabTitleInput) tabTitleInput.value = tabTitle;
            if (tabTitle) document.title = tabTitle;

            // ── Search placeholder ──
            const searchPlaceholderVal = result.searchPlaceholder !== undefined ? result.searchPlaceholder : null;
            const searchPlaceholderInput = document.getElementById('search-placeholder-input');
            if (searchPlaceholderInput) searchPlaceholderInput.value = searchPlaceholderVal !== null ? searchPlaceholderVal : '';
            const searchInput = document.querySelector('#search-form input[name="q"]');
            if (searchInput && searchPlaceholderVal !== null) searchInput.placeholder = searchPlaceholderVal;

            // ── Groups ──
            const groupsEnabled = result.groupsEnabled || false;
            const groups = result.shortcutGroups || [];
            const activeGroup = result.activeGroup || null;
            initGroupsUI(groupsEnabled, groups, shortcuts, activeGroup);

            // ── Shortcut Columns ──
            const shortcutCols = parseInt(result.shortcutCols) || 6;
            const shortcutColsInput = document.getElementById('shortcut-cols-input');
            if (shortcutColsInput) shortcutColsInput.value = shortcutCols;
            applyShortcutCols(shortcutCols);

            // ── Most Visited ──
            const mostVisitedEnabled = result.mostVisitedEnabled || false;
            const mostVisitedCount = result.mostVisitedCount || 2;
            const mostVisitedToggle = document.getElementById('most-visited-toggle');
            const mostVisitedCountWrap = document.getElementById('most-visited-count-wrap');
            const mostVisitedCountSel = document.getElementById('most-visited-count-select');
            if (mostVisitedToggle) mostVisitedToggle.checked = mostVisitedEnabled;
            if (mostVisitedCountWrap) mostVisitedCountWrap.classList.toggle('hidden', !mostVisitedEnabled);
            if (mostVisitedCountSel) mostVisitedCountSel.value = mostVisitedCount;
            if (mostVisitedEnabled) renderMostVisited(mostVisitedCount);
        });
    } else {
        renderShortcuts(defaultShortcuts);
    }
}


// Render Dashboard UI Main Shortcuts Grid (With Drag-and-Drop)
function renderShortcuts(shortcuts) {
    shortcutsGrid.innerHTML = '';
    shortcuts.forEach((item, index) => {
        const anchor = document.createElement('a');
        anchor.href = item.url;
        anchor.className = 'shortcut-item';
        anchor.setAttribute('draggable', 'true');
        anchor.setAttribute('data-index', index);
        
        const iconWrapper = document.createElement('div');
        iconWrapper.className = 'icon-wrapper';
        
        const img = document.createElement('img');
        // Use customFavicon directly if present — no MutationObserver needed
        img.src = item.customFavicon || `https://www.google.com/s2/favicons?domain=${item.url}&sz=64`;
        img.alt = item.name;
        if (!item.customFavicon) {
            img.onerror = function() {
                this.src = 'https://www.google.com/s2/favicons?domain=example.com&sz=64';
            };
        }
        
        const span = document.createElement('span');
        span.textContent = item.name;
        
        iconWrapper.appendChild(img);
        anchor.appendChild(iconWrapper);
        anchor.appendChild(span);

        // --- Grid Element Drag Operations ---
        anchor.addEventListener('dragstart', function(e) {
            draggedItemIndex = index;
            this.style.opacity = '0.4';
            e.dataTransfer.effectAllowed = 'move';
        });

        anchor.addEventListener('dragend', function() {
            this.style.opacity = '1';
            removeDragOverStyles();
            draggedItemIndex = null;
        });

        anchor.addEventListener('dragover', function(e) {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            if (parseInt(this.getAttribute('data-index')) !== draggedItemIndex) {
                this.classList.add('drag-over');
            }
        });

        anchor.addEventListener('dragleave', function() {
            this.classList.remove('drag-over');
        });

        anchor.addEventListener('drop', function(e) {
            e.preventDefault();
            this.classList.remove('drag-over');
            const targetIndex = parseInt(this.getAttribute('data-index'));
            if (draggedItemIndex !== null && draggedItemIndex !== targetIndex) {
                rearrangeShortcutsInStorage(draggedItemIndex, targetIndex);
            }
        });
        
        shortcutsGrid.appendChild(anchor);
    });
}

function removeDragOverStyles() {
    document.querySelectorAll('.shortcut-item, .manage-item').forEach(item => {
        item.classList.remove('drag-over');
    });
}

function rearrangeShortcutsInStorage(fromIndex, toIndex) {
    chrome.storage.local.get(['myShortcuts'], function(result) {
        let shortcuts = result.myShortcuts || [];
        const [movedItem] = shortcuts.splice(fromIndex, 1);
        shortcuts.splice(toIndex, 0, movedItem);
        chrome.storage.local.set({ myShortcuts: shortcuts }, function() {
            // Only re-render the grid — no need to reload all settings
            const _ag = _activeGroup;
            const _ge = _groupsEnabled;
            const display = (_ge && _ag) ? shortcuts.filter(s => s.groupId === _ag) : shortcuts;
            renderShortcuts(display);
            renderManageList(shortcuts);
        });
    });
}

// Render Settings Modal Manage List (With Drag-and-Drop)
function renderManageList(shortcuts) {
    manageList.innerHTML = '';
    shortcuts.forEach((item, index) => {
        const div = document.createElement('div');
        div.className = 'manage-item';
        div.setAttribute('draggable', 'true');
        div.setAttribute('data-index', index);
        div.style.cursor = 'grab';
        div.style.flexDirection = 'column';
        div.style.gap = '0';
        div.style.alignItems = 'stretch';

        // --- Default (view) row ---
        const viewRow = document.createElement('div');
        viewRow.className = 'manage-item-view-row';
        viewRow.style.cssText = 'display:flex; justify-content:space-between; align-items:center; width:100%;';

        const span = document.createElement('span');
        span.textContent = item.name;
        span.style.cssText = 'overflow:hidden; text-overflow:ellipsis; white-space:nowrap; flex:1; margin-right:8px;';

        const btnGroup = document.createElement('div');
        btnGroup.style.cssText = 'display:flex; gap:8px; flex-shrink:0;';

        const editBtn = document.createElement('button');
        editBtn.className = 'delete-btn';
        editBtn.textContent = 'Edit';
        editBtn.style.color = 'rgba(255,255,255,0.7)';

        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'delete-btn';
        deleteBtn.textContent = 'Delete';

        btnGroup.appendChild(editBtn);
        btnGroup.appendChild(deleteBtn);
        viewRow.appendChild(span);
        viewRow.appendChild(btnGroup);

        // --- Edit (expanded) row ---
        const editRow = document.createElement('div');
        editRow.className = 'manage-item-edit-row';
        editRow.style.cssText = 'display:none; flex-direction:column; gap:6px; margin-top:8px; width:100%;';

        const nameInput = document.createElement('input');
        nameInput.type = 'text';
        nameInput.value = item.name;
        nameInput.placeholder = 'Website Name';
        nameInput.style.cssText = 'font-size:0.85rem; padding:7px 10px;';

        const urlInput = document.createElement('input');
        urlInput.type = 'url';
        urlInput.value = item.url;
        urlInput.placeholder = 'URL (https://...)';
        urlInput.style.cssText = 'font-size:0.85rem; padding:7px 10px;';

        const saveRowBtns = document.createElement('div');
        saveRowBtns.style.cssText = 'display:flex; gap:6px;';

        const saveBtn = document.createElement('button');
        saveBtn.className = 'primary-btn';
        saveBtn.textContent = 'Save';
        saveBtn.style.cssText = 'flex:1; padding:7px; font-size:0.85rem;';

        const cancelBtn = document.createElement('button');
        cancelBtn.className = 'delete-btn';
        cancelBtn.textContent = 'Cancel';
        cancelBtn.style.cssText = 'padding:7px 12px; font-size:0.85rem;';

        saveRowBtns.appendChild(saveBtn);
        saveRowBtns.appendChild(cancelBtn);
        editRow.appendChild(nameInput);
        editRow.appendChild(urlInput);
        editRow.appendChild(saveRowBtns);

        div.appendChild(viewRow);
        div.appendChild(editRow);

        // --- Edit button: toggle into edit mode ---
        editBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            nameInput.value = item.name;
            urlInput.value = item.url;
            editRow.style.display = 'flex';
            viewRow.style.opacity = '0.4';
            div.setAttribute('draggable', 'false');
            nameInput.focus();
        });

        // --- Cancel: collapse edit row ---
        cancelBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            editRow.style.display = 'none';
            viewRow.style.opacity = '1';
            div.setAttribute('draggable', 'true');
        });

        // --- Save: persist edit ---
        saveBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            let newName = nameInput.value.trim();
            let newUrl = urlInput.value.trim();
            if (!newName || !newUrl) return;
            if (!/^https?:\/\//i.test(newUrl)) newUrl = 'https://' + newUrl;

            chrome.storage.local.get(['myShortcuts'], function(result) {
                let shortcuts = result.myShortcuts || [];
                shortcuts[index] = { name: newName, url: newUrl };
                chrome.storage.local.set({ myShortcuts: shortcuts }, function() {
                    const display = (_groupsEnabled && _activeGroup) ? shortcuts.filter(s => s.groupId === _activeGroup) : shortcuts;
                    renderShortcuts(display);
                    renderManageList(shortcuts);
                });
            });
        });

        // --- Delete button ---
        deleteBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            removeShortcut(index);
        });

        // --- Settings Elements Drag Operations ---
        div.addEventListener('dragstart', function(e) {
            if (editRow.style.display !== 'none') { e.preventDefault(); return; }
            draggedItemIndex = index;
            this.style.opacity = '0.5';
            this.style.cursor = 'grabbing';
            e.dataTransfer.effectAllowed = 'move';
        });

        div.addEventListener('dragend', function() {
            this.style.opacity = '1';
            this.style.cursor = 'grab';
            removeDragOverStyles();
            draggedItemIndex = null;
        });

        div.addEventListener('dragover', function(e) {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            if (parseInt(this.getAttribute('data-index')) !== draggedItemIndex) {
                this.classList.add('drag-over');
            }
        });

        div.addEventListener('dragleave', function() {
            this.classList.remove('drag-over');
        });

        div.addEventListener('drop', function(e) {
            e.preventDefault();
            this.classList.remove('drag-over');
            const targetIndex = parseInt(this.getAttribute('data-index'));
            if (draggedItemIndex !== null && draggedItemIndex !== targetIndex) {
                rearrangeShortcutsInStorage(draggedItemIndex, targetIndex);
            }
        });

        manageList.appendChild(div);
    });
}

document.getElementById('add-shortcut-btn') && document.getElementById('add-shortcut-btn').addEventListener('click', function(e) {
    e.preventDefault();
    const nameInput = document.getElementById('site-name');
    const urlInput = document.getElementById('site-url');
    let url = urlInput.value.trim();
    if (!url || !nameInput.value.trim()) return;
    if (!/^https?:\/\//i.test(url)) url = 'https://' + url;

    chrome.storage.local.get(['myShortcuts'], function(result) {
        const shortcuts = result.myShortcuts || [];
        const newShortcut = { name: nameInput.value.trim(), url: url };
        const groupSel = document.getElementById('site-group-select');
        if (groupSel && groupSel.value) newShortcut.groupId = groupSel.value;
        shortcuts.push(newShortcut);
        chrome.storage.local.set({ myShortcuts: shortcuts }, function() {
            const display = (_groupsEnabled && _activeGroup) ? shortcuts.filter(s => s.groupId === _activeGroup) : shortcuts;
            renderShortcuts(display);
            renderManageList(shortcuts);
            nameInput.value = '';
            urlInput.value = '';
            if (groupSel) groupSel.value = '';
        });
    });
});

function removeShortcut(index) {
    chrome.storage.local.get(['myShortcuts'], function(result) {
        let shortcuts = result.myShortcuts || [];
        shortcuts.splice(index, 1);
        chrome.storage.local.set({ myShortcuts: shortcuts }, function() {
            const display = (_groupsEnabled && _activeGroup) ? shortcuts.filter(s => s.groupId === _activeGroup) : shortcuts;
            renderShortcuts(display);
            renderManageList(shortcuts);
        });
    });
}

// --- Wallpaper Customization Logic ---

// Helper: should rotation fire on this new tab load?
function shouldRotate(bgConfig) {
    if (bgConfig.interval === 'locked') return false;
    if (bgConfig.interval === 'newtab') return true;
    const hoursPassed = (Date.now() - (bgConfig.lastUpdated || 0)) / 3600000;
    return hoursPassed >= (parseFloat(bgConfig.interval) || 1) || !bgConfig.value;
}

bgTypeSelect.addEventListener('change', function() {
    const selectedType = this.value;
    updateBgSettingsUI(selectedType, '');

    if (selectedType === 'default') {
        removeVideoBackground();
        const bgConfig = { type: 'default', value: defaultBg, interval: '1', lastUpdated: 0 };
        chrome.storage.local.set({ bgSetting: bgConfig }, () => applyWallpaper(defaultBg));
    } else if (selectedType === 'rotation') {
        removeVideoBackground();
        const iv = bgIntervalSelect.value;
        if (iv !== 'locked') triggerNewPicsumRotation(iv);
    } else if (selectedType === 'pixabay') {
        chrome.storage.local.get(['pixabayApiKey'], function(r) {
            if (!r.pixabayApiKey) return; // key not set yet — user will save it
            const iv = document.getElementById('pixabay-interval-select').value;
            if (iv !== 'locked') triggerPixabayRotation(iv);
        });
    }
});

bgIntervalSelect.addEventListener('change', function() {
    if (bgTypeSelect.value !== 'rotation') return;
    const iv = this.value;
    chrome.storage.local.get(['bgSetting'], function(r) {
        const bg = r.bgSetting || {};
        if (iv === 'locked') {
            chrome.storage.local.set({ bgSetting: { ...bg, interval: 'locked' } });
        } else if (iv === 'newtab') {
            chrome.storage.local.set({ bgSetting: { ...bg, interval: 'newtab', lastUpdated: 0 } }, () => triggerNewPicsumRotation('newtab'));
        } else {
            triggerNewPicsumRotation(iv);
        }
    });
});

document.getElementById('pixabay-interval-select') && document.getElementById('pixabay-interval-select').addEventListener('change', function() {
    if (bgTypeSelect.value !== 'pixabay') return;
    const iv = this.value;
    if (iv === 'locked') {
        chrome.storage.local.get(['bgSetting'], function(r) {
            chrome.storage.local.set({ bgSetting: { ...(r.bgSetting || {}), interval: 'locked' } });
        });
    } else {
        triggerPixabayRotation(iv);
    }
});

document.getElementById('save-pixabay-key-btn') && document.getElementById('save-pixabay-key-btn').addEventListener('click', function() {
    const key = document.getElementById('pixabay-api-key-input').value.trim();
    if (!key) return;
    chrome.storage.local.set({ pixabayApiKey: key }, function() {
        showPixabayKeySaved(true);
        const iv = document.getElementById('pixabay-interval-select').value;
        if (iv !== 'locked') triggerPixabayRotation(iv);
    });
});

document.getElementById('pixabay-change-key-btn') && document.getElementById('pixabay-change-key-btn').addEventListener('click', function() {
    showPixabayKeySaved(false);
});

document.getElementById('pixabay-delete-key-btn') && document.getElementById('pixabay-delete-key-btn').addEventListener('click', function() {
    chrome.storage.local.remove('pixabayApiKey', function() {
        document.getElementById('pixabay-api-key-input').value = '';
        showPixabayKeySaved(false);
    });
});

function showPixabayKeySaved(saved) {
    const entry = document.getElementById('pixabay-key-entry');
    const badge = document.getElementById('pixabay-key-saved');
    if (entry) entry.classList.toggle('hidden', saved);
    if (badge) badge.classList.toggle('hidden', !saved);
}

function updateBgSettingsUI(type, currentVal) {
    bgWebGroup.classList.add('hidden');
    bgLocalGroup.classList.add('hidden');
    bgRotationGroup.classList.add('hidden');
    const pixabayGroup = document.getElementById('bg-pixabay-group');
    if (pixabayGroup) pixabayGroup.classList.add('hidden');
    hideVideoControls(); // always hide first; only video types re-show below

    if (type === 'web') {
        bgWebGroup.classList.remove('hidden');
        if (currentVal) bgUrlInput.value = currentVal;
    } else if (type === 'local') {
        bgLocalGroup.classList.remove('hidden');
        // Only show video controls if the saved local file is actually a video
        chrome.storage.local.get(['bgSetting'], function(r) {
            const bg = r.bgSetting || {};
            if (bg.isVideo) showVideoControls();
        });
    } else if (type === 'rotation') {
        bgRotationGroup.classList.remove('hidden');
    } else if (type === 'pixabay') {
        if (pixabayGroup) pixabayGroup.classList.remove('hidden');
        chrome.storage.local.get(['pixabayApiKey'], function(r) {
            showPixabayKeySaved(!!r.pixabayApiKey);
        });
        // Pixabay is always video — show controls if a video is already loaded
        chrome.storage.local.get(['bgSetting'], function(r) {
            if (r.bgSetting && r.bgSetting.value) showVideoControls();
        });
    }
}

// Passive Verification: Evaluates only when a brand new tab instance loads up
function handleRotationCheck(bgConfig) {
    if (bgConfig.type === 'pixabay') {
        if (shouldRotate(bgConfig)) {
            triggerPixabayRotation(bgConfig.interval);
        } else if (bgConfig.value) {
            applyVideoBackground(bgConfig.value, null);
            showVideoControls();
        }
        return;
    }
    if (shouldRotate(bgConfig)) {
        triggerNewPicsumRotation(bgConfig.interval);
    } else {
        applyWallpaper(bgConfig.value);
    }
}

// Fetches a new Picsum image
function triggerNewPicsumRotation(intervalValue) {
    const randomId = Math.floor(Math.random() * 1000);
    const url = `https://picsum.photos/id/${randomId}/1920/1080`;
    const bgConfig = { type: 'rotation', value: url, interval: intervalValue, lastUpdated: Date.now() };
    chrome.storage.local.set({ bgSetting: bgConfig }, () => { removeVideoBackground(); applyWallpaper(url); });
}

// Fetches a random nature/landscape video from Pixabay (free API, key required).
// Pixabay API returns direct mp4 video URLs — no CORS issues since we use the JSON API
// and then assign the video URL directly to a <video> element (media request, not fetch).
function triggerPixabayRotation(intervalValue) {
    chrome.storage.local.get(['pixabayApiKey'], function(r) {
        const key = r.pixabayApiKey || '';
        if (!key) { console.warn('Pixabay API key not set'); return; }
        const queries = ['nature', 'landscape', 'ocean', 'forest', 'mountains', 'sky', 'aerial', 'waterfall'];
        const q = queries[Math.floor(Math.random() * queries.length)];
        fetch(`https://pixabay.com/api/videos/?key=${key}&q=${encodeURIComponent(q)}&per_page=20&video_type=film&min_width=1280`)
        .then(r => { if (!r.ok) throw new Error('Pixabay ' + r.status); return r.json(); })
        .then(data => {
            const hits = (data.hits || []).filter(v => v.videos);
            if (!hits.length) throw new Error('no videos');
            const vid = hits[Math.floor(Math.random() * hits.length)];
            // Pixabay returns quality tiers: large (1080p), medium (720p), small, tiny
            const url = (vid.videos.large && vid.videos.large.url)
                     || (vid.videos.medium && vid.videos.medium.url)
                     || vid.videos.small.url;
            const bgConfig = { type: 'pixabay', value: url, interval: intervalValue, lastUpdated: Date.now() };
            chrome.storage.local.set({ bgSetting: bgConfig }, () => { applyVideoBackground(url, null); showVideoControls(); });
        })
        .catch(err => console.error('Pixabay fetch failed:', err));
    });
}

saveBgUrlBtn.addEventListener('click', function() {
    const url = bgUrlInput.value.trim();
    if (url) {
        const bgConfig = { type: 'web', value: url, interval: '1', lastUpdated: 0 };
        chrome.storage.local.set({ bgSetting: bgConfig }, function() {
            applyWallpaper(url);
        });
    }
});

bgFileInput.addEventListener('change', function(e) {
    const file = e.target.files[0];
    if (!file) return;
    const isVideo = file.type.startsWith('video/');

    if (isVideo) {
        // Videos are too large for chrome.storage (5MB quota).
        // Store the raw blob in IndexedDB instead, save only a marker in chrome.storage.
        saveVideoBlobToIDB(file, function(err) {
            if (err) { console.error('IDB save failed:', err); return; }
            const bgConfig = { type: 'local', value: '__idb_video__', isVideo: true, interval: '1', lastUpdated: 0 };
            chrome.storage.local.set({ bgSetting: bgConfig }, function() {
                loadVideoBlobFromIDB(function(blobUrl) {
                    if (blobUrl) { applyVideoBackground(blobUrl, null); showVideoControls(); }
                });
            });
        });
    } else {
        const reader = new FileReader();
        reader.onload = function(event) {
            const base64 = event.target.result;
            const bgConfig = { type: 'local', value: base64, isVideo: false, interval: '1', lastUpdated: 0 };
            chrome.storage.local.set({ bgSetting: bgConfig }, function() {
                removeVideoBackground();
                applyWallpaper(base64);
                hideVideoControls();
            });
        };
        reader.readAsDataURL(file);
    }
});

// ── IndexedDB helpers for large video blobs ──
function openVideoDB(cb) {
    const req = indexedDB.open('bgVideoDB', 1);
    req.onupgradeneeded = function(e) {
        e.target.result.createObjectStore('videos');
    };
    req.onsuccess = function(e) { cb(null, e.target.result); };
    req.onerror   = function(e) { cb(e.target.error); };
}

function saveVideoBlobToIDB(blob, cb) {
    openVideoDB(function(err, db) {
        if (err) { cb(err); return; }
        const tx = db.transaction('videos', 'readwrite');
        tx.objectStore('videos').put(blob, 'localBg');
        tx.oncomplete = function() { cb(null); };
        tx.onerror    = function(e) { cb(e.target.error); };
    });
}

function loadVideoBlobFromIDB(cb) {
    openVideoDB(function(err, db) {
        if (err) { cb(null); return; }
        const tx = db.transaction('videos', 'readonly');
        const req = tx.objectStore('videos').get('localBg');
        req.onsuccess = function(e) {
            const blob = e.target.result;
            if (blob) {
                cb(URL.createObjectURL(blob));
            } else {
                cb(null);
            }
        };
        req.onerror = function() { cb(null); };
    });
}

function applyWallpaper(imgValue) {
    removeVideoBackground();
    document.body.classList.remove('video-bg');
    if (imgValue) {
        document.body.style.backgroundImage = `url('${imgValue}')`;
    } else {
        document.body.style.backgroundImage = `url('${defaultBg}')`;
    }
}

// ── Video Background Engine ──
function applyVideoBackground(src, videoSettings) {
    // Fetch saved settings first, then build/reuse the video element.
    // This ensures muted is set BEFORE play() — browsers require muted=true
    // before autoplay, and setting it after causes audio to start then cut,
    // or in some cases play a second audio track on top.
    chrome.storage.local.get(['videoSettings'], function(r) {
        const settings = videoSettings || r.videoSettings || { muted: true, zoom: 100, speed: 100, fade: 0 };

        let vid = document.getElementById('bg-video-el');
        if (!vid) {
            vid = document.createElement('video');
            vid.id = 'bg-video-el';
            vid.autoplay = true;
            vid.loop = true;
            vid.playsInline = true;
            document.body.prepend(vid);
        }

        // Apply muted BEFORE setting src/play so browser autoplay policy is satisfied
        // and no audio frame is ever decoded unmuted
        vid.muted = (settings.muted !== false); // default muted=true
        updateMuteToggleUI(vid.muted);

        // Only change src if it actually changed — avoids restarting a playing video
        if (vid.src !== src) {
            vid.src = src;
        }

        vid.play().catch(() => {});
        document.body.style.backgroundImage = 'none';
        document.body.classList.add('video-bg');

        // Apply zoom, speed, fade — muted is already set correctly on the element above
        // Pass muted:undefined so applyVideoSettings skips it and doesn't fight with
        // the value we already locked in before play()
        applyVideoSettings({ zoom: settings.zoom, speed: settings.speed, fade: settings.fade });
    });
}

function removeVideoBackground() {
    const vid = document.getElementById('bg-video-el');
    if (vid) vid.remove();
    document.body.classList.remove('video-bg');
}

function applyVideoSettings(s) {
    const vid = document.getElementById('bg-video-el');
    if (!vid) return;
    if (s.zoom !== undefined) {
        document.documentElement.style.setProperty('--vid-zoom', s.zoom / 100);
        const zoomEl = document.getElementById('vid-zoom');
        const zoomVal = document.getElementById('vid-zoom-val');
        if (zoomEl) zoomEl.value = s.zoom;
        if (zoomVal) zoomVal.textContent = s.zoom + '%';
    }
    if (s.speed !== undefined) {
        vid.playbackRate = s.speed / 100;
        const speedEl = document.getElementById('vid-speed');
        const speedVal = document.getElementById('vid-speed-val');
        if (speedEl) speedEl.value = s.speed;
        if (speedVal) speedVal.textContent = (s.speed / 100) + '×';
    }
    if (s.muted !== undefined) {
        vid.muted = s.muted;
        updateMuteToggleUI(s.muted);
    }
    if (s.fade !== undefined) {
        const fadeEl = document.getElementById('vid-fade');
        const fadeVal = document.getElementById('vid-fade-val');
        if (fadeEl) fadeEl.value = s.fade;
        if (fadeVal) fadeVal.textContent = s.fade === 0 ? 'Off' : s.fade + 's';
        setupFadeLoop(vid, parseFloat(s.fade));
    }
}

function setupFadeLoop(vid, fadeSec) {
    // Remove any previous timeupdate handler before adding a new one
    if (vid._fadeHandler) {
        vid.removeEventListener('timeupdate', vid._fadeHandler);
        vid._fadeHandler = null;
    }
    if (!fadeSec || fadeSec <= 0) { vid.style.opacity = '1'; return; }
    vid._fadeHandler = function() {
        const remaining = vid.duration - vid.currentTime;
        if (remaining <= fadeSec) {
            vid.style.opacity = Math.max(0, remaining / fadeSec);
        } else if (vid.currentTime <= fadeSec) {
            vid.style.opacity = Math.min(1, vid.currentTime / fadeSec);
        } else {
            vid.style.opacity = '1';
        }
    };
    vid.addEventListener('timeupdate', vid._fadeHandler);
}

function updateMuteToggleUI(muted) {
    // Toggle is labelled "Mute": checked=ON means muted=true (sound off)
    // Visually: OFF position = sound playing (thumb left, dim track)
    //           ON  position = muted        (thumb right, bright track)
    const track = document.getElementById('vid-mute-track');
    const thumb = document.getElementById('vid-mute-thumb');
    const toggle = document.getElementById('vid-mute-toggle');
    if (toggle) toggle.checked = muted;
    if (track) track.style.background = muted ? 'rgba(255,255,255,0.45)' : 'rgba(255,255,255,0.15)';
    if (thumb) thumb.style.transform = muted ? 'translateX(16px)' : 'translateX(0)';
}

function showVideoControls() {
    const vc = document.getElementById('bg-video-controls');
    if (vc) vc.classList.remove('hidden');
}
function hideVideoControls() {
    const vc = document.getElementById('bg-video-controls');
    if (vc) vc.classList.add('hidden');
}

// Video control event listeners
(function initVideoControls() {
    const vidZoom  = document.getElementById('vid-zoom');
    const vidSpeed = document.getElementById('vid-speed');
    const vidFade  = document.getElementById('vid-fade');
    const vidMute  = document.getElementById('vid-mute-toggle');

    function saveVidSettings() {
        const s = {
            zoom:  parseInt(vidZoom ? vidZoom.value : 100),
            speed: parseInt(vidSpeed ? vidSpeed.value : 100),
            fade:  parseFloat(vidFade ? vidFade.value : 0),
            muted: vidMute ? vidMute.checked : true
        };
        chrome.storage.local.set({ videoSettings: s });
        applyVideoSettings(s);
    }

    if (vidZoom) vidZoom.addEventListener('input', function() {
        document.getElementById('vid-zoom-val').textContent = this.value + '%';
        saveVidSettings();
    });
    if (vidSpeed) vidSpeed.addEventListener('input', function() {
        document.getElementById('vid-speed-val').textContent = (this.value / 100) + '×';
        saveVidSettings();
    });
    if (vidFade) vidFade.addEventListener('input', function() {
        const v = parseFloat(this.value);
        document.getElementById('vid-fade-val').textContent = v === 0 ? 'Off' : v + 's';
        saveVidSettings();
    });
    if (vidMute) vidMute.addEventListener('change', function() {
        updateMuteToggleUI(this.checked);
        saveVidSettings();
    });
})();

// --- Blur Slider Runtime Interaction ---
blurSlider.addEventListener('input', function() {
    const value = this.value;
    blurValueDisplay.textContent = `${value}px`;
    document.documentElement.style.setProperty('--blur-amount', `${value}px`);
    chrome.storage.local.set({ blurSetting: parseInt(value) });
});

// --- Reset Blur Button Listener ---
resetBlurBtn.addEventListener('click', function() {
    const defaultBlur = 25;
    blurSlider.value = defaultBlur;
    blurValueDisplay.textContent = `${defaultBlur}px`;
    document.documentElement.style.setProperty('--blur-amount', `${defaultBlur}px`);
    chrome.storage.local.set({ blurSetting: defaultBlur });
});

// --- Helper: applies the Glass Darkness slider value to CSS variables ---
// Positive values (0 to 80) darken the glass via --glass-darkness (rgba black alpha).
// Negative values (0 to -100) lighten the glass via --glass-lightness (rgba white alpha),
// effectively producing a "light mode" glass effect.
function applyDarknessValue(value) {
    const num = parseInt(value);
    if (num >= 0) {
        document.documentElement.style.setProperty('--glass-darkness', num / 100);
        document.documentElement.style.setProperty('--glass-lightness', 0);
    } else {
        document.documentElement.style.setProperty('--glass-darkness', 0);
        document.documentElement.style.setProperty('--glass-lightness', Math.abs(num) / 100);
    }
}

// --- Darkness Slider Runtime Interaction ---
darknessSlider.addEventListener('input', function() {
    const value = this.value;
    darknessValueDisplay.textContent = `${value}%`;
    applyDarknessValue(value);
    chrome.storage.local.set({ darknessSetting: parseInt(value) });
});

// --- Reset Darkness Button Listener ---
resetDarknessBtn.addEventListener('click', function() {
    const defaultDarkness = 0;
    darknessSlider.value = defaultDarkness;
    darknessValueDisplay.textContent = `${defaultDarkness}%`;
    applyDarknessValue(defaultDarkness);
    chrome.storage.local.set({ darknessSetting: defaultDarkness });
});

// =============================================
//   TEXTURE OVERLAY ENGINE
// =============================================

const TEXTURE_NONE = 'none';

function applyTextureOverlay(type, opacity, density) {
    const el = document.getElementById('texture-overlay-el');
    if (!el) return;

    // Sync select
    if (textureSelect) textureSelect.value = type || TEXTURE_NONE;

    // Show/hide sliders
    const hasTexture = type && type !== TEXTURE_NONE;
    if (textureSlidersWrap) textureSlidersWrap.style.display = hasTexture ? 'block' : 'none';

    if (!hasTexture) {
        el.style.display = 'none';
        el.className = '';
        return;
    }

    // Clamp values
    const op  = Math.min(100, Math.max(1,  parseInt(opacity)  || 30));
    const den = Math.min(10,  Math.max(1,  parseInt(density)  || 3));

    // Density drives the CSS variable: map 1–10 → 4px–80px spacing
    const spacingPx = Math.round(4 + (den - 1) * (80 - 4) / 9);

    document.documentElement.style.setProperty('--texture-opacity', op / 100);
    document.documentElement.style.setProperty('--texture-density', spacingPx);

    // Sync slider UI
    if (textureOpacitySlider)  textureOpacitySlider.value   = op;
    if (textureOpacityDisplay) textureOpacityDisplay.textContent = op + '%';
    if (textureDensitySlider)  textureDensitySlider.value   = den;
    if (textureDensityDisplay) textureDensityDisplay.textContent = den + '×';

    el.className = 'texture-' + type;
    el.style.display = '';
}

function saveTextureSetting() {
    const type    = textureSelect    ? textureSelect.value               : TEXTURE_NONE;
    const opacity = textureOpacitySlider  ? parseInt(textureOpacitySlider.value)  : 30;
    const density = textureDensitySlider  ? parseInt(textureDensitySlider.value)  : 3;
    chrome.storage.local.set({ textureSetting: { type, opacity, density } });
}

// Texture select change
textureSelect && textureSelect.addEventListener('change', function() {
    const type    = this.value;
    const opacity = textureOpacitySlider  ? parseInt(textureOpacitySlider.value)  : 30;
    const density = textureDensitySlider  ? parseInt(textureDensitySlider.value)  : 3;
    applyTextureOverlay(type, opacity, density);
    saveTextureSetting();
});

// Opacity slider
textureOpacitySlider && textureOpacitySlider.addEventListener('input', function() {
    const op = parseInt(this.value);
    if (textureOpacityDisplay) textureOpacityDisplay.textContent = op + '%';
    document.documentElement.style.setProperty('--texture-opacity', op / 100);
    saveTextureSetting();
});

// Density slider
textureDensitySlider && textureDensitySlider.addEventListener('input', function() {
    const den = parseInt(this.value);
    if (textureDensityDisplay) textureDensityDisplay.textContent = den + '×';
    const spacingPx = Math.round(4 + (den - 1) * (80 - 4) / 9);
    document.documentElement.style.setProperty('--texture-density', spacingPx);
    saveTextureSetting();
});

// --- Dark Text Mode Toggle ---
function applyDarkTextMode(isDark) {
    if (isDark) {
        document.body.classList.add('dark-text');
        toggleTrack.style.background = 'rgba(0,0,0,0.4)';
        toggleThumb.style.transform = 'translateX(18px)';
        toggleThumb.style.background = '#111111';
    } else {
        document.body.classList.remove('dark-text');
        toggleTrack.style.background = 'rgba(255,255,255,0.15)';
        toggleThumb.style.transform = 'translateX(0)';
        toggleThumb.style.background = '#ffffff';
    }
}

darkTextToggle.addEventListener('change', function() {
    const isDark = this.checked;
    applyDarkTextMode(isDark);
    chrome.storage.local.set({ darkTextSetting: isDark });
});

// --- updateClockTypeUI: show/hide digital vs analog option panels ---
function updateClockTypeUI(type) {
    const digitalOpts = document.getElementById('digital-clock-opts');
    const analogOpts  = document.getElementById('analog-clock-opts');
    if (digitalOpts) digitalOpts.classList.toggle('hidden', type === 'analog');
    if (analogOpts)  analogOpts.classList.toggle('hidden',  type !== 'analog');
}

// --- Helper: save all clock settings at once ---
function saveClockSettings() {
    const cs = {
        enabled:     clockEnabled,
        type:        clockType,
        shape:       analogShape,
        face:        analogFace,
        hands:       analogHands,
        bgOp:        analogBgOp,
        bordOp:      analogBordOp,
        dateEnabled: dateEnabled,
        dateFormat:  dateFormat
    };
    chrome.storage.local.set({ clockSettings: cs });
}

// --- Helper: save weather settings ---
function saveWeatherSettings() {
    chrome.storage.local.set({ weatherSettings: { unit: weatherUnit, display: weatherDisplay } });
}

// --- Clock Format Toggle ---
document.getElementById('clock-format-select').addEventListener('change', function() {
    clockFormat = this.value;
    updateDashboard();
    chrome.storage.local.set({ clockFormatSetting: clockFormat });
    // Re-render alarm list so displayed times respect the new format
    const alarmList = document.getElementById('alarm-list');
    if (alarmList && alarmList.children.length) {
        const renderFn = window._renderAlarmList;
        if (typeof renderFn === 'function') renderFn();
    }
    // Rebuild alarm picker columns for new format
    if (typeof window._rebuildAlarmPicker === 'function') window._rebuildAlarmPicker();
});

// --- Clock Enabled Toggle ---
document.getElementById('clock-enabled-toggle') && document.getElementById('clock-enabled-toggle').addEventListener('change', function() {
    clockEnabled = this.checked;
    updateDashboard();
    saveClockSettings();
});

// --- Clock Type Select ---
document.getElementById('clock-type-select') && document.getElementById('clock-type-select').addEventListener('change', function() {
    clockType = this.value;
    updateClockTypeUI(clockType);
    updateDashboard();
    saveClockSettings();
});

// --- Analog Shape Select ---
document.getElementById('analog-shape-select') && document.getElementById('analog-shape-select').addEventListener('change', function() {
    analogShape = this.value;
    updateDashboard();
    saveClockSettings();
});

// --- Analog Face Select ---
document.getElementById('analog-face-select') && document.getElementById('analog-face-select').addEventListener('change', function() {
    analogFace = this.value;
    updateDashboard();
    saveClockSettings();
});

// --- Analog Hands Select ---
document.getElementById('analog-hands-select') && document.getElementById('analog-hands-select').addEventListener('change', function() {
    analogHands = this.value;
    updateDashboard();
    saveClockSettings();
});

// --- Analog Background Opacity Slider ---
document.getElementById('analog-bg-opacity') && document.getElementById('analog-bg-opacity').addEventListener('input', function() {
    analogBgOp = parseInt(this.value) / 100;
    const valEl = document.getElementById('analog-bg-opacity-val');
    if (valEl) valEl.textContent = this.value + '%';
    updateDashboard();
    saveClockSettings();
});

// --- Analog Border Opacity Slider ---
document.getElementById('analog-border-opacity') && document.getElementById('analog-border-opacity').addEventListener('input', function() {
    analogBordOp = parseInt(this.value) / 100;
    const valEl = document.getElementById('analog-border-opacity-val');
    if (valEl) valEl.textContent = this.value + '%';
    updateDashboard();
    saveClockSettings();
});

// --- Reset Face Opacity Button ---
document.getElementById('reset-analog-bg-btn') && document.getElementById('reset-analog-bg-btn').addEventListener('click', function() {
    const defaultVal = 60;
    analogBgOp = defaultVal / 100;
    const slider = document.getElementById('analog-bg-opacity');
    const valEl  = document.getElementById('analog-bg-opacity-val');
    if (slider) slider.value = defaultVal;
    if (valEl)  valEl.textContent = defaultVal + '%';
    updateDashboard();
    saveClockSettings();
});

// --- Reset Border Opacity Button ---
document.getElementById('reset-analog-border-btn') && document.getElementById('reset-analog-border-btn').addEventListener('click', function() {
    const defaultVal = 70;
    analogBordOp = defaultVal / 100;
    const slider = document.getElementById('analog-border-opacity');
    const valEl  = document.getElementById('analog-border-opacity-val');
    if (slider) slider.value = defaultVal;
    if (valEl)  valEl.textContent = defaultVal + '%';
    updateDashboard();
    saveClockSettings();
});
document.getElementById('date-enabled-toggle') && document.getElementById('date-enabled-toggle').addEventListener('change', function() {
    dateEnabled = this.checked;
    const fmtOpts = document.getElementById('date-format-opts');
    if (fmtOpts) fmtOpts.classList.toggle('hidden', !dateEnabled);
    updateDashboard();
    saveClockSettings();
});

// --- Date Format Select ---
document.getElementById('date-format-select') && document.getElementById('date-format-select').addEventListener('change', function() {
    dateFormat = this.value;
    updateDashboard();
    saveClockSettings();
});

// --- Weather Unit Select ---
document.getElementById('weather-unit-select') && document.getElementById('weather-unit-select').addEventListener('change', function() {
    weatherUnit = this.value;
    if (_rawWeatherTemp !== null && _rawWeatherCode !== null) {
        renderWeatherUI(_rawWeatherTemp, _rawWeatherCode);
    }
    saveWeatherSettings();
});

// --- Weather Display Select ---
document.getElementById('weather-display-select') && document.getElementById('weather-display-select').addEventListener('change', function() {
    weatherDisplay = this.value;
    if (_rawWeatherTemp !== null && _rawWeatherCode !== null) {
        renderWeatherUI(_rawWeatherTemp, _rawWeatherCode);
    }
    saveWeatherSettings();
});

// --- Shortcut / Side Button Lock ---
function applyShortcutLock(locked) {
    document.querySelectorAll('.shortcut-item').forEach(el => {
        el.setAttribute('draggable', locked ? 'false' : 'true');
    });
    document.querySelectorAll('#manage-list .manage-item').forEach(el => {
        el.setAttribute('draggable', locked ? 'false' : 'true');
        el.style.cursor = locked ? 'default' : 'grab';
    });
}

document.getElementById('lock-shortcuts-toggle') && document.getElementById('lock-shortcuts-toggle').addEventListener('change', function() {
    const locked = this.checked;
    chrome.storage.local.set({ lockShortcuts: locked });
    applyShortcutLock(locked);
});

document.getElementById('lock-side-btns-toggle') && document.getElementById('lock-side-btns-toggle').addEventListener('change', function() {
    const locked = this.checked;
    chrome.storage.local.set({ lockSideBtns: locked });
    // Re-render side button manage list with lock state
    chrome.storage.local.get(['sideBtnOrder', 'sideBtnVisibility'], function(r) {
        renderSideBtnManageList(r.sideBtnOrder, r.sideBtnVisibility, locked);
    });
});


settingsBtn.addEventListener('click', () => settingsModal.classList.add('active'));
closeModal.addEventListener('click', () => settingsModal.classList.remove('active'));
window.addEventListener('click', (e) => {
    if (e.target === settingsModal) settingsModal.classList.remove('active');
});

// If settings btn is hidden, clicking the container area at its position still opens settings
// We handle this by keeping the button in DOM (display:none) but adding a ghost click zone
document.getElementById('side-buttons-container').addEventListener('click', function(e) {
    // If click doesn't match any visible btn but settings is hidden, open settings
    if (e.target === this) {
        chrome.storage.local.get(['sideBtnVisibility'], function(r) {
            const vis = r.sideBtnVisibility || {};
            if (vis['settings'] === false) {
                settingsModal.classList.add('active');
            }
        });
    }
});

document.addEventListener('DOMContentLoaded', function() {
    initWeather();   // run once — geolocation + 30-min cache, never re-triggered by UI actions
    initExtension();
});

// =============================================
//   SIDE BUTTONS ENGINE
//   Handles order, visibility, drag-to-reorder
// =============================================

const SIDE_BTN_DEFAULTS = ['settings', 'history', 'bookmarks', 'calendar', 'notes', 'timer'];

function initSideButtons(savedOrder, savedVisibility, locked) {
    // Merge any defaults missing from a previously saved order (e.g. timer added after initial install)
    let order = savedOrder ? [...savedOrder] : [...SIDE_BTN_DEFAULTS];
    SIDE_BTN_DEFAULTS.forEach(id => { if (!order.includes(id)) order.push(id); });
    const visibility = savedVisibility || {};

    const container = document.getElementById('side-buttons-container');
    if (!container) return;

    // Reorder DOM buttons to match saved order
    order.forEach(id => {
        const btn = document.getElementById(id + '-btn');
        if (btn) container.appendChild(btn);
    });

    // Apply visibility
    order.forEach(id => {
        const btn = document.getElementById(id + '-btn');
        if (!btn) return;
        // settings btn: never truly removed, just hidden visually if toggled off
        if (visibility[id] === false) {
            btn.style.display = 'none';
        } else {
            btn.style.display = '';
        }
    });

    // Setup drag-to-reorder on container (unless locked)
    setupSideBtnDrag(locked);

    // Render the manage list in settings
    renderSideBtnManageList(order, visibility, locked);
}

let sideBtnDragId = null;

// Stored named drag handler references so they can be cleanly removed on re-init
const _sideBtnDragHandlers = new WeakMap();

function setupSideBtnDrag(locked) {
    const container = document.getElementById('side-buttons-container');
    if (!container) return;

    // Remove any previously attached drag listeners and reset draggable attribute
    container.querySelectorAll('.side-btn').forEach(btn => {
        btn.removeAttribute('draggable');
        const h = _sideBtnDragHandlers.get(btn);
        if (h) {
            btn.removeEventListener('dragstart', h.dragstart);
            btn.removeEventListener('dragend',   h.dragend);
            btn.removeEventListener('dragover',  h.dragover);
            btn.removeEventListener('dragleave', h.dragleave);
            btn.removeEventListener('drop',      h.drop);
            _sideBtnDragHandlers.delete(btn);
        }
    });

    if (locked) return;

    container.querySelectorAll('.side-btn').forEach(btn => {
        btn.setAttribute('draggable', 'true');

        const handlers = {
            dragstart: function(e) {
                sideBtnDragId = btn.dataset.btnId;
                btn.classList.add('btn-dragging');
                e.dataTransfer.effectAllowed = 'move';
            },
            dragend: function() {
                btn.classList.remove('btn-dragging');
                container.querySelectorAll('.side-btn').forEach(b => b.classList.remove('btn-drag-over'));
                sideBtnDragId = null;
            },
            dragover: function(e) {
                e.preventDefault();
                if (btn.dataset.btnId !== sideBtnDragId) {
                    btn.classList.add('btn-drag-over');
                }
            },
            dragleave: function() {
                btn.classList.remove('btn-drag-over');
            },
            drop: function(e) {
                e.preventDefault();
                btn.classList.remove('btn-drag-over');
                const targetId = btn.dataset.btnId;
                if (sideBtnDragId && sideBtnDragId !== targetId) {
                    reorderSideBtn(sideBtnDragId, targetId);
                }
            }
        };

        btn.addEventListener('dragstart', handlers.dragstart);
        btn.addEventListener('dragend',   handlers.dragend);
        btn.addEventListener('dragover',  handlers.dragover);
        btn.addEventListener('dragleave', handlers.dragleave);
        btn.addEventListener('drop',      handlers.drop);
        _sideBtnDragHandlers.set(btn, handlers);
    });
}

function reorderSideBtn(fromId, toId) {
    chrome.storage.local.get(['sideBtnOrder', 'sideBtnVisibility', 'lockSideBtns'], function(r) {
        // Merge missing defaults so timer (and any future buttons) are always present
        let order = r.sideBtnOrder ? [...r.sideBtnOrder] : [...SIDE_BTN_DEFAULTS];
        SIDE_BTN_DEFAULTS.forEach(id => { if (!order.includes(id)) order.push(id); });
        const fromIdx = order.indexOf(fromId);
        const toIdx = order.indexOf(toId);
        if (fromIdx === -1 || toIdx === -1) return;
        order.splice(fromIdx, 1);
        order.splice(toIdx, 0, fromId);
        chrome.storage.local.set({ sideBtnOrder: order }, function() {
            initSideButtons(order, r.sideBtnVisibility, r.lockSideBtns || false);
        });
    });
}

function renderSideBtnManageList(order, visibility, locked) {
    const list = document.getElementById('side-buttons-manage');
    if (!list) return;
    const ord = order || SIDE_BTN_DEFAULTS;
    const vis = visibility || {};

    const LABELS = { settings: 'Settings', history: 'History', bookmarks: 'Bookmarks', calendar: 'Calendar', notes: 'Notes', timer: 'Timer & Alarm' };

    list.innerHTML = '';
    let manageDragId = null;

    ord.forEach(id => {
        const item = document.createElement('div');
        item.className = 'side-btn-manage-item';
        item.dataset.id = id;
        if (!locked) {
            item.setAttribute('draggable', 'true');
        }

        const handle = document.createElement('span');
        handle.className = 'side-btn-manage-drag-handle';
        handle.innerHTML = `<svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none"><circle cx="9" cy="5" r="1" fill="currentColor" stroke="none"></circle><circle cx="15" cy="5" r="1" fill="currentColor" stroke="none"></circle><circle cx="9" cy="12" r="1" fill="currentColor" stroke="none"></circle><circle cx="15" cy="12" r="1" fill="currentColor" stroke="none"></circle><circle cx="9" cy="19" r="1" fill="currentColor" stroke="none"></circle><circle cx="15" cy="19" r="1" fill="currentColor" stroke="none"></circle></svg>`;
        if (locked) handle.style.opacity = '0.15';

        const label = document.createElement('span');
        label.textContent = LABELS[id] || id;

        const visBtn = document.createElement('button');
        visBtn.className = 'side-btn-manage-visibility' + (vis[id] === false ? ' hidden-btn' : '');
        visBtn.textContent = vis[id] === false ? 'Hidden' : 'Visible';

        // Settings is special: can only be hidden (clicking same spot still opens settings)
        visBtn.addEventListener('click', () => {
            chrome.storage.local.get(['sideBtnOrder', 'sideBtnVisibility', 'lockSideBtns'], function(r) {
                const v = r.sideBtnVisibility || {};
                v[id] = v[id] === false ? true : false;
                chrome.storage.local.set({ sideBtnVisibility: v }, function() {
                    initSideButtons(r.sideBtnOrder, v, r.lockSideBtns || false);
                });
            });
        });

        item.appendChild(handle);
        item.appendChild(label);
        item.appendChild(visBtn);

        if (!locked) {
            item.addEventListener('dragstart', function(e) {
                manageDragId = this.dataset.id;
                this.style.opacity = '0.5';
                e.dataTransfer.effectAllowed = 'move';
            });
            item.addEventListener('dragend', function() {
                this.style.opacity = '1';
                list.querySelectorAll('.side-btn-manage-item').forEach(el => el.classList.remove('drag-over'));
                manageDragId = null;
            });
            item.addEventListener('dragover', function(e) {
                e.preventDefault();
                if (this.dataset.id !== manageDragId) this.classList.add('drag-over');
            });
            item.addEventListener('dragleave', function() {
                this.classList.remove('drag-over');
            });
            item.addEventListener('drop', function(e) {
                e.preventDefault();
                this.classList.remove('drag-over');
                if (manageDragId && manageDragId !== this.dataset.id) {
                    reorderSideBtn(manageDragId, this.dataset.id);
                }
            });
        }

        list.appendChild(item);
    });
}

// =============================================
//   BOOKMARKS PANEL ENGINE
// =============================================

(function BookmarksPanel() {
    const bookmarksBtn  = document.getElementById('bookmarks-btn');
    const panel         = document.getElementById('bookmarks-panel');
    const backdrop      = document.getElementById('bookmarks-backdrop');
    const closeBtn      = document.getElementById('close-bookmarks');
    const bmList        = document.getElementById('bm-list');
    const bmEmpty       = document.getElementById('bm-empty');
    const bmSearch      = document.getElementById('bm-search');
    const bmSearchClear = document.getElementById('bm-search-clear');
    const bmBreadcrumb  = document.getElementById('bm-breadcrumb');
    const bmAddBtn      = document.getElementById('bm-add-btn');

    // Context menus
    const ctxBmItem    = document.getElementById('ctx-bm-item');
    const ctxBmFolder  = document.getElementById('ctx-bm-folder');
    const ctxBmBg      = document.getElementById('ctx-bm-bg');

    // Popups
    const bmAddPopup   = document.getElementById('ctx-bm-add-popup');
    const bmEditPopup  = document.getElementById('ctx-bm-edit-popup');

    // Navigation stack: array of { id, title } objects
    let navStack = [];
    let searchQuery = '';
    let allBookmarksFlat = []; // used for search
    let panelOpen = false;

    // Context-menu state
    let ctxNode = null;       // bookmark/folder node the menu was opened on
    let activeBmMenu = null;
    let bmCtxDismissHandler = null;

    // Add/edit popup state
    let addPopupType = 'bookmark'; // 'bookmark' | 'folder'
    let addPopupParentId = '0';
    let editPopupNode = null; // node being edited/renamed

    // Drag state
    let bmDragNode = null;
    let bmDragEl   = null;

    // ---- Open / Close ----
    function openPanel() {
        panelOpen = true;
        panel.classList.add('open');
        backdrop.classList.add('active');
        bookmarksBtn.classList.add('active');
        if (navStack.length === 0) {
            loadFolder('0'); // Chrome root
        }
    }

    function closePanel() {
        panelOpen = false;
        panel.classList.remove('open');
        backdrop.classList.remove('active');
        bookmarksBtn.classList.remove('active');
        hideAllBmMenus();
    }

    bookmarksBtn.addEventListener('click', () => panelOpen ? closePanel() : openPanel());
    closeBtn.addEventListener('click', closePanel);
    backdrop.addEventListener('click', closePanel);

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && panelOpen) {
            if (activeBmMenu) { hideAllBmMenus(); return; }
            if (!bmAddPopup.classList.contains('ctx-popup-hidden')) { closeBmAddPopup(); return; }
            if (!bmEditPopup.classList.contains('ctx-popup-hidden')) { closeBmEditPopup(); return; }
            closePanel();
        }
    });

    // ---- Folder Loading ----
    function loadFolder(folderId, folderTitle) {
        searchQuery = '';
        bmSearch.value = '';
        bmSearchClear.classList.add('hidden');

        if (folderId === '0') {
            navStack = [{ id: '0', title: 'Bookmarks' }];
        } else {
            // Push if not already navigating back
            const existingIdx = navStack.findIndex(n => n.id === folderId);
            if (existingIdx !== -1) {
                navStack = navStack.slice(0, existingIdx + 1);
            } else {
                navStack.push({ id: folderId, title: folderTitle || 'Folder' });
            }
        }

        renderBreadcrumb();
        refreshCurrentFolder();
    }

    function refreshCurrentFolder() {
        const current = navStack[navStack.length - 1];
        if (!current) return;
        chrome.bookmarks.getChildren(current.id, function(children) {
            renderItems(children || []);
        });
        buildFlatList();
    }

    // ---- Breadcrumb ----
    function renderBreadcrumb() {
        bmBreadcrumb.innerHTML = '';
        navStack.forEach((crumb, idx) => {
            const btn = document.createElement('button');
            btn.className = 'bm-breadcrumb-item';
            btn.textContent = crumb.title || 'Bookmarks';
            btn.title = crumb.title;
            if (idx < navStack.length - 1) {
                btn.addEventListener('click', () => {
                    navStack = navStack.slice(0, idx + 1);
                    loadFolder(crumb.id, crumb.title);
                });

                // Allow dragging a bookmark/folder onto an ancestor crumb to
                // move it up out of the current folder (e.g. back to "root").
                // The virtual root ('0') can't hold items directly, so skip it.
                if (crumb.id !== '0') {
                    btn.addEventListener('dragover', function(e) {
                        if (!bmDragNode || bmDragNode.id === crumb.id) return;
                        e.preventDefault();
                        e.dataTransfer.dropEffect = 'move';
                        btn.classList.add('bm-crumb-drag-over');
                    });
                    btn.addEventListener('dragleave', function() {
                        btn.classList.remove('bm-crumb-drag-over');
                    });
                    btn.addEventListener('drop', function(e) {
                        if (!bmDragNode || bmDragNode.id === crumb.id) return;
                        e.preventDefault();
                        e.stopPropagation();
                        btn.classList.remove('bm-crumb-drag-over');

                        const dragged = bmDragNode;
                        chrome.bookmarks.move(dragged.id, { parentId: crumb.id }, function() {
                            refreshCurrentFolder();
                            showBmToast(`Moved "${dragged.title || 'Item'}" to "${crumb.title || 'Bookmarks'}"`);
                        });
                    });
                }
            } else {
                btn.style.opacity = '1';
                btn.style.fontWeight = '600';
                btn.style.cursor = 'default';
            }
            bmBreadcrumb.appendChild(btn);

            if (idx < navStack.length - 1) {
                const sep = document.createElement('span');
                sep.className = 'bm-breadcrumb-sep';
                sep.textContent = '›';
                bmBreadcrumb.appendChild(sep);
            }
        });
    }

    // ---- Render Items ----
    function renderItems(items) {
        bmList.innerHTML = '';
        bmEmpty.classList.add('hidden');

        if (!items || items.length === 0) {
            bmEmpty.classList.remove('hidden');
            return;
        }

        // Separate folders and bookmarks
        const folders   = items.filter(i => !i.url);
        const bookmarks = items.filter(i =>  i.url);

        if (folders.length > 0) {
            appendSectionLabel('Folders');
            folders.forEach(f => appendFolder(f));
        }

        if (bookmarks.length > 0) {
            if (folders.length > 0) appendSectionLabel('Bookmarks');
            bookmarks.forEach(b => appendBookmark(b));
        }
    }

    function appendSectionLabel(text) {
        const div = document.createElement('div');
        div.className = 'bm-section-label';
        div.textContent = text;
        bmList.appendChild(div);
    }

    function appendFolder(node) {
        const div = document.createElement('div');
        div.className = 'bm-item folder';
        div.setAttribute('draggable', 'true');
        div.dataset.bmId = node.id;
        div.dataset.bmType = 'folder';

        // Folder icon
        const iconWrap = document.createElement('div');
        iconWrap.className = 'bm-item-icon';
        iconWrap.innerHTML = `<svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor" opacity="0.75"><path d="M10 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"/></svg>`;

        const label = document.createElement('div');
        label.className = 'bm-item-label';

        const name = document.createElement('span');
        name.className = 'bm-name';
        name.textContent = node.title || 'Untitled Folder';

        // Count children
        chrome.bookmarks.getChildren(node.id, function(children) {
            if (children && children.length > 0) {
                const badge = document.createElement('span');
                badge.className = 'bm-count-badge';
                badge.textContent = children.length;
                div.insertBefore(badge, chevron);
            }
        });

        label.appendChild(name);

        const chevron = document.createElement('span');
        chevron.className = 'bm-chevron';
        chevron.innerHTML = `<svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2.5" fill="none"><polyline points="9 18 15 12 9 6"></polyline></svg>`;

        div.appendChild(iconWrap);
        div.appendChild(label);
        div.appendChild(chevron);

        div.addEventListener('click', () => loadFolder(node.id, node.title));

        div.addEventListener('contextmenu', function(e) {
            e.preventDefault();
            e.stopPropagation();
            ctxNode = node;
            const nameEl = document.getElementById('ctx-bm-folder-name');
            if (nameEl) nameEl.textContent = node.title || 'Untitled Folder';
            showBmMenu(ctxBmFolder, e.clientX, e.clientY);
        });

        attachBmDragHandlers(div, node);
        bmList.appendChild(div);
    }

    function appendBookmark(node, highlight) {
        const anchor = document.createElement('a');
        anchor.className = 'bm-item';
        anchor.href = node.url;
        anchor.target = '_blank';
        anchor.rel = 'noopener noreferrer';
        anchor.setAttribute('draggable', 'true');
        anchor.dataset.bmId = node.id;
        anchor.dataset.bmType = 'bookmark';

        // Favicon
        const iconWrap = document.createElement('div');
        iconWrap.className = 'bm-item-icon';
        const img = document.createElement('img');
        img.src = `https://www.google.com/s2/favicons?domain=${node.url}&sz=32`;
        img.alt = '';
        img.onerror = function() {
            this.style.display = 'none';
            iconWrap.innerHTML = `<svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path></svg>`;
        };
        iconWrap.appendChild(img);

        const label = document.createElement('div');
        label.className = 'bm-item-label';

        const name = document.createElement('span');
        name.className = 'bm-name';

        const urlSpan = document.createElement('span');
        urlSpan.className = 'bm-url';

        if (highlight) {
            appendHighlightedText(name, node.title || 'Untitled', highlight);
            appendHighlightedText(urlSpan, getDomain(node.url), highlight);
        } else {
            name.textContent    = node.title || 'Untitled';
            urlSpan.textContent = getDomain(node.url);
        }

        label.appendChild(name);
        label.appendChild(urlSpan);

        anchor.appendChild(iconWrap);
        anchor.appendChild(label);

        anchor.addEventListener('contextmenu', function(e) {
            e.preventDefault();
            e.stopPropagation();
            ctxNode = node;
            const nameEl = document.getElementById('ctx-bm-item-name');
            if (nameEl) nameEl.textContent = node.title || 'Untitled';
            showBmMenu(ctxBmItem, e.clientX, e.clientY);
        });

        // Only attach reorder drag handlers outside of search results
        if (!highlight) attachBmDragHandlers(anchor, node);
        bmList.appendChild(anchor);
    }

    function getDomain(url) {
        try { return new URL(url).hostname.replace('www.', ''); }
        catch(e) { return url; }
    }

    // =============================================
    //   DRAG & DROP REORDER / MOVE
    // =============================================

    function attachBmDragHandlers(el, node) {
        el.addEventListener('dragstart', function(e) {
            bmDragNode = node;
            bmDragEl = el;
            el.classList.add('bm-dragging');
            e.dataTransfer.effectAllowed = 'move';
            // Prevent the anchor's default drag-as-link ghost from looking odd
            try { e.dataTransfer.setData('text/plain', node.id); } catch(err) {}
        });

        el.addEventListener('dragend', function() {
            el.classList.remove('bm-dragging');
            clearBmDragOverStyles();
            bmDragNode = null;
            bmDragEl = null;
        });

        el.addEventListener('dragover', function(e) {
            if (!bmDragNode || bmDragNode.id === node.id) return;
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';

            clearBmDragOverStyles(el);

            const rect = el.getBoundingClientRect();
            const offsetY = e.clientY - rect.top;

            if (node.url) {
                // Bookmark target: reorder above/below based on cursor position
                const isTopHalf = offsetY < rect.height / 2;
                el.classList.add(isTopHalf ? 'bm-drag-over-top' : 'bm-drag-over-bottom');
            } else {
                // Folder target: top/bottom edges reorder this folder relative
                // to the dropped item; the middle zone moves the item INTO it.
                const edge = rect.height * 0.25;
                if (offsetY < edge) {
                    el.classList.add('bm-drag-over-top');
                } else if (offsetY > rect.height - edge) {
                    el.classList.add('bm-drag-over-bottom');
                } else {
                    el.classList.add('bm-drag-over-into');
                }
            }
        });

        el.addEventListener('dragleave', function() {
            el.classList.remove('bm-drag-over-top', 'bm-drag-over-bottom', 'bm-drag-over-into');
        });

        el.addEventListener('drop', function(e) {
            if (!bmDragNode || bmDragNode.id === node.id) return;
            e.preventDefault();
            e.stopPropagation();

            const isInto    = el.classList.contains('bm-drag-over-into');
            const isTopHalf = el.classList.contains('bm-drag-over-top');
            el.classList.remove('bm-drag-over-top', 'bm-drag-over-bottom', 'bm-drag-over-into');

            const dragged = bmDragNode;

            if (!node.url && isInto) {
                // Dropped on the middle of a folder — move into it (append to end)
                chrome.bookmarks.move(dragged.id, { parentId: node.id }, function() {
                    refreshCurrentFolder();
                    showBmToast(`Moved "${dragged.title || 'Bookmark'}" to "${node.title || 'Folder'}"`);
                });
                return;
            }

            // Reorder within the current folder — works whether the drop
            // target is a bookmark or a folder (top/bottom edges).
            const current = navStack[navStack.length - 1];

            chrome.bookmarks.getChildren(current.id, function(children) {
                const targetIndex = children.findIndex(c => c.id === node.id);
                if (targetIndex === -1) return;

                // Chrome's bookmarks.move(id, {index}) always refers to the
                // position in the ORIGINAL list — no adjustment needed for the
                // item being removed. The old "newIndex--" was wrong for downward
                // drags and caused no-ops / off-by-one errors when moving down.
                const newIndex = isTopHalf ? targetIndex : targetIndex + 1;

                chrome.bookmarks.move(dragged.id, { parentId: current.id, index: newIndex }, function() {
                    refreshCurrentFolder();
                });
            });
        });
    }

    function clearBmDragOverStyles(except) {
        bmList.querySelectorAll('.bm-item').forEach(el => {
            if (el === except) return;
            el.classList.remove('bm-drag-over-top', 'bm-drag-over-bottom', 'bm-drag-over-into');
        });
        bmBreadcrumb.querySelectorAll('.bm-crumb-drag-over').forEach(el => {
            el.classList.remove('bm-crumb-drag-over');
        });
    }

    // Allow dropping onto the empty list area / list background to move
    // an item into the currently open folder (useful when dragging a
    // bookmark out of a nested view back to the parent isn't possible,
    // but mainly keeps drag state tidy if dropped on empty space).
    bmList.addEventListener('dragover', function(e) {
        if (!bmDragNode) return;
        if (e.target === bmList) e.preventDefault();
    });
    bmList.addEventListener('drop', function(e) {
        if (!bmDragNode) return;
        if (e.target !== bmList) return;
        e.preventDefault();
        bmDragNode = null;
        bmDragEl = null;
    });

    // =============================================
    //   CONTEXT MENUS
    // =============================================

    function hideAllBmMenus() {
        [ctxBmItem, ctxBmFolder, ctxBmBg].forEach(m => m && m.classList.remove('ctx-visible'));
        activeBmMenu = null;
        if (bmCtxDismissHandler) {
            document.removeEventListener('mousedown', bmCtxDismissHandler, { capture: true });
            window.removeEventListener('scroll', hideAllBmMenus, true);
            bmCtxDismissHandler = null;
        }
    }

    function showBmMenu(menu, x, y) {
        hideAllBmMenus();
        activeBmMenu = menu;
        menu.style.left = '0px';
        menu.style.top  = '0px';
        menu.classList.add('ctx-visible');

        const rect = menu.getBoundingClientRect();
        const maxX = window.innerWidth  - rect.width  - 8;
        const maxY = window.innerHeight - rect.height - 8;
        menu.style.left = Math.max(8, Math.min(x, maxX)) + 'px';
        menu.style.top  = Math.max(8, Math.min(y, maxY)) + 'px';

        bmCtxDismissHandler = function(ev) {
            if (menu.contains(ev.target)) return;
            hideAllBmMenus();
        };
        setTimeout(() => {
            document.addEventListener('mousedown', bmCtxDismissHandler, { capture: true });
            window.addEventListener('scroll', hideAllBmMenus, { once: true, capture: true });
        }, 0);
    }

    // Right-click on empty area of the bookmarks panel (not on an item)
    panel.addEventListener('contextmenu', function(e) {
        if (e.altKey) return;
        const onItem = e.target.closest('.bm-item');
        const onHeader = e.target.closest('.bm-header');
        if (onItem || onHeader) return;
        e.preventDefault();
        e.stopPropagation();
        showBmMenu(ctxBmBg, e.clientX, e.clientY);
    });

    // ---- Bookmark item menu actions ----
    document.getElementById('ctx-bm-open-new-tab').addEventListener('click', function() {
        hideAllBmMenus();
        if (ctxNode && ctxNode.url) window.open(ctxNode.url, '_blank', 'noopener,noreferrer');
    });

    document.getElementById('ctx-bm-edit').addEventListener('click', function() {
        hideAllBmMenus();
        if (ctxNode) openEditPopup(ctxNode, 'bookmark');
    });

    document.getElementById('ctx-bm-copy-url').addEventListener('click', function() {
        hideAllBmMenus();
        if (!ctxNode || !ctxNode.url) return;
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(ctxNode.url).then(() => showBmToast('URL copied'));
        } else {
            const ta = document.createElement('textarea');
            ta.value = ctxNode.url;
            document.body.appendChild(ta);
            ta.select();
            try { document.execCommand('copy'); showBmToast('URL copied'); } catch(e) {}
            ta.remove();
        }
    });

    document.getElementById('ctx-bm-delete').addEventListener('click', function() {
        hideAllBmMenus();
        if (!ctxNode) return;
        const node = ctxNode;
        if (!confirm(`Delete bookmark "${node.title || 'Untitled'}"?`)) return;
        chrome.bookmarks.remove(node.id, function() {
            refreshCurrentFolder();
            showBmToast('Bookmark deleted');
        });
    });

    // ---- Folder menu actions ----
    document.getElementById('ctx-bmf-open').addEventListener('click', function() {
        hideAllBmMenus();
        if (ctxNode) loadFolder(ctxNode.id, ctxNode.title);
    });

    document.getElementById('ctx-bmf-rename').addEventListener('click', function() {
        hideAllBmMenus();
        if (ctxNode) openEditPopup(ctxNode, 'folder');
    });

    document.getElementById('ctx-bmf-new-bookmark').addEventListener('click', function() {
        hideAllBmMenus();
        if (ctxNode) openAddPopup('bookmark', ctxNode.id, ctxNode.title);
    });

    document.getElementById('ctx-bmf-new-folder').addEventListener('click', function() {
        hideAllBmMenus();
        if (ctxNode) openAddPopup('folder', ctxNode.id, ctxNode.title);
    });

    document.getElementById('ctx-bmf-delete').addEventListener('click', function() {
        hideAllBmMenus();
        if (!ctxNode) return;
        const node = ctxNode;
        if (!confirm(`Delete folder "${node.title || 'Untitled'}" and everything inside it?`)) return;
        chrome.bookmarks.removeTree(node.id, function() {
            refreshCurrentFolder();
            showBmToast('Folder deleted');
        });
    });

    // ---- Background (empty area) menu actions ----
    document.getElementById('ctx-bmbg-new-bookmark').addEventListener('click', function() {
        hideAllBmMenus();
        const current = navStack[navStack.length - 1];
        openAddPopup('bookmark', current.id, current.title);
    });

    document.getElementById('ctx-bmbg-new-folder').addEventListener('click', function() {
        hideAllBmMenus();
        const current = navStack[navStack.length - 1];
        openAddPopup('folder', current.id, current.title);
    });

    // Toolbar add button — same as background "New Bookmark" in current folder
    bmAddBtn && bmAddBtn.addEventListener('click', function() {
        const current = navStack[navStack.length - 1] || { id: '0', title: 'Bookmarks' };
        openAddPopup('bookmark', current.id, current.title);
    });

    // =============================================
    //   ADD BOOKMARK / FOLDER POPUP
    // =============================================

    const bmAddTitle    = document.getElementById('ctx-bm-add-title');
    const bmAddNameEl   = document.getElementById('ctx-bm-add-name');
    const bmAddNameLbl  = document.getElementById('ctx-bm-add-name-label');
    const bmAddUrlEl    = document.getElementById('ctx-bm-add-url');
    const bmAddUrlGroup = document.getElementById('ctx-bm-add-url-group');
    const bmAddLocation = document.getElementById('ctx-bm-add-location');
    const bmAddTabs     = document.querySelectorAll('[data-bm-add-type]');

    function openAddPopup(type, parentId, parentTitle) {
        addPopupType = type;
        addPopupParentId = parentId;
        bmAddNameEl.value = '';
        bmAddUrlEl.value = '';
        setAddPopupType(type);
        bmAddLocation.textContent = `Will be added to: ${parentTitle || 'Bookmarks'}`;
        bmAddPopup.classList.remove('ctx-popup-hidden');
        setTimeout(() => bmAddNameEl.focus(), 120);
    }

    function setAddPopupType(type) {
        addPopupType = type;
        bmAddTabs.forEach(btn => btn.classList.toggle('active', btn.dataset.bmAddType === type));
        if (type === 'folder') {
            bmAddTitle.textContent = 'New Folder';
            bmAddNameLbl.textContent = 'Folder Name';
            bmAddNameEl.placeholder = 'e.g. Work';
            bmAddUrlGroup.classList.add('ctx-hidden');
        } else {
            bmAddTitle.textContent = 'Add Bookmark';
            bmAddNameLbl.textContent = 'Title';
            bmAddNameEl.placeholder = 'e.g. My Bookmark';
            bmAddUrlGroup.classList.remove('ctx-hidden');
        }
    }

    bmAddTabs.forEach(btn => {
        btn.addEventListener('click', function() {
            setAddPopupType(this.dataset.bmAddType);
        });
    });

    function closeBmAddPopup() {
        bmAddPopup.classList.add('ctx-popup-hidden');
    }

    document.getElementById('ctx-bm-add-close').addEventListener('click', closeBmAddPopup);
    document.getElementById('ctx-bm-add-cancel').addEventListener('click', closeBmAddPopup);
    bmAddPopup.addEventListener('click', function(e) {
        if (e.target === bmAddPopup) closeBmAddPopup();
    });

    document.getElementById('ctx-bm-add-save').addEventListener('click', function() {
        const name = bmAddNameEl.value.trim();
        if (!name) {
            bmAddNameEl.focus();
            bmAddNameEl.style.borderColor = 'rgba(255,100,90,0.5)';
            setTimeout(() => bmAddNameEl.style.borderColor = '', 1200);
            return;
        }

        if (addPopupType === 'folder') {
            chrome.bookmarks.create({ parentId: addPopupParentId, title: name }, function() {
                closeBmAddPopup();
                refreshCurrentFolder();
                showBmToast('Folder created');
            });
        } else {
            let url = bmAddUrlEl.value.trim();
            if (!url) {
                bmAddUrlEl.focus();
                bmAddUrlEl.style.borderColor = 'rgba(255,100,90,0.5)';
                setTimeout(() => bmAddUrlEl.style.borderColor = '', 1200);
                return;
            }
            if (!/^https?:\/\//i.test(url) && !/^[a-z][a-z0-9+.-]*:/i.test(url)) url = 'https://' + url;
            chrome.bookmarks.create({ parentId: addPopupParentId, title: name, url: url }, function() {
                closeBmAddPopup();
                refreshCurrentFolder();
                showBmToast('Bookmark added');
            });
        }
    });

    [bmAddNameEl, bmAddUrlEl].forEach(el => {
        el.addEventListener('keydown', function(e) {
            if (e.key === 'Enter') document.getElementById('ctx-bm-add-save').click();
        });
    });

    // =============================================
    //   EDIT BOOKMARK / RENAME FOLDER POPUP
    // =============================================

    const bmEditTitle    = document.getElementById('ctx-bm-edit-title');
    const bmEditNameEl   = document.getElementById('ctx-bm-edit-name');
    const bmEditNameLbl  = document.getElementById('ctx-bm-edit-name-label');
    const bmEditUrlEl    = document.getElementById('ctx-bm-edit-url');
    const bmEditUrlGroup = document.getElementById('ctx-bm-edit-url-group');
    const bmEditIconWrap = document.getElementById('ctx-bm-edit-icon-wrap');

    function openEditPopup(node, type) {
        editPopupNode = node;
        bmEditNameEl.value = node.title || '';

        if (type === 'folder') {
            bmEditTitle.textContent = 'Rename Folder';
            bmEditNameLbl.textContent = 'Folder Name';
            bmEditUrlGroup.classList.add('ctx-hidden');
            bmEditIconWrap.innerHTML = `<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" opacity="0.85"><path d="M10 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"/></svg>`;
        } else {
            bmEditTitle.textContent = 'Edit Bookmark';
            bmEditNameLbl.textContent = 'Title';
            bmEditUrlEl.value = node.url || '';
            bmEditUrlGroup.classList.remove('ctx-hidden');
            bmEditIconWrap.innerHTML = `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>`;
        }

        bmEditPopup.classList.remove('ctx-popup-hidden');
        setTimeout(() => { bmEditNameEl.focus(); bmEditNameEl.select(); }, 120);
    }

    function closeBmEditPopup() {
        bmEditPopup.classList.add('ctx-popup-hidden');
        editPopupNode = null;
    }

    document.getElementById('ctx-bm-edit-close').addEventListener('click', closeBmEditPopup);
    document.getElementById('ctx-bm-edit-cancel').addEventListener('click', closeBmEditPopup);
    bmEditPopup.addEventListener('click', function(e) {
        if (e.target === bmEditPopup) closeBmEditPopup();
    });

    document.getElementById('ctx-bm-edit-save').addEventListener('click', function() {
        if (!editPopupNode) return;
        const name = bmEditNameEl.value.trim();
        if (!name) {
            bmEditNameEl.focus();
            bmEditNameEl.style.borderColor = 'rgba(255,100,90,0.5)';
            setTimeout(() => bmEditNameEl.style.borderColor = '', 1200);
            return;
        }

        const isFolder = !editPopupNode.url;
        const updates = { title: name };

        if (!isFolder) {
            let url = bmEditUrlEl.value.trim();
            if (!url) {
                bmEditUrlEl.focus();
                bmEditUrlEl.style.borderColor = 'rgba(255,100,90,0.5)';
                setTimeout(() => bmEditUrlEl.style.borderColor = '', 1200);
                return;
            }
            if (!/^https?:\/\//i.test(url) && !/^[a-z][a-z0-9+.-]*:/i.test(url)) url = 'https://' + url;
            updates.url = url;
        }

        const renamedId = editPopupNode.id;

        chrome.bookmarks.update(renamedId, updates, function(updatedNode) {
            closeBmEditPopup();

            // Update breadcrumb title if we renamed a folder we're currently inside
            const navIdx = navStack.findIndex(n => n.id === renamedId);
            if (navIdx !== -1) {
                navStack[navIdx].title = name;
                renderBreadcrumb();
            }

            // Patch the item in place immediately — chrome.bookmarks.getChildren()
            // can momentarily return stale data right after update(), so a full
            // refreshCurrentFolder() here can re-render with the old title.
            const itemEl = bmList.querySelector(`[data-bm-id="${renamedId}"]`);
            if (itemEl) {
                const nameEl = itemEl.querySelector('.bm-name');
                if (nameEl) nameEl.textContent = (updatedNode && updatedNode.title) || name;
                if (!isFolder) {
                    const urlEl = itemEl.querySelector('.bm-url');
                    const finalUrl = (updatedNode && updatedNode.url) || updates.url;
                    if (urlEl) urlEl.textContent = getDomain(finalUrl);
                    itemEl.href = finalUrl;
                }
            }

            // Refresh the cached flat list used for search, and re-sync the
            // current folder shortly after — by then the bookmarks API has
            // settled, so this won't clobber the patch above with stale data.
            buildFlatList();
            setTimeout(refreshCurrentFolder, 300);

            showBmToast(isFolder ? 'Folder renamed' : 'Bookmark updated');
        });
    });

    [bmEditNameEl, bmEditUrlEl].forEach(el => {
        el.addEventListener('keydown', function(e) {
            if (e.key === 'Enter') document.getElementById('ctx-bm-edit-save').click();
        });
    });

    // =============================================
    //   TOAST
    // =============================================
    function showBmToast(msg) {
        const existing = document.getElementById('ctx-toast');
        if (existing) existing.remove();
        const toast = document.createElement('div');
        toast.id = 'ctx-toast';
        toast.textContent = msg;
        toast.style.cssText = [
            'position:fixed','bottom:32px','left:50%',
            'transform:translateX(-50%) translateY(10px)',
            'background:rgba(20,20,30,0.88)','color:rgba(255,255,255,0.95)',
            'padding:9px 20px','border-radius:50px','font-size:0.84rem',
            'font-weight:500','z-index:999999',
            'backdrop-filter:blur(var(--blur-amount,25px))',
            '-webkit-backdrop-filter:blur(var(--blur-amount,25px))',
            'border:1px solid rgba(255,255,255,0.12)',
            'box-shadow:0 4px 16px rgba(0,0,0,0.3)',
            'transition:all 0.25s cubic-bezier(0.16,1,0.3,1)','opacity:0',
        ].join(';');
        document.body.appendChild(toast);
        requestAnimationFrame(() => requestAnimationFrame(() => {
            toast.style.opacity = '1';
            toast.style.transform = 'translateX(-50%) translateY(0)';
        }));
        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateX(-50%) translateY(10px)';
            setTimeout(() => toast.remove(), 300);
        }, 2200);
    }

    // ---- Search ----
    function buildFlatList() {
        chrome.bookmarks.getTree(function(tree) {
            allBookmarksFlat = [];
            flattenTree(tree);
        });
    }

    function flattenTree(nodes) {
        nodes.forEach(node => {
            if (node.url) {
                allBookmarksFlat.push(node);
            }
            if (node.children) flattenTree(node.children);
        });
    }

    function appendHighlightedText(container, text, query) {
        if (!query) {
            container.textContent = text;
            return;
        }
        const re = new RegExp(`(${escapeRegex(query)})`, 'gi');
        const parts = text.split(re);
        parts.forEach(part => {
            if (re.test(part)) {
                const mark = document.createElement('mark');
                mark.className = 'bm-highlight';
                mark.textContent = part;
                container.appendChild(mark);
            } else if (part) {
                container.appendChild(document.createTextNode(part));
            }
            re.lastIndex = 0;
        });
    }

    function escapeRegex(str) {
        return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    function runSearch(query) {
        bmList.innerHTML = '';
        bmEmpty.classList.add('hidden');

        if (!query) {
            // Restore current folder view
            refreshCurrentFolder();
            return;
        }

        chrome.bookmarks.search(query, function(results) {
            const bookmarks = results.filter(r => r.url);
            if (bookmarks.length === 0) {
                bmEmpty.classList.remove('hidden');
                return;
            }
            bookmarks.forEach(b => appendBookmark(b, query));
        });
    }

    bmSearch.addEventListener('input', function() {
        searchQuery = this.value.trim();
        bmSearchClear.classList.toggle('hidden', !searchQuery);
        runSearch(searchQuery);
    });

    bmSearchClear.addEventListener('click', function() {
        bmSearch.value = '';
        searchQuery = '';
        this.classList.add('hidden');
        runSearch('');
    });

    // Pre-build flat list when extension loads
    if (chrome && chrome.bookmarks) {
        buildFlatList();
    } else {
        // Graceful: hide button if API unavailable
        bookmarksBtn.style.display = 'none';
    }
})();

// =============================================
//   HISTORY PANEL ENGINE
// =============================================

(function HistoryPanel() {
    const histBtn     = document.getElementById('history-btn');
    const panel       = document.getElementById('history-panel');
    const closeBtn    = document.getElementById('close-history');
    const backdrop    = document.getElementById('side-panel-backdrop');
    const histList    = document.getElementById('history-list');
    const histEmpty   = document.getElementById('history-empty');
    const histSearch  = document.getElementById('history-search');
    const searchClear = document.getElementById('history-search-clear');
    const tabs        = document.querySelectorAll('.history-tab');

    if (!histBtn) return;

    let panelOpen    = false;
    let activeTab    = 'recent';
    let searchQuery  = '';

    function openPanel() {
        // Close other panels
        ['calendar-panel','notes-panel'].forEach(id => {
            const p = document.getElementById(id);
            if (p) p.classList.remove('open');
        });
        ['calendar-btn','notes-btn'].forEach(id => {
            const b = document.getElementById(id);
            if (b) b.classList.remove('active');
        });

        panelOpen = true;
        panel.classList.add('open');
        backdrop.classList.add('active');
        histBtn.classList.add('active');
        loadTab(activeTab);
    }

    function closePanel() {
        panelOpen = false;
        panel.classList.remove('open');
        backdrop.classList.remove('active');
        histBtn.classList.remove('active');
    }

    histBtn.addEventListener('click', () => panelOpen ? closePanel() : openPanel());
    closeBtn.addEventListener('click', closePanel);
    backdrop.addEventListener('click', () => {
        closePanel();
        // also close notes/calendar handled by their own backdrop listeners
    });
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && panelOpen) closePanel(); });

    // Tabs
    tabs.forEach(tab => {
        tab.addEventListener('click', function() {
            tabs.forEach(t => t.classList.remove('active'));
            this.classList.add('active');
            activeTab = this.dataset.tab;
            searchQuery = '';
            histSearch.value = '';
            searchClear.classList.add('hidden');
            loadTab(activeTab);
        });
    });

    // Search
    histSearch.addEventListener('input', function() {
        searchQuery = this.value.trim();
        searchClear.classList.toggle('hidden', !searchQuery);
        if (searchQuery) {
            runHistorySearch(searchQuery);
        } else {
            loadTab(activeTab);
        }
    });
    searchClear.addEventListener('click', function() {
        histSearch.value = '';
        searchQuery = '';
        this.classList.add('hidden');
        loadTab(activeTab);
    });

    function loadTab(tab) {
        histList.innerHTML = '';
        histEmpty.classList.add('hidden');

        if (!chrome || !chrome.history) {
            showEmpty('Browser history not available.');
            return;
        }

        if (tab === 'recent') {
            chrome.history.search({ text: '', maxResults: 50, startTime: Date.now() - 24*60*60*1000 }, function(items) {
                renderHistoryItems(items, false);
            });
        } else if (tab === 'closed') {
            chrome.storage.local.get(['closedTabs'], function(result) {
                const closedTabs = result.closedTabs || [];
                if (closedTabs.length === 0) { showEmpty('No recently closed tabs yet. Close a tab and come back!'); return; }
                const items = closedTabs.map(t => ({ title: t.title, url: t.url, lastVisitTime: t.closedAt, closed: true }));
                renderHistoryItems(items, true);
            });
        } else if (tab === 'all') {
            chrome.history.search({ text: '', maxResults: 200, startTime: 0 }, function(items) {
                renderHistoryItems(items, false);
            });
        }
    }

    function runHistorySearch(query) {
        if (!chrome || !chrome.history) return;
        chrome.history.search({ text: query, maxResults: 80, startTime: 0 }, function(items) {
            renderHistoryItems(items, false);
        });
    }

    function renderHistoryItems(items, showClosedBadge) {
        histList.innerHTML = '';
        if (!items || items.length === 0) {
            showEmpty();
            return;
        }

        // Group by date for non-closed tab views
        if (!showClosedBadge) {
            const groups = {};
            const groupOrder = [];
            items.forEach(item => {
                const dateKey = getDateLabel(item.lastVisitTime);
                if (!groups[dateKey]) { groups[dateKey] = []; groupOrder.push(dateKey); }
                groups[dateKey].push(item);
            });

            groupOrder.forEach(dateKey => {
                const label = document.createElement('div');
                label.className = 'hist-date-label';
                label.textContent = dateKey;
                histList.appendChild(label);
                groups[dateKey].forEach(item => appendHistItem(item, false));
            });
        } else {
            items.forEach(item => appendHistItem(item, true));
        }
    }

    function appendHistItem(item, showClosedBadge) {
        const a = document.createElement('a');
        a.className = 'hist-item';
        a.href = item.url || '#';
        a.target = '_blank';
        a.rel = 'noopener noreferrer';

        const iconWrap = document.createElement('div');
        iconWrap.className = 'hist-item-icon';
        const img = document.createElement('img');
        img.src = `https://www.google.com/s2/favicons?domain=${item.url}&sz=32`;
        img.alt = '';
        img.onerror = function() {
            this.style.display = 'none';
            iconWrap.innerHTML = `<svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>`;
        };
        iconWrap.appendChild(img);

        const lbl = document.createElement('div');
        lbl.className = 'hist-item-label';

        const title = document.createElement('span');
        title.className = 'hist-item-title';
        title.textContent = item.title || getDomainHist(item.url);

        const url = document.createElement('span');
        url.className = 'hist-item-url';
        url.textContent = getDomainHist(item.url);

        lbl.appendChild(title);
        lbl.appendChild(url);

        const timeSpan = document.createElement('span');
        timeSpan.className = 'hist-item-time';
        timeSpan.textContent = formatTime(item.lastVisitTime);

        a.appendChild(iconWrap);
        a.appendChild(lbl);

        if (showClosedBadge) {
            const badge = document.createElement('span');
            badge.className = 'hist-closed-badge';
            badge.textContent = item.isWindow ? 'Window' : 'Tab';
            a.appendChild(badge);
        } else {
            a.appendChild(timeSpan);
        }

        histList.appendChild(a);
    }

    function showEmpty(msg) {
        histEmpty.classList.remove('hidden');
        histEmpty.querySelector('p').textContent = msg || 'No history found';
    }

    function getDomainHist(url) {
        try { return new URL(url).hostname.replace('www.', ''); }
        catch(e) { return url || ''; }
    }

    function getDateLabel(ts) {
        if (!ts) return 'Unknown';
        const d = new Date(ts);
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const yesterday = new Date(today - 86400000);
        const itemDay = new Date(d.getFullYear(), d.getMonth(), d.getDate());

        if (itemDay.getTime() === today.getTime()) return 'Today';
        if (itemDay.getTime() === yesterday.getTime()) return 'Yesterday';
        return d.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
    }

    function formatTime(ts) {
        if (!ts) return '';
        const d = new Date(ts);
        const h = d.getHours(), m = d.getMinutes();
        const ampm = h >= 12 ? 'PM' : 'AM';
        return `${h%12||12}:${String(m).padStart(2,'0')} ${ampm}`;
    }

    if (!chrome || !chrome.history) {
        histBtn.style.display = 'none';
    }
})();

// =============================================
//   CALENDAR PANEL ENGINE
// =============================================
(function CalendarPanel() {
    const calBtn         = document.getElementById('calendar-btn');
    const panel          = document.getElementById('calendar-panel');
    const closeBtn       = document.getElementById('close-calendar');
    const backdrop       = document.getElementById('side-panel-backdrop');
    const calGrid        = document.getElementById('cal-grid');
    const monthLabel     = document.getElementById('cal-month-label');
    const prevBtn        = document.getElementById('cal-prev');
    const nextBtn        = document.getElementById('cal-next');
    const eventsList     = document.getElementById('cal-events-list');
    const selectedLabel  = document.getElementById('cal-selected-label');
    const addEventBtn    = document.getElementById('cal-add-event-btn');
    const addForm        = document.getElementById('cal-add-form');
    const eventTitleIn   = document.getElementById('cal-event-title');
    const eventDateIn    = document.getElementById('cal-event-date');
    const eventTimeIn    = document.getElementById('cal-event-time');
    const eventLocIn     = document.getElementById('cal-event-location');
    const saveEventBtn   = document.getElementById('cal-save-event');
    const cancelEventBtn = document.getElementById('cal-cancel-event');
    const swatches       = document.querySelectorAll('.cal-swatch');
    const icalUrlIn      = document.getElementById('cal-ical-url');
    const icalSaveBtn    = document.getElementById('cal-ical-save');
    const syncStatus     = document.getElementById('cal-sync-status');

    const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
    const today = new Date();

    let panelOpen     = false;
    let currentYear   = today.getFullYear();
    let currentMonth  = today.getMonth();
    let selectedDate  = toKey(today.getFullYear(), today.getMonth(), today.getDate());
    let selectedColor = '#7c8cf8';
    let events        = {}; // { 'YYYY-MM-DD': [{title, time, location, color}] }

    function toKey(y, m, d) {
        const dt = new Date(y, m, d);
        return `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,'0')}-${String(dt.getDate()).padStart(2,'0')}`;
    }

    // ---- Storage ----
    function loadAndRender() {
        chrome.storage.local.get(['calEvents', 'calIcalUrl'], function(r) {
            events = r.calEvents || {};
            if (r.calIcalUrl) icalUrlIn.value = r.calIcalUrl;
            renderGrid();
            renderEventsForDate(selectedDate);
        });
    }

    function saveEvents() {
        chrome.storage.local.set({ calEvents: events });
    }

    // ---- Panel open/close ----
    function openPanel() {
        // Close notes and history panels if open
        document.getElementById('notes-panel').classList.remove('open');
        document.getElementById('notes-btn').classList.remove('active');
        const hp = document.getElementById('history-panel');
        if (hp) hp.classList.remove('open');
        const hb = document.getElementById('history-btn');
        if (hb) hb.classList.remove('active');

        panelOpen = true;
        panel.classList.add('open');
        backdrop.classList.add('active');
        calBtn.classList.add('active');
        loadAndRender();
    }

    function closePanel() {
        panelOpen = false;
        panel.classList.remove('open');
        backdrop.classList.remove('active');
        calBtn.classList.remove('active');
    }

    calBtn.addEventListener('click', () => panelOpen ? closePanel() : openPanel());
    closeBtn.addEventListener('click', closePanel);

    // Backdrop closes both panels
    backdrop.addEventListener('click', () => {
        closePanel();
        document.getElementById('notes-panel').classList.remove('open');
        document.getElementById('notes-btn').classList.remove('active');
        const hp = document.getElementById('history-panel');
        if (hp) hp.classList.remove('open');
        const hb = document.getElementById('history-btn');
        if (hb) hb.classList.remove('active');
        // notesOpen is managed inside NotesPanel IIFE — we just remove visual state here
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && panelOpen) closePanel();
    });

    // ---- Calendar Grid ----
    function renderGrid() {
        monthLabel.textContent = `${MONTHS[currentMonth]} ${currentYear}`;
        calGrid.innerHTML = '';

        const firstDay    = new Date(currentYear, currentMonth, 1).getDay();
        const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
        const prevTotal   = new Date(currentYear, currentMonth, 0).getDate();

        for (let i = firstDay - 1; i >= 0; i--) addDayCell(prevTotal - i, currentYear, currentMonth - 1, true);
        for (let d = 1; d <= daysInMonth; d++) addDayCell(d, currentYear, currentMonth, false);
        const trail = (firstDay + daysInMonth) % 7;
        if (trail > 0) for (let d = 1; d <= (7 - trail); d++) addDayCell(d, currentYear, currentMonth + 1, true);
    }

    function addDayCell(d, y, m, other) {
        const dateObj = new Date(y, m, d);
        const yr = dateObj.getFullYear(), mo = dateObj.getMonth();
        const key = toKey(yr, mo, d);

        const div = document.createElement('div');
        div.className = 'cal-day';
        if (other) div.classList.add('other-month');
        if (yr === today.getFullYear() && mo === today.getMonth() && d === today.getDate()) div.classList.add('today');
        if (key === selectedDate) div.classList.add('selected');

        const num = document.createElement('span');
        num.textContent = d;
        div.appendChild(num);

        const dots = document.createElement('div');
        dots.className = 'event-dots';
        const dayEvts = events[key] || [];
        if (dayEvts.length > 0) {
            div.classList.add('has-events');
            dayEvts.slice(0, 3).forEach(ev => {
                const dot = document.createElement('div');
                dot.className = 'event-dot';
                dot.style.background = ev.color || '#7c8cf8';
                dots.appendChild(dot);
            });
        }
        div.appendChild(dots);
        div.addEventListener('click', () => { selectedDate = key; renderGrid(); renderEventsForDate(key); eventDateIn.value = key; });
        calGrid.appendChild(div);
    }

    prevBtn.addEventListener('click', () => { if (--currentMonth < 0) { currentMonth = 11; currentYear--; } renderGrid(); });
    nextBtn.addEventListener('click', () => { if (++currentMonth > 11) { currentMonth = 0; currentYear++; } renderGrid(); });

    // ---- Events List ----
    function renderEventsForDate(key) {
        if (!key) { selectedLabel.textContent = 'Events'; eventsList.innerHTML = ''; return; }
        const [yr, mo, d] = key.split('-').map(Number);
        const isToday = key === toKey(today.getFullYear(), today.getMonth(), today.getDate());
        selectedLabel.textContent = isToday ? 'Today' : new Date(yr, mo-1, d).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

        eventsList.innerHTML = '';
        const dayEvts = (events[key] || []).slice().sort((a,b) => (a.time||'').localeCompare(b.time||''));
        if (!dayEvts.length) {
            const p = document.createElement('p'); p.className = 'cal-no-events'; p.textContent = 'No events'; eventsList.appendChild(p);
            return;
        }
        dayEvts.forEach(ev => {
            const item = document.createElement('div'); item.className = 'cal-event-item';
            const bar = document.createElement('div'); bar.className = 'cal-event-color-bar'; bar.style.background = ev.color || '#7c8cf8';
            const info = document.createElement('div'); info.className = 'cal-event-info';
            const name = document.createElement('div'); name.className = 'cal-event-name'; name.textContent = ev.title;
            const meta = document.createElement('div'); meta.className = 'cal-event-meta';
            meta.textContent = [ev.time ? fmt12(ev.time) : '', ev.location ? '📍 ' + ev.location : ''].filter(Boolean).join('  ·  ');
            info.appendChild(name); info.appendChild(meta);
            const del = document.createElement('button'); del.className = 'cal-event-delete'; del.textContent = '×'; del.title = 'Delete';
            del.addEventListener('click', () => {
                const idx = events[key].indexOf(ev);
                if (idx > -1) { events[key].splice(idx, 1); if (!events[key].length) delete events[key]; }
                saveEvents(); renderGrid(); renderEventsForDate(key);
            });
            item.appendChild(bar); item.appendChild(info); item.appendChild(del);
            eventsList.appendChild(item);
        });
    }

    function fmt12(t) {
        const [h, m] = t.split(':').map(Number);
        return `${h%12||12}:${String(m).padStart(2,'0')} ${h>=12?'PM':'AM'}`;
    }

    // ---- Add Event Form ----
    addEventBtn.addEventListener('click', () => {
        const hidden = addForm.classList.toggle('hidden');
        if (!hidden) { eventDateIn.value = selectedDate; eventTitleIn.focus(); }
    });
    cancelEventBtn.addEventListener('click', () => addForm.classList.add('hidden'));

    swatches.forEach(s => s.addEventListener('click', () => {
        swatches.forEach(x => x.classList.remove('active'));
        s.classList.add('active');
        selectedColor = s.dataset.color;
    }));

    saveEventBtn.addEventListener('click', () => {
        const title = eventTitleIn.value.trim();
        const date  = eventDateIn.value;
        if (!title || !date) { eventTitleIn.focus(); return; }
        if (!events[date]) events[date] = [];
        events[date].push({ title, time: eventTimeIn.value || '', location: eventLocIn.value.trim(), color: selectedColor });
        saveEvents();
        eventTitleIn.value = ''; eventTimeIn.value = ''; eventLocIn.value = '';
        addForm.classList.add('hidden');
        renderGrid();
        renderEventsForDate(selectedDate);
    });

    // ---- iCal Sync (no OAuth, no script edits — uses public CORS proxy for public feeds) ----
    icalSaveBtn.addEventListener('click', () => {
        const rawUrl = icalUrlIn.value.trim();
        if (!rawUrl) return;

        // Normalize webcal:// → https://
        const icsUrl = rawUrl.replace(/^webcal:\/\//i, 'https://');
        chrome.storage.local.set({ calIcalUrl: rawUrl });

        showSyncStatus('Fetching calendar…', '');

        // Use a public CORS proxy to fetch iCal data directly in the extension
        // corsproxy.io works for publicly shared iCal URLs (Google/Outlook/Apple public feeds)
        const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(icsUrl)}`;

        fetch(proxyUrl)
            .then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.text(); })
            .then(icsText => {
                const parsed = parseICS(icsText);
                if (!parsed.length) { showSyncStatus('No events found in this calendar.', 'error'); return; }

                // Merge imported events (color: teal to distinguish from manual)
                let added = 0;
                parsed.forEach(ev => {
                    if (!ev.date || !ev.title) return;
                    if (!events[ev.date]) events[ev.date] = [];
                    // Avoid exact duplicates
                    const dup = events[ev.date].find(e => e.title === ev.title && e.time === ev.time);
                    if (!dup) { events[ev.date].push({ title: ev.title, time: ev.time, location: ev.location || '', color: '#7cd4f8', imported: true }); added++; }
                });
                saveEvents();
                renderGrid();
                renderEventsForDate(selectedDate);
                showSyncStatus(`✓ Synced ${added} event${added !== 1 ? 's' : ''} from your calendar.`, 'success');
            })
            .catch(err => {
                console.error('iCal sync error:', err);
                showSyncStatus('Could not fetch calendar. Make sure the URL is public and the iCal link is correct.', 'error');
            });
    });

    function showSyncStatus(msg, type) {
        syncStatus.textContent = msg;
        syncStatus.className = 'cal-sync-status' + (type ? ' ' + type : '');
        syncStatus.classList.remove('hidden');
    }

    // ---- Minimal iCal / RFC 5545 Parser ----
    function parseICS(text) {
        const events = [];
        // Unfold lines (RFC 5545 line folding)
        const unfolded = text.replace(/\r?\n[ \t]/g, '');
        const lines = unfolded.split(/\r?\n/);

        let inEvent = false, cur = {};
        lines.forEach(line => {
            if (line === 'BEGIN:VEVENT') { inEvent = true; cur = {}; return; }
            if (line === 'END:VEVENT') {
                if (cur.DTSTART && cur.SUMMARY) {
                    const ds = cur.DTSTART;
                    // Date only: YYYYMMDD
                    let date = '', time = '';
                    if (/^\d{8}$/.test(ds)) {
                        date = `${ds.slice(0,4)}-${ds.slice(4,6)}-${ds.slice(6,8)}`;
                    } else if (/^\d{8}T\d{6}/.test(ds)) {
                        // Datetime: YYYYMMDDTHHMMSSZ — convert to local
                        const d = new Date(`${ds.slice(0,4)}-${ds.slice(4,6)}-${ds.slice(6,8)}T${ds.slice(9,11)}:${ds.slice(11,13)}:${ds.slice(13,15)}Z`);
                        date = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
                        time = `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
                    }
                    events.push({ title: cur.SUMMARY, date, time, location: cur.LOCATION || '' });
                }
                inEvent = false; cur = {};
                return;
            }
            if (!inEvent) return;
            // Handle property parameters like DTSTART;TZID=...:value
            const colonIdx = line.indexOf(':');
            if (colonIdx < 0) return;
            const propFull = line.slice(0, colonIdx);
            const val = line.slice(colonIdx + 1).trim();
            const prop = propFull.split(';')[0].toUpperCase();
            if (['SUMMARY','DTSTART','LOCATION','DESCRIPTION','UID'].includes(prop)) {
                cur[prop] = val;
            }
        });
        return events;
    }

})();

// =============================================
//   NOTES PANEL ENGINE
// =============================================
(function NotesPanel() {
    const notesBtn    = document.getElementById('notes-btn');
    const panel       = document.getElementById('notes-panel');
    const closeBtn    = document.getElementById('close-notes');
    const backdrop    = document.getElementById('side-panel-backdrop');
    const listView    = document.getElementById('notes-list-view');
    const editorView  = document.getElementById('notes-editor-view');
    const notesList   = document.getElementById('notes-list');
    const notesEmpty  = document.getElementById('notes-empty');
    const notesSearch = document.getElementById('notes-search');
    const searchClear = document.getElementById('notes-search-clear');
    const newBtn      = document.getElementById('notes-new-btn');
    const backBtn     = document.getElementById('notes-back-btn');
    const deleteBtn   = document.getElementById('notes-delete-btn');
    const titleInput  = document.getElementById('notes-title-input');
    const notesBody   = document.getElementById('notes-body');
    const fmtBtns     = document.querySelectorAll('.notes-fmt-btn');
    const colorDots   = document.querySelectorAll('.note-dot');
    const saveStatus  = document.getElementById('notes-save-status');
    const wordCount   = document.getElementById('notes-word-count');
    const lastEdited  = document.getElementById('notes-last-edited');

    let panelOpen    = false;
    let notes        = [];
    let activeNoteId = null;
    let saveTimer    = null;
    let activeColor  = '#7c8cf8';
    let searchQuery  = '';

    function genId() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }

    function loadNotes(cb) {
        chrome.storage.local.get(['myNotes'], r => { notes = r.myNotes || []; if (cb) cb(); });
    }

    function saveAllNotes(cb) {
        chrome.storage.local.set({ myNotes: notes }, cb);
    }

    function relativeDate(ts) {
        if (!ts) return '';
        const m = Math.floor((Date.now() - ts) / 60000);
        if (m < 1) return 'just now';
        if (m < 60) return `${m}m ago`;
        const h = Math.floor(m / 60);
        if (h < 24) return `${h}h ago`;
        const d = Math.floor(h / 24);
        if (d < 7) return `${d}d ago`;
        return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }

    function stripHtml(html) {
        return new DOMParser().parseFromString(html, 'text/html').body.textContent || '';
    }

    function wordCountOf(html) {
        const t = stripHtml(html).trim(); return t ? t.split(/\s+/).length : 0;
    }

    // ---- Open / Close ----
    function openPanel() {
        // Close calendar panel if open
        document.getElementById('calendar-panel').classList.remove('open');
        document.getElementById('calendar-btn').classList.remove('active');
        const hp = document.getElementById('history-panel');
        if (hp) hp.classList.remove('open');
        const hb = document.getElementById('history-btn');
        if (hb) hb.classList.remove('active');

        panelOpen = true;
        panel.classList.add('open');
        backdrop.classList.add('active');
        notesBtn.classList.add('active');
        loadNotes(renderList);
        showListView();
    }

    function closePanel() {
        panelOpen = false;
        panel.classList.remove('open');
        backdrop.classList.remove('active');
        notesBtn.classList.remove('active');
        flushSave();
    }

    notesBtn.addEventListener('click', () => panelOpen ? closePanel() : openPanel());
    closeBtn.addEventListener('click', closePanel);
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && panelOpen) closePanel(); });

    // ---- Views ----
    function showListView() {
        listView.classList.remove('hidden');
        editorView.classList.add('hidden');
        activeNoteId = null;
        renderList();
    }

    function showEditorView(id) {
        const note = notes.find(n => n.id === id);
        if (!note) return;
        activeNoteId = id;
        titleInput.value = note.title || '';
        const _parsedNote = new DOMParser().parseFromString(note.body || '', 'text/html');
        notesBody.replaceChildren(...Array.from(_parsedNote.body.childNodes));
        activeColor = note.color || '#7c8cf8';
        colorDots.forEach(d => d.classList.toggle('active', d.dataset.color === activeColor));
        wordCount.textContent = `${wordCountOf(note.body || '')} words`;
        lastEdited.textContent = note.updatedAt ? `Edited ${relativeDate(note.updatedAt)}` : '';
        listView.classList.add('hidden');
        editorView.classList.remove('hidden');
        titleInput.focus();
    }

    // ---- List ----
    function renderList() {
        notesList.innerHTML = '';
        let filtered = notes;
        if (searchQuery) {
            const q = searchQuery.toLowerCase();
            filtered = notes.filter(n => (n.title||'').toLowerCase().includes(q) || stripHtml(n.body||'').toLowerCase().includes(q));
        }
        filtered.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
        notesEmpty.classList.toggle('hidden', filtered.length > 0);

        filtered.forEach(n => {
            const card = document.createElement('div'); card.className = 'note-card';
            const accent = document.createElement('div'); accent.className = 'note-card-accent'; accent.style.background = n.color || '#7c8cf8';
            const content = document.createElement('div'); content.className = 'note-card-content';
            const title = document.createElement('div'); title.className = 'note-card-title'; title.textContent = n.title || 'Untitled';
            const preview = document.createElement('div'); preview.className = 'note-card-preview'; preview.textContent = stripHtml(n.body || '').slice(0, 70) || 'No content';
            const date = document.createElement('div'); date.className = 'note-card-date'; date.textContent = relativeDate(n.updatedAt);
            content.append(title, preview, date);
            const arrow = document.createElement('div'); arrow.className = 'note-card-arrow';
            arrow.innerHTML = `<svg viewBox="0 0 24 24" width="13" height="13" stroke="currentColor" stroke-width="2.5" fill="none"><polyline points="9 18 15 12 9 6"></polyline></svg>`;
            card.append(accent, content, arrow);
            card.addEventListener('click', () => showEditorView(n.id));
            notesList.appendChild(card);
        });
    }

    // ---- New Note ----
    newBtn.addEventListener('click', () => {
        flushSave();
        const n = { id: genId(), title: '', body: '', color: '#7c8cf8', createdAt: Date.now(), updatedAt: Date.now() };
        notes.unshift(n);
        saveAllNotes(() => showEditorView(n.id));
    });

    backBtn.addEventListener('click', () => { flushSave(); showListView(); });

    deleteBtn.addEventListener('click', () => {
        if (!activeNoteId || !confirm('Delete this note?')) return;
        notes = notes.filter(n => n.id !== activeNoteId);
        saveAllNotes(() => showListView());
    });

    // ---- Auto-save ----
    function scheduleSave() { saveStatus.textContent = 'Saving…'; clearTimeout(saveTimer); saveTimer = setTimeout(flushSave, 800); }

    function flushSave() {
        clearTimeout(saveTimer);
        if (!activeNoteId) return;
        const idx = notes.findIndex(n => n.id === activeNoteId);
        if (idx === -1) return;
        notes[idx].title = titleInput.value.trim() || 'Untitled';
        notes[idx].body = notesBody.innerHTML;
        notes[idx].color = activeColor;
        notes[idx].updatedAt = Date.now();
        saveAllNotes(() => {
            saveStatus.textContent = 'Saved';
            lastEdited.textContent = `Edited ${relativeDate(notes[idx].updatedAt)}`;
        });
    }

    titleInput.addEventListener('input', scheduleSave);
    notesBody.addEventListener('input', () => { scheduleSave(); wordCount.textContent = `${wordCountOf(notesBody.innerHTML)} words`; });

    // ---- Formatting ----
    fmtBtns.forEach(btn => btn.addEventListener('mousedown', e => {
        e.preventDefault();
        const cmd = btn.dataset.cmd;
        const val = btn.dataset.val || null;

        if (cmd === 'insertCheckbox') {
            // Insert a custom checkbox item div
            const id = 'chk-' + Date.now();
            const html = `<div class="note-checkbox-item" data-id="${id}"><input type="checkbox" data-id="${id}"><span>&#8203;</span></div><br>`;
            document.execCommand('insertHTML', false, html);
        } else if (cmd === 'formatBlock') {
            // Toggle: if already this block, revert to paragraph
            const current = document.queryCommandValue('formatBlock').toUpperCase();
            document.execCommand('formatBlock', false, current === val ? 'P' : val);
        } else {
            document.execCommand(cmd, false, val);
        }
        notesBody.focus();
        scheduleSave();
    }));

    // Delegate checkbox toggle clicks inside notes body
    notesBody.addEventListener('click', function(e) {
        if (e.target.tagName === 'INPUT' && e.target.type === 'checkbox') {
            const parent = e.target.closest('.note-checkbox-item');
            if (parent) {
                parent.classList.toggle('checked', e.target.checked);
                scheduleSave();
            }
        }
    });

    notesBody.addEventListener('keyup', syncFmtBtns);
    notesBody.addEventListener('mouseup', syncFmtBtns);
    function syncFmtBtns() {
        fmtBtns.forEach(btn => {
            const cmd = btn.dataset.cmd;
            const val = btn.dataset.val;
            try {
                if (cmd === 'formatBlock' && val) {
                    const current = document.queryCommandValue('formatBlock').toUpperCase();
                    btn.classList.toggle('active', current === val);
                } else if (cmd !== 'insertCheckbox' && cmd !== 'insertHTML') {
                    btn.classList.toggle('active', document.queryCommandState(cmd));
                }
            } catch(e) {}
        });
    }

    // ---- Note color ----
    colorDots.forEach(dot => dot.addEventListener('click', () => {
        colorDots.forEach(d => d.classList.remove('active'));
        dot.classList.add('active');
        activeColor = dot.dataset.color;
        scheduleSave();
    }));

    // ---- Search ----
    notesSearch.addEventListener('input', function() {
        searchQuery = this.value.trim();
        searchClear.classList.toggle('hidden', !searchQuery);
        renderList();
    });
    searchClear.addEventListener('click', () => {
        notesSearch.value = ''; searchQuery = '';
        searchClear.classList.add('hidden');
        renderList();
    });

})();

// =============================================
//   QUOTES ENGINE (Feature 22)
//   API: https://thequoteshub.com/api/random-quote
//   Response shape: { text: "...", author: "..." }
// =============================================

// Interval values matching the wallpaper rotation select (values are hours, or special strings)
const QUOTE_INTERVALS = {
    'newtab': 0,                    // fetch every new tab
    '1':      1  * 3600 * 1000,
    '12':     12 * 3600 * 1000,
    '24':     24 * 3600 * 1000,
    'locked': -1,                   // never refresh — keep current
};

function initQuotes() {
    const container = document.getElementById('quote-container');
    const textEl    = document.getElementById('quote-text');
    const authorEl  = document.getElementById('quote-author');
    if (!container) return;

    chrome.storage.local.get(['quotesCache', 'quoteInterval'], function(r) {
        const cache    = r.quotesCache;
        const interval = r.quoteInterval || '1'; // default: every hour
        const ttl      = QUOTE_INTERVALS[interval] !== undefined ? QUOTE_INTERVALS[interval] : 3600 * 1000;

        // Sync the interval select UI
        const intSel = document.getElementById('quote-interval-select');
        if (intSel) intSel.value = interval;

        // locked = never fetch a new one — just show cache if available
        if (ttl === -1) {
            if (cache && cache.text) showQuote(cache.text, cache.author);
            return;
        }

        // newtab (ttl=0) = always fetch; otherwise use cache if still fresh
        if (ttl > 0 && cache && cache.text && (Date.now() - cache.ts < ttl)) {
            showQuote(cache.text, cache.author);
            return;
        }
        fetchQuote();
    });

    function fetchQuote() {
        fetch('https://thequoteshub.com/api/random-quote')
            .then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
            .then(d => {
                // API returns { text: "...", author: "..." }
                const text   = d.text   || d.quote  || d.content || '';
                const author = d.author || d.name   || '';
                if (!text) throw new Error('empty response');
                chrome.storage.local.set({ quotesCache: { text, author, ts: Date.now() } });
                showQuote(text, author);
            })
            .catch(err => {
                console.warn('Quote fetch failed:', err);
                // Show stale cache rather than nothing
                chrome.storage.local.get(['quotesCache'], function(r) {
                    if (r.quotesCache && r.quotesCache.text) showQuote(r.quotesCache.text, r.quotesCache.author);
                });
            });
    }

    function showQuote(text, author) {
        if (!text) return;
        container.classList.remove('hidden');
        textEl.textContent  = `"${text}"`;
        authorEl.textContent = author ? `— ${author}` : '';
    }
}

// Quote interval select
document.getElementById('quote-interval-select') && document.getElementById('quote-interval-select').addEventListener('change', function() {
    const interval = this.value;
    if (interval === 'locked') {
        // Just save the lock — don't clear the cache, keep current quote
        chrome.storage.local.set({ quoteInterval: interval });
    } else {
        // Clear cache so a fresh quote is fetched with the new interval
        chrome.storage.local.set({ quoteInterval: interval, quotesCache: null }, function() {
            initQuotes();
        });
    }
});

// Quote refresh button
document.getElementById('quote-refresh-btn') && document.getElementById('quote-refresh-btn').addEventListener('click', function() {
    chrome.storage.local.set({ quotesCache: null }, function() {
        initQuotes();
    });
});

document.getElementById('quotes-toggle') && document.getElementById('quotes-toggle').addEventListener('change', function() {
    const enabled = this.checked;
    chrome.storage.local.set({ quotesEnabled: enabled });
    const container = document.getElementById('quote-container');
    const wrap = document.getElementById('quote-interval-wrap');
    if (wrap) wrap.classList.toggle('hidden', !enabled);
    if (enabled) {
        initQuotes();
    } else {
        if (container) container.classList.add('hidden');
    }
});

// =============================================
//   GREETING TOGGLE (Feature 23)
// =============================================

document.getElementById('greeting-toggle') && document.getElementById('greeting-toggle').addEventListener('change', function() {
    const enabled = this.checked;
    chrome.storage.local.set({ greetingEnabled: enabled });
    const greetingEl = document.getElementById('greeting');
    if (greetingEl) greetingEl.classList.toggle('hidden', !enabled);
});

// =============================================
//   TAB TITLE (Feature 24)
// =============================================

(function initTabTitle() {
    const input = document.getElementById('tab-title-input');
    const resetBtn = document.getElementById('reset-tab-title-btn');
    if (!input) return;

    let saveTimer;
    input.addEventListener('input', function() {
        clearTimeout(saveTimer);
        saveTimer = setTimeout(() => {
            const val = this.value.trim();
            chrome.storage.local.set({ tabTitle: val });
            document.title = val || 'New Tab';
        }, 500);
    });

    resetBtn && resetBtn.addEventListener('click', function() {
        input.value = '';
        chrome.storage.local.set({ tabTitle: '' });
        document.title = 'New Tab';
    });
})();

// =============================================
//   SEARCH PLACEHOLDER (Feature 25)
// =============================================

(function initSearchPlaceholder() {
    const input = document.getElementById('search-placeholder-input');
    const resetBtn = document.getElementById('reset-search-placeholder-btn');
    if (!input) return;

    const DEFAULT_PLACEHOLDER = 'Search the web...';

    let saveTimer;
    input.addEventListener('input', function() {
        clearTimeout(saveTimer);
        saveTimer = setTimeout(() => {
            const val = this.value; // allow empty string
            chrome.storage.local.set({ searchPlaceholder: val });
            const si = document.querySelector('#search-form input[name="q"]');
            if (si) si.placeholder = val;
        }, 500);
    });

    resetBtn && resetBtn.addEventListener('click', function() {
        input.value = '';
        chrome.storage.local.set({ searchPlaceholder: null });
        const si = document.querySelector('#search-form input[name="q"]');
        if (si) si.placeholder = DEFAULT_PLACEHOLDER;
        // Clear storage key entirely on reset
        chrome.storage.local.remove('searchPlaceholder');
    });
})();

// =============================================
//   SHORTCUT GROUPS ENGINE (Feature 20)
// =============================================

let _groups = [];
let _activeGroup = null;
let _groupsEnabled = false;

// Safe helper: always returns a plain array from whatever storage gives back
function _safeGroups(val) {
    if (Array.isArray(val)) return val;
    // Chrome can sometimes serialise an array as a plain object {0:{...},1:{...}}
    if (val && typeof val === 'object') {
        const converted = Object.values(val).filter(g => g && typeof g === 'object' && g.id && g.name);
        if (converted.length) return converted;
    }
    return [];
}

function initGroupsUI(enabled, groups, shortcuts, activeGroup) {
    _groupsEnabled = enabled;
    _groups = _safeGroups(groups);
    _activeGroup = activeGroup || null;

    const toggle = document.getElementById('groups-enabled-toggle');
    const wrap   = document.getElementById('groups-manage-wrap');
    const bar    = document.getElementById('shortcut-groups-bar');
    if (toggle) toggle.checked = enabled;
    if (wrap)   wrap.classList.toggle('hidden', !enabled);
    if (bar)    bar.classList.toggle('hidden', !enabled);

    if (enabled) {
        renderGroupsTabs(_groups, shortcuts);
        renderGroupsManageList(_groups);
        updateGroupSelect(_groups);
    }
}

function renderGroupsTabs(groups, shortcuts) {
    groups = _safeGroups(groups);
    const tabsEl = document.getElementById('shortcut-groups-tabs');
    if (!tabsEl) return;
    tabsEl.innerHTML = '';

    const allBtn = document.createElement('button');
    allBtn.className = 'group-tab-btn' + (!_activeGroup ? ' active' : '');
    allBtn.textContent = 'All';
    allBtn.addEventListener('click', () => selectGroup(null, groups, shortcuts));
    tabsEl.appendChild(allBtn);

    groups.forEach(g => {
        const btn = document.createElement('button');
        btn.className = 'group-tab-btn' + (_activeGroup === g.id ? ' active' : '');
        btn.textContent = g.name;
        btn.setAttribute('data-group-id', g.id);
        btn.addEventListener('click', () => selectGroup(g.id, groups, shortcuts));
        btn.addEventListener('contextmenu', function(e) {
            e.preventDefault();
            e.stopPropagation();
            showGroupContextMenu(e, g, groups, shortcuts);
        });
        tabsEl.appendChild(btn);
    });
}

// =============================================
//   GROUP TAB CONTEXT MENU
// =============================================

// Inject rename-row styles once (reuses existing .ctx-menu/.ctx-item/.ctx-icon/.ctx-label/.ctx-divider)
(function injectGroupCtxStyles() {
    if (document.getElementById('group-ctx-style')) return;
    const s = document.createElement('style');
    s.id = 'group-ctx-style';
    s.textContent = `
        #group-rename-row {
            display: flex;
            align-items: center;
            gap: 6px;
            padding: 4px 6px 6px;
        }
        #group-rename-row input {
            flex: 1;
            min-width: 0;
            background: rgba(255,255,255,0.08);
            border: 1px solid rgba(255,255,255,0.18);
            border-radius: 7px;
            padding: 6px 9px;
            color: rgba(255,255,255,0.9);
            font-size: 0.84rem;
            outline: none;
        }
        #group-rename-row input:focus { border-color: rgba(255,255,255,0.38); background: rgba(255,255,255,0.11); }
        #group-rename-row button {
            background: rgba(255,255,255,0.13);
            border: 1px solid rgba(255,255,255,0.16);
            border-radius: 7px;
            padding: 6px 10px;
            color: rgba(255,255,255,0.85);
            font-size: 0.78rem;
            font-weight: 600;
            cursor: pointer;
            white-space: nowrap;
            flex-shrink: 0;
        }
        #group-rename-row button:hover { background: rgba(255,255,255,0.22); }
    `;
    document.head.appendChild(s);
})();

let _groupCtxDismissHandler = null;

function showGroupContextMenu(e, group, groups, shortcuts) {
    removeGroupContextMenu();

    // ── Build menu using the same .ctx-menu class as all other menus ──
    const menu = document.createElement('div');
    menu.id = 'group-ctx-menu';
    menu.className = 'ctx-menu';

    // ── Header ──
    const header = document.createElement('div');
    header.className = 'ctx-menu-header';
    const _hSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    _hSvg.setAttribute('width', '11'); _hSvg.setAttribute('height', '11');
    _hSvg.setAttribute('viewBox', '0 0 24 24'); _hSvg.setAttribute('fill', 'none');
    _hSvg.setAttribute('stroke', 'currentColor'); _hSvg.setAttribute('stroke-width', '2.5');
    [['3','3'],['14','3'],['3','14'],['14','14']].forEach(function(xy) {
        const r = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        r.setAttribute('x', xy[0]); r.setAttribute('y', xy[1]);
        r.setAttribute('width', '7'); r.setAttribute('height', '7'); r.setAttribute('rx', '1');
        _hSvg.appendChild(r);
    });
    header.appendChild(_hSvg);
    header.appendChild(document.createTextNode(group.name));
    menu.appendChild(header);

    // ── Rename inline row (hidden until Rename is clicked) ──
    const renameRow = document.createElement('div');
    renameRow.id = 'group-rename-row';
    renameRow.style.display = 'none';
    const renameInput = document.createElement('input');
    renameInput.type = 'text';
    renameInput.value = group.name;
    renameInput.placeholder = 'Group name…';
    const renameSaveBtn = document.createElement('button');
    renameSaveBtn.textContent = 'Save';
    renameRow.appendChild(renameInput);
    renameRow.appendChild(renameSaveBtn);
    menu.appendChild(renameRow);

    function commitRename() {
        const newName = renameInput.value.trim();
        if (!newName) { renameInput.focus(); return; }
        chrome.storage.local.get(['shortcutGroups', 'myShortcuts'], function(r) {
            const grps = _safeGroups(r.shortcutGroups);
            const target = grps.find(x => x.id === group.id);
            if (target) target.name = newName;
            _groups = grps;
            chrome.storage.local.set({ shortcutGroups: grps }, () => {
                renderGroupsManageList(grps);
                renderGroupsTabs(grps, r.myShortcuts || []);
                removeGroupContextMenu();
                showGroupToast(`Renamed to "${newName}"`);
            });
        });
    }
    renameSaveBtn.addEventListener('click', function(ev) { ev.stopPropagation(); commitRename(); });
    renameInput.addEventListener('keydown', function(ev) {
        ev.stopPropagation();
        if (ev.key === 'Enter') { ev.preventDefault(); commitRename(); }
        if (ev.key === 'Escape') removeGroupContextMenu();
    });

    // ── Helper: build a .ctx-item button ──
    function makeCtxItem(svgPath, label, hint, extraClass, onClick) {
        const btn = document.createElement('button');
        btn.className = 'ctx-item' + (extraClass ? ' ' + extraClass : '');
        const iconSpan = document.createElement('span');
        iconSpan.className = 'ctx-icon';
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('width', '14'); svg.setAttribute('height', '14');
        svg.setAttribute('viewBox', '0 0 24 24'); svg.setAttribute('fill', 'none');
        svg.setAttribute('stroke', 'currentColor'); svg.setAttribute('stroke-width', '2');
        svg.setAttribute('stroke-linecap', 'round'); svg.setAttribute('stroke-linejoin', 'round');
        const _parsed = new DOMParser().parseFromString('<svg xmlns="http://www.w3.org/2000/svg">' + svgPath + '</svg>', 'image/svg+xml');
        Array.from(_parsed.documentElement.childNodes).forEach(function(n) { svg.appendChild(document.importNode(n, true)); });
        iconSpan.appendChild(svg);
        btn.appendChild(iconSpan);
        const labelSpan = document.createElement('span');
        labelSpan.className = 'ctx-label';
        labelSpan.textContent = label;
        btn.appendChild(labelSpan);
        if (hint) {
            const hintSpan = document.createElement('span');
            hintSpan.className = 'ctx-hint';
            hintSpan.textContent = hint;
            btn.appendChild(hintSpan);
        }
        btn.addEventListener('click', function(ev) { ev.stopPropagation(); onClick(); });
        return btn;
    }

    // Rename item
    const renameBtn = makeCtxItem(
        '<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>',
        'Rename', 'Edit group name', '', function() {
            renameBtn.style.display = 'none';
            divider.style.display = 'none';
            deleteBtn.style.display = 'none';
            renameRow.style.display = 'flex';
            setTimeout(() => { renameInput.select(); renameInput.focus(); }, 0);
        }
    );
    menu.appendChild(renameBtn);

    const divider = document.createElement('div');
    divider.className = 'ctx-divider';
    menu.appendChild(divider);

    // Delete item
    const deleteBtn = makeCtxItem(
        '<polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/>',
        'Delete group', 'Shortcuts move to All', 'ctx-item-danger', function() {
            removeGroupContextMenu();
            if (!confirm(`Delete group "${group.name}"?\nShortcuts in this group will move to "All".`)) return;
            chrome.storage.local.get(['myShortcuts', 'shortcutGroups'], function(r) {
                let grps = _safeGroups(r.shortcutGroups).filter(x => x.id !== group.id);
                let scs = (r.myShortcuts || []).map(s => {
                    if (s.groupId === group.id) { const c = {...s}; delete c.groupId; return c; }
                    return s;
                });
                _groups = grps;
                if (_activeGroup === group.id) _activeGroup = null;
                chrome.storage.local.set({ shortcutGroups: grps, myShortcuts: scs, activeGroup: _activeGroup }, () => {
                    renderGroupsManageList(grps);
                    renderGroupsTabs(grps, scs);
                    updateGroupSelect(grps);
                    renderShortcuts(_activeGroup ? scs.filter(s => s.groupId === _activeGroup) : scs);
                    renderManageList(scs);
                    showGroupToast(`Group "${group.name}" deleted`);
                });
            });
        }
    );
    menu.appendChild(deleteBtn);

    // ── Position using the same showMenu logic ──
    menu.style.left = '0px';
    menu.style.top  = '0px';
    document.body.appendChild(menu);
    menu.classList.add('ctx-visible');

    const rect = menu.getBoundingClientRect();
    menu.style.left = Math.min(e.clientX, window.innerWidth  - rect.width  - 8) + 'px';
    menu.style.top  = Math.min(e.clientY, window.innerHeight - rect.height - 8) + 'px';

    // ── Dismiss on outside click / Escape / scroll ──
    _groupCtxDismissHandler = function(ev) {
        if (ev.type === 'keydown' && ev.key !== 'Escape') return;
        if (ev.type === 'mousedown' && menu.contains(ev.target)) return;
        removeGroupContextMenu();
    };
    setTimeout(() => {
        document.addEventListener('mousedown', _groupCtxDismissHandler, { capture: true });
        document.addEventListener('keydown',   _groupCtxDismissHandler);
        window.addEventListener('scroll', removeGroupContextMenu, { once: true });
    }, 0);
}

function removeGroupContextMenu() {
    const m = document.getElementById('group-ctx-menu');
    if (m) m.remove();
    if (_groupCtxDismissHandler) {
        document.removeEventListener('mousedown', _groupCtxDismissHandler, { capture: true });
        document.removeEventListener('keydown',   _groupCtxDismissHandler);
        _groupCtxDismissHandler = null;
    }
}

function showGroupToast(msg) {
    const existing = document.getElementById('ctx-toast');
    if (existing) existing.remove();
    const toast = document.createElement('div');
    toast.id = 'ctx-toast';
    toast.textContent = msg;
    toast.style.cssText = [
        'position:fixed','bottom:32px','left:50%',
        'transform:translateX(-50%) translateY(10px)',
        'background:rgba(20,20,30,0.88)','color:rgba(255,255,255,0.95)',
        'padding:9px 20px','border-radius:50px','font-size:0.84rem',
        'font-weight:500','z-index:999999',
        'backdrop-filter:blur(var(--blur-amount,25px))',
        '-webkit-backdrop-filter:blur(var(--blur-amount,25px))',
        'border:1px solid rgba(255,255,255,0.12)',
        'box-shadow:0 4px 16px rgba(0,0,0,0.3)',
        'transition:all 0.25s cubic-bezier(0.16,1,0.3,1)','opacity:0',
    ].join(';');
    document.body.appendChild(toast);
    requestAnimationFrame(() => requestAnimationFrame(() => {
        toast.style.opacity = '1';
        toast.style.transform = 'translateX(-50%) translateY(0)';
    }));
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(-50%) translateY(10px)';
        setTimeout(() => toast.remove(), 300);
    }, 2200);
}

function selectGroup(groupId, groups, shortcuts) {
    _activeGroup = groupId;
    chrome.storage.local.set({ activeGroup: groupId });

    document.querySelectorAll('.group-tab-btn').forEach(btn => {
        const bid = btn.getAttribute('data-group-id');
        btn.classList.toggle('active', bid === groupId || (!groupId && !bid));
    });

    chrome.storage.local.get(['myShortcuts'], function(r) {
        const all = r.myShortcuts || shortcuts;
        renderShortcuts(groupId ? all.filter(s => s.groupId === groupId) : all);
    });
}

function renderGroupsManageList(groups) {
    groups = _safeGroups(groups);
    const list = document.getElementById('groups-manage-list');
    if (!list) return;
    list.innerHTML = '';

    groups.forEach((g, idx) => {
        const item = document.createElement('div');
        item.className = 'group-manage-item';
        item.setAttribute('draggable', 'true');
        item.setAttribute('data-idx', idx);

        const nameSpan = document.createElement('span');
        nameSpan.className = 'group-manage-item-name';
        nameSpan.textContent = g.name;

        const editInput = document.createElement('input');
        editInput.type = 'text';
        editInput.value = g.name;
        editInput.style.cssText = 'display:none;flex:1;font-size:0.85rem;padding:3px 6px;border-radius:5px;background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.15);color:inherit;outline:none;';

        const editBtn = document.createElement('button');
        editBtn.className = 'delete-btn';
        editBtn.textContent = 'Rename';
        editBtn.style.color = 'rgba(255,255,255,0.6)';

        const saveBtn = document.createElement('button');
        saveBtn.className = 'delete-btn';
        saveBtn.textContent = 'Save';
        saveBtn.style.cssText = 'display:none;color:rgba(255,255,255,0.7);';

        const delBtn = document.createElement('button');
        delBtn.className = 'delete-btn';
        delBtn.textContent = 'Delete';

        function saveGroupName() {
            const newName = editInput.value.trim();
            if (!newName) return;
            chrome.storage.local.get(['shortcutGroups', 'myShortcuts'], function(r) {
                const grps = _safeGroups(r.shortcutGroups);
                const target = grps.find(x => x.id === g.id);
                if (target) target.name = newName;
                _groups = grps;
                chrome.storage.local.set({ shortcutGroups: grps }, () => {
                    renderGroupsManageList(grps);
                    renderGroupsTabs(grps, r.myShortcuts || []);
                });
            });
        }
        function cancelEdit() {
            editInput.style.display = 'none';
            nameSpan.style.display = '';
            editBtn.style.display = '';
            saveBtn.style.display = 'none';
        }

        editInput.addEventListener('keydown', function(e) {
            if (e.key === 'Enter') saveGroupName();
            if (e.key === 'Escape') cancelEdit();
        });

        editBtn.addEventListener('click', function() {
            editInput.value = g.name;
            editInput.style.display = 'inline-block';
            nameSpan.style.display = 'none';
            this.style.display = 'none';
            saveBtn.style.display = '';
            editInput.focus();
        });

        saveBtn.addEventListener('click', saveGroupName);

        delBtn.addEventListener('click', function() {
            if (!confirm(`Delete group "${g.name}"? Shortcuts in this group will move to "All".`)) return;
            chrome.storage.local.get(['myShortcuts', 'shortcutGroups'], function(r) {
                const grps = _safeGroups(r.shortcutGroups).filter(x => x.id !== g.id);
                const all  = (r.myShortcuts || []).map(s => {
                    if (s.groupId === g.id) { const c = {...s}; delete c.groupId; return c; }
                    return s;
                });
                _groups = grps;
                if (_activeGroup === g.id) _activeGroup = null;
                chrome.storage.local.set({ shortcutGroups: grps, myShortcuts: all, activeGroup: _activeGroup }, () => {
                    const display = (_groupsEnabled && _activeGroup) ? all.filter(s => s.groupId === _activeGroup) : all;
                    renderShortcuts(display);
                    renderManageList(all);
                    renderGroupsManageList(grps);
                    renderGroupsTabs(grps, all);
                    updateGroupSelect(grps);
                });
            });
        });

        const btnWrap = document.createElement('div');
        btnWrap.style.cssText = 'display:flex;gap:6px;flex-shrink:0;align-items:center;';
        btnWrap.append(saveBtn, editBtn, delBtn);
        item.append(nameSpan, editInput, btnWrap);
        list.appendChild(item);
    });
}

function updateGroupSelect(groups) {
    groups = _safeGroups(groups);
    const sel = document.getElementById('site-group-select');
    if (!sel) return;
    sel.innerHTML = '<option value="">No Group</option>';
    groups.forEach(g => {
        const opt = document.createElement('option');
        opt.value = g.id;
        opt.textContent = g.name;
        sel.appendChild(opt);
    });
    sel.style.display = _groupsEnabled && groups.length ? '' : 'none';
}

// Groups toggle
document.getElementById('groups-enabled-toggle') && document.getElementById('groups-enabled-toggle').addEventListener('change', function() {
    _groupsEnabled = this.checked;
    chrome.storage.local.set({ groupsEnabled: _groupsEnabled });
    const wrap = document.getElementById('groups-manage-wrap');
    const bar  = document.getElementById('shortcut-groups-bar');
    if (wrap) wrap.classList.toggle('hidden', !_groupsEnabled);
    if (bar)  bar.classList.toggle('hidden', !_groupsEnabled);
    if (_groupsEnabled) {
        chrome.storage.local.get(['myShortcuts', 'shortcutGroups', 'activeGroup'], function(r) {
            _groups = _safeGroups(r.shortcutGroups);
            renderGroupsTabs(_groups, r.myShortcuts || []);
            renderGroupsManageList(_groups);
            updateGroupSelect(_groups);
        });
    } else {
        chrome.storage.local.get(['myShortcuts'], function(r) {
            renderShortcuts(r.myShortcuts || defaultShortcuts);
        });
        updateGroupSelect([]);
    }
});

// Add group (settings panel button)
document.getElementById('add-group-btn') && document.getElementById('add-group-btn').addEventListener('click', function() {
    const input = document.getElementById('new-group-name-input');
    const name  = input ? input.value.trim() : '';
    if (!name) return;
    const newGroup = { id: 'grp_' + Date.now(), name };
    chrome.storage.local.get(['shortcutGroups', 'myShortcuts'], function(r) {
        const grps = _safeGroups(r.shortcutGroups);
        grps.push(newGroup);
        _groups = grps;
        chrome.storage.local.set({ shortcutGroups: grps }, function() {
            if (input) input.value = '';
            renderGroupsManageList(grps);
            renderGroupsTabs(grps, r.myShortcuts || []);
            updateGroupSelect(grps);
        });
    });
});

// Add group (inline + button on groups bar)
document.getElementById('add-group-inline-btn') && document.getElementById('add-group-inline-btn').addEventListener('click', function() {
    const name = prompt('New group name:');
    if (!name || !name.trim()) return;
    const newGroup = { id: 'grp_' + Date.now(), name: name.trim() };
    chrome.storage.local.get(['shortcutGroups', 'myShortcuts'], function(r) {
        const grps = _safeGroups(r.shortcutGroups);
        grps.push(newGroup);
        _groups = grps;
        chrome.storage.local.set({ shortcutGroups: grps }, function() {
            renderGroupsManageList(grps);
            renderGroupsTabs(grps, r.myShortcuts || []);
            updateGroupSelect(grps);
        });
    });
});

// Update add-shortcut-btn to include group
const _origAddShortcutListener = document.getElementById('add-shortcut-btn');
// The original listener is already defined; we patch via storage override
// We hook into the existing add flow by overriding the click handler's group logic
document.addEventListener('DOMContentLoaded', function() {
    const addBtn = document.getElementById('add-shortcut-btn');
    if (!addBtn) return;
    // Override the existing listener with a capturing one that sets groupId
    addBtn.addEventListener('click', function(e) {
        // Group will be picked up when myShortcuts is read after the existing handler fires
        // We piggyback by storing the pending group
        const sel = document.getElementById('site-group-select');
        if (sel && sel.value) {
            window._pendingGroupId = sel.value;
        } else {
            window._pendingGroupId = null;
        }
    }, true); // capturing phase runs before the existing bubble-phase handler
});

// Patch rearrangeShortcutsInStorage / renderShortcuts to support drag-to-group:
// We handle this via the shortcut's groupId property.

// =============================================
//   SHORTCUT COLUMNS (Layout Setting)
// =============================================

function applyShortcutCols(cols) {
    cols = Math.min(12, Math.max(4, parseInt(cols) || 6));
    // Set CSS variable for shortcuts grid
    document.documentElement.style.setProperty('--shortcut-cols', cols);
    // Scale container max-width proportionally: base 640px at 6 cols = ~106.67px per col
    const maxWidth = Math.round(cols * 106.67);
    document.documentElement.style.setProperty('--container-max-width', maxWidth + 'px');
    // Re-sync mostVisited grid if visible
    const mvGrid = document.getElementById('most-visited-grid');
    if (mvGrid && mvGrid.children.length) {
        mvGrid.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
    }
}

document.getElementById('shortcut-cols-input') && document.getElementById('shortcut-cols-input').addEventListener('change', function() {
    const cols = Math.min(12, Math.max(4, parseInt(this.value) || 6));
    this.value = cols; // clamp displayed value
    chrome.storage.local.set({ shortcutCols: cols });
    applyShortcutCols(cols);
    // Re-render mostVisited with new cols so row count stays correct
    chrome.storage.local.get(['mostVisitedEnabled', 'mostVisitedCount'], function(r) {
        if (r.mostVisitedEnabled) renderMostVisited(r.mostVisitedCount || 2);
    });
});

// =============================================
//   MOST VISITED SITES (Feature 21)
// =============================================

function renderMostVisited(rows) {
    const section = document.getElementById('most-visited-section');
    const grid = document.getElementById('most-visited-grid');
    if (!section || !grid) return;

    if (!chrome || !chrome.topSites) {
        section.classList.add('hidden');
        return;
    }

    const cols = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--shortcut-cols').trim()) || 6;
    const target = (rows || 2) * cols;

    chrome.topSites.get(function(sites) {
        if (!sites || sites.length === 0) { section.classList.add('hidden'); return; }
        section.classList.remove('hidden');
        grid.innerHTML = '';
        grid.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;

        // Chrome topSites caps at 10. Show all available up to target — never hide for being short.
        const shown = sites.slice(0, target);

        shown.forEach(site => {
            const anchor = document.createElement('a');
            anchor.href = site.url;
            anchor.className = 'shortcut-item';

            const iconWrapper = document.createElement('div');
            iconWrapper.className = 'icon-wrapper';

            const img = document.createElement('img');
            img.src = `https://www.google.com/s2/favicons?domain=${site.url}&sz=64`;
            img.alt = site.title;
            img.onerror = function() { this.src = 'https://www.google.com/s2/favicons?domain=example.com&sz=64'; };

            const span = document.createElement('span');
            try {
                span.textContent = site.title || new URL(site.url).hostname.replace('www.','');
            } catch(e) {
                span.textContent = site.title || site.url;
            }

            iconWrapper.appendChild(img);
            anchor.appendChild(iconWrapper);
            anchor.appendChild(span);
            grid.appendChild(anchor);
        });
    });
}

document.getElementById('most-visited-toggle') && document.getElementById('most-visited-toggle').addEventListener('change', function() {
    const enabled = this.checked;
    chrome.storage.local.set({ mostVisitedEnabled: enabled });
    const wrap = document.getElementById('most-visited-count-wrap');
    if (wrap) wrap.classList.toggle('hidden', !enabled);
    const section = document.getElementById('most-visited-section');
    if (!enabled) {
        if (section) section.classList.add('hidden');
    } else {
        chrome.storage.local.get(['mostVisitedCount'], function(r) {
            renderMostVisited(r.mostVisitedCount || 2);
        });
    }
});

document.getElementById('most-visited-count-select') && document.getElementById('most-visited-count-select').addEventListener('change', function() {
    const count = parseInt(this.value);
    chrome.storage.local.set({ mostVisitedCount: count });
    renderMostVisited(count);
});

// =============================================
//   TIMER & ALARM ENGINE (Feature 19)
// =============================================

(function TimerAlarmPanel() {
    const timerBtn  = document.getElementById('timer-btn');
    const panel     = document.getElementById('timer-panel');
    const closeBtn  = document.getElementById('close-timer');
    const backdrop  = document.getElementById('side-panel-backdrop');
    if (!timerBtn || !panel) return;

    let panelOpen = false;

    // ---- Panel open/close ----
    function openPanel() {
        // Close other panels
        ['calendar-panel','notes-panel','history-panel'].forEach(id => {
            const p = document.getElementById(id); if (p) p.classList.remove('open');
        });
        ['calendar-btn','notes-btn','history-btn'].forEach(id => {
            const b = document.getElementById(id); if (b) b.classList.remove('active');
        });
        panelOpen = true;
        panel.classList.add('open');
        backdrop.classList.add('active');
        timerBtn.classList.add('active');
    }

    function closePanel() {
        panelOpen = false;
        panel.classList.remove('open');
        backdrop.classList.remove('active');
        timerBtn.classList.remove('active');
    }

    timerBtn.addEventListener('click', () => panelOpen ? closePanel() : openPanel());
    closeBtn.addEventListener('click', closePanel);
    backdrop.addEventListener('click', closePanel);
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && panelOpen) closePanel(); });

    // ---- Tab switching ----
    const timerTabs = document.querySelectorAll('.timer-tab');
    const views = { timer: document.getElementById('timer-view'), stopwatch: document.getElementById('stopwatch-view'), alarm: document.getElementById('alarm-view'), worldclock: document.getElementById('worldclock-view') };
    timerTabs.forEach(tab => {
        tab.addEventListener('click', function() {
            timerTabs.forEach(t => t.classList.remove('active'));
            this.classList.add('active');
            const t = this.dataset.tab;
            Object.entries(views).forEach(([k, v]) => { if (v) v.classList.toggle('hidden', k !== t); });
        });
    });

    // ============================================================
    //   WORLD CLOCK
    // ============================================================
    (function initWorldClock() {
        // ---- Timezone database ----
        const TZ_DB = [
            { city: 'Local Time', tz: Intl.DateTimeFormat().resolvedOptions().timeZone, flag: '🏠' },
            { city: 'New York', tz: 'America/New_York', flag: '🇺🇸' },
            { city: 'Los Angeles', tz: 'America/Los_Angeles', flag: '🇺🇸' },
            { city: 'Chicago', tz: 'America/Chicago', flag: '🇺🇸' },
            { city: 'Denver', tz: 'America/Denver', flag: '🇺🇸' },
            { city: 'Toronto', tz: 'America/Toronto', flag: '🇨🇦' },
            { city: 'Vancouver', tz: 'America/Vancouver', flag: '🇨🇦' },
            { city: 'Mexico City', tz: 'America/Mexico_City', flag: '🇲🇽' },
            { city: 'São Paulo', tz: 'America/Sao_Paulo', flag: '🇧🇷' },
            { city: 'Buenos Aires', tz: 'America/Argentina/Buenos_Aires', flag: '🇦🇷' },
            { city: 'Santiago', tz: 'America/Santiago', flag: '🇨🇱' },
            { city: 'London', tz: 'Europe/London', flag: '🇬🇧' },
            { city: 'Paris', tz: 'Europe/Paris', flag: '🇫🇷' },
            { city: 'Berlin', tz: 'Europe/Berlin', flag: '🇩🇪' },
            { city: 'Amsterdam', tz: 'Europe/Amsterdam', flag: '🇳🇱' },
            { city: 'Madrid', tz: 'Europe/Madrid', flag: '🇪🇸' },
            { city: 'Rome', tz: 'Europe/Rome', flag: '🇮🇹' },
            { city: 'Stockholm', tz: 'Europe/Stockholm', flag: '🇸🇪' },
            { city: 'Oslo', tz: 'Europe/Oslo', flag: '🇳🇴' },
            { city: 'Copenhagen', tz: 'Europe/Copenhagen', flag: '🇩🇰' },
            { city: 'Helsinki', tz: 'Europe/Helsinki', flag: '🇫🇮' },
            { city: 'Warsaw', tz: 'Europe/Warsaw', flag: '🇵🇱' },
            { city: 'Prague', tz: 'Europe/Prague', flag: '🇨🇿' },
            { city: 'Vienna', tz: 'Europe/Vienna', flag: '🇦🇹' },
            { city: 'Zurich', tz: 'Europe/Zurich', flag: '🇨🇭' },
            { city: 'Brussels', tz: 'Europe/Brussels', flag: '🇧🇪' },
            { city: 'Lisbon', tz: 'Europe/Lisbon', flag: '🇵🇹' },
            { city: 'Athens', tz: 'Europe/Athens', flag: '🇬🇷' },
            { city: 'Istanbul', tz: 'Europe/Istanbul', flag: '🇹🇷' },
            { city: 'Moscow', tz: 'Europe/Moscow', flag: '🇷🇺' },
            { city: 'Cairo', tz: 'Africa/Cairo', flag: '🇪🇬' },
            { city: 'Lagos', tz: 'Africa/Lagos', flag: '🇳🇬' },
            { city: 'Nairobi', tz: 'Africa/Nairobi', flag: '🇰🇪' },
            { city: 'Johannesburg', tz: 'Africa/Johannesburg', flag: '🇿🇦' },
            { city: 'Casablanca', tz: 'Africa/Casablanca', flag: '🇲🇦' },
            { city: 'Accra', tz: 'Africa/Accra', flag: '🇬🇭' },
            { city: 'Riyadh', tz: 'Asia/Riyadh', flag: '🇸🇦' },
            { city: 'Dubai', tz: 'Asia/Dubai', flag: '🇦🇪' },
            { city: 'Baghdad', tz: 'Asia/Baghdad', flag: '🇮🇶' },
            { city: 'Tehran', tz: 'Asia/Tehran', flag: '🇮🇷' },
            { city: 'Karachi', tz: 'Asia/Karachi', flag: '🇵🇰' },
            { city: 'Mumbai', tz: 'Asia/Kolkata', flag: '🇮🇳' },
            { city: 'New Delhi', tz: 'Asia/Kolkata', flag: '🇮🇳' },
            { city: 'Colombo', tz: 'Asia/Colombo', flag: '🇱🇰' },
            { city: 'Dhaka', tz: 'Asia/Dhaka', flag: '🇧🇩' },
            { city: 'Kathmandu', tz: 'Asia/Kathmandu', flag: '🇳🇵' },
            { city: 'Yangon', tz: 'Asia/Yangon', flag: '🇲🇲' },
            { city: 'Bangkok', tz: 'Asia/Bangkok', flag: '🇹🇭' },
            { city: 'Ho Chi Minh City', tz: 'Asia/Ho_Chi_Minh', flag: '🇻🇳' },
            { city: 'Jakarta', tz: 'Asia/Jakarta', flag: '🇮🇩' },
            { city: 'Kuala Lumpur', tz: 'Asia/Kuala_Lumpur', flag: '🇲🇾' },
            { city: 'Singapore', tz: 'Asia/Singapore', flag: '🇸🇬' },
            { city: 'Manila', tz: 'Asia/Manila', flag: '🇵🇭' },
            { city: 'Hong Kong', tz: 'Asia/Hong_Kong', flag: '🇭🇰' },
            { city: 'Shanghai', tz: 'Asia/Shanghai', flag: '🇨🇳' },
            { city: 'Beijing', tz: 'Asia/Shanghai', flag: '🇨🇳' },
            { city: 'Taipei', tz: 'Asia/Taipei', flag: '🇹🇼' },
            { city: 'Seoul', tz: 'Asia/Seoul', flag: '🇰🇷' },
            { city: 'Tokyo', tz: 'Asia/Tokyo', flag: '🇯🇵' },
            { city: 'Osaka', tz: 'Asia/Tokyo', flag: '🇯🇵' },
            { city: 'Ulaanbaatar', tz: 'Asia/Ulaanbaatar', flag: '🇲🇳' },
            { city: 'Tashkent', tz: 'Asia/Tashkent', flag: '🇺🇿' },
            { city: 'Almaty', tz: 'Asia/Almaty', flag: '🇰🇿' },
            { city: 'Kabul', tz: 'Asia/Kabul', flag: '🇦🇫' },
            { city: 'Beirut', tz: 'Asia/Beirut', flag: '🇱🇧' },
            { city: 'Amman', tz: 'Asia/Amman', flag: '🇯🇴' },
            { city: 'Tel Aviv', tz: 'Asia/Jerusalem', flag: '🇮🇱' },
            { city: 'Baku', tz: 'Asia/Baku', flag: '🇦🇿' },
            { city: 'Yerevan', tz: 'Asia/Yerevan', flag: '🇦🇲' },
            { city: 'Tbilisi', tz: 'Asia/Tbilisi', flag: '🇬🇪' },
            { city: 'Sydney', tz: 'Australia/Sydney', flag: '🇦🇺' },
            { city: 'Melbourne', tz: 'Australia/Melbourne', flag: '🇦🇺' },
            { city: 'Brisbane', tz: 'Australia/Brisbane', flag: '🇦🇺' },
            { city: 'Perth', tz: 'Australia/Perth', flag: '🇦🇺' },
            { city: 'Adelaide', tz: 'Australia/Adelaide', flag: '🇦🇺' },
            { city: 'Auckland', tz: 'Pacific/Auckland', flag: '🇳🇿' },
            { city: 'Honolulu', tz: 'Pacific/Honolulu', flag: '🇺🇸' },
            { city: 'Anchorage', tz: 'America/Anchorage', flag: '🇺🇸' },
            { city: 'Reykjavik', tz: 'Atlantic/Reykjavik', flag: '🇮🇸' },
            { city: 'Bogotá', tz: 'America/Bogota', flag: '🇨🇴' },
            { city: 'Lima', tz: 'America/Lima', flag: '🇵🇪' },
            { city: 'Caracas', tz: 'America/Caracas', flag: '🇻🇪' },
            { city: 'Havana', tz: 'America/Havana', flag: '🇨🇺' },
            { city: 'Panama City', tz: 'America/Panama', flag: '🇵🇦' },
            { city: 'Doha', tz: 'Asia/Qatar', flag: '🇶🇦' },
            { city: 'Kuwait City', tz: 'Asia/Kuwait', flag: '🇰🇼' },
            { city: 'Muscat', tz: 'Asia/Muscat', flag: '🇴🇲' },
            { city: 'Dhahran', tz: 'Asia/Riyadh', flag: '🇸🇦' },
            { city: 'Addis Ababa', tz: 'Africa/Addis_Ababa', flag: '🇪🇹' },
            { city: 'Dar es Salaam', tz: 'Africa/Dar_es_Salaam', flag: '🇹🇿' },
            { city: 'Khartoum', tz: 'Africa/Khartoum', flag: '🇸🇩' },
            { city: 'Tunis', tz: 'Africa/Tunis', flag: '🇹🇳' },
            { city: 'Algiers', tz: 'Africa/Algiers', flag: '🇩🇿' },
            { city: 'Tripoli', tz: 'Africa/Tripoli', flag: '🇱🇾' },
        ];

        // ---- State ----
        const storageKey = 'worldClocks';
        let wcClocks = []; // [{ city, tz, flag }]
        let wcTickInterval = null;
        const localTz = Intl.DateTimeFormat().resolvedOptions().timeZone;

        // ---- DOM refs ----
        const wcSearchInput  = document.getElementById('wc-search-input');
        const wcSearchClear  = document.getElementById('wc-search-clear');
        const wcSuggestions  = document.getElementById('wc-suggestions');
        const wcList         = document.getElementById('wc-list');
        const wcEmpty        = document.getElementById('wc-empty');

        // ---- Load from storage ----
        function loadClocks() {
            chrome.storage.local.get([storageKey], result => {
                wcClocks = result[storageKey] || [];
                renderAll();
            });
        }

        function saveClocks() {
            chrome.storage.local.set({ [storageKey]: wcClocks });
        }

        // ---- Helpers ----
        function getOffsetLabel(tz) {
            try {
                const now = new Date();
                const parts = new Intl.DateTimeFormat('en', {
                    timeZone: tz, timeZoneName: 'shortOffset'
                }).formatToParts(now);
                const off = parts.find(p => p.type === 'timeZoneName');
                return off ? off.value : '';
            } catch(e) { return ''; }
        }

        function getDayDiff(tz) {
            const now = new Date();
            const localDay = new Date(now.toLocaleDateString('en-CA', { timeZone: localTz }));
            const tzDay    = new Date(now.toLocaleDateString('en-CA', { timeZone: tz }));
            const diff = Math.round((tzDay - localDay) / 86400000);
            return diff;
        }

        function formatWcTime(tz, use24) {
            const now = new Date();
            return now.toLocaleTimeString('en-US', {
                timeZone: tz,
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
                hour12: !use24
            });
        }

        function formatWcDate(tz) {
            const now = new Date();
            return now.toLocaleDateString('en-US', { timeZone: tz, weekday: 'short', month: 'short', day: 'numeric' });
        }

        // ---- Drag state ----
        let wcDragIdx = null;

        // ---- Render ----
        function renderAll() {
            wcList.innerHTML = '';
            const use24 = (typeof clockFormat !== 'undefined') ? clockFormat === '24' : true;

            if (wcClocks.length === 0) {
                wcEmpty.classList.remove('hidden');
                stopTick();
                return;
            }
            wcEmpty.classList.add('hidden');

            wcClocks.forEach((clock, idx) => {
                const isHome = clock.tz === localTz;
                const card = document.createElement('div');
                card.className = 'wc-clock-card' + (isHome ? ' wc-home-card' : '');
                card.dataset.idx = idx;
                card.draggable = true;

                const dayDiff = getDayDiff(clock.tz);

                // Build card with DOM methods to avoid unsafe innerHTML assignment
                const dragHandle = document.createElement('div');
                dragHandle.className = 'wc-drag-handle';
                dragHandle.title = 'Drag to reorder';
                dragHandle.innerHTML = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="4" y1="7" x2="20" y2="7"/><line x1="4" y1="12" x2="20" y2="12"/><line x1="4" y1="17" x2="20" y2="17"/></svg>';

                const cardLeft = document.createElement('div');
                cardLeft.className = 'wc-card-left';

                const cityDiv = document.createElement('div');
                cityDiv.className = 'wc-card-city';
                cityDiv.textContent = (clock.flag ? clock.flag + ' ' : '') + clock.city;

                const tzOffsetDiv = document.createElement('div');
                tzOffsetDiv.className = 'wc-card-tz-offset';
                tzOffsetDiv.textContent = getOffsetLabel(clock.tz);
                if (dayDiff !== 0) {
                    const dayDiffSpan = document.createElement('span');
                    dayDiffSpan.className = 'wc-card-day-diff ' + (dayDiff > 0 ? 'ahead' : 'behind');
                    dayDiffSpan.textContent = (dayDiff > 0 ? '+' : '') + dayDiff + 'd';
                    tzOffsetDiv.appendChild(dayDiffSpan);
                }

                cardLeft.appendChild(cityDiv);
                cardLeft.appendChild(tzOffsetDiv);

                const cardRight = document.createElement('div');
                cardRight.className = 'wc-card-right';

                const timeDiv = document.createElement('div');
                timeDiv.className = 'wc-card-time';
                timeDiv.dataset.wcTime = idx;
                timeDiv.textContent = formatWcTime(clock.tz, use24);

                const dateDiv = document.createElement('div');
                dateDiv.className = 'wc-card-date';
                dateDiv.dataset.wcDate = idx;
                dateDiv.textContent = formatWcDate(clock.tz);

                cardRight.appendChild(timeDiv);
                cardRight.appendChild(dateDiv);

                const deleteBtn = document.createElement('button');
                deleteBtn.className = 'wc-delete-btn';
                deleteBtn.title = 'Remove';
                deleteBtn.textContent = '\u00d7';

                card.appendChild(dragHandle);
                card.appendChild(cardLeft);
                card.appendChild(cardRight);
                card.appendChild(deleteBtn);

                // Delete
                deleteBtn.addEventListener('click', e => {
                    e.stopPropagation();
                    wcClocks.splice(idx, 1);
                    saveClocks();
                    renderAll();
                });

                // Drag-and-drop
                card.addEventListener('dragstart', e => {
                    wcDragIdx = idx;
                    card.classList.add('wc-dragging');
                    e.dataTransfer.effectAllowed = 'move';
                });
                card.addEventListener('dragend', () => {
                    card.classList.remove('wc-dragging');
                    wcList.querySelectorAll('.wc-drag-over').forEach(el => el.classList.remove('wc-drag-over'));
                    wcDragIdx = null;
                });
                card.addEventListener('dragover', e => {
                    e.preventDefault();
                    e.dataTransfer.dropEffect = 'move';
                    if (wcDragIdx !== null && wcDragIdx !== idx) {
                        wcList.querySelectorAll('.wc-drag-over').forEach(el => el.classList.remove('wc-drag-over'));
                        card.classList.add('wc-drag-over');
                    }
                });
                card.addEventListener('dragleave', () => {
                    card.classList.remove('wc-drag-over');
                });
                card.addEventListener('drop', e => {
                    e.preventDefault();
                    card.classList.remove('wc-drag-over');
                    if (wcDragIdx === null || wcDragIdx === idx) return;
                    const moved = wcClocks.splice(wcDragIdx, 1)[0];
                    wcClocks.splice(idx, 0, moved);
                    saveClocks();
                    renderAll();
                });

                wcList.appendChild(card);
            });

            startTick();
        }

        function tickClocks() {
            const use24 = (typeof clockFormat !== 'undefined') ? clockFormat === '24' : true;
            wcList.querySelectorAll('[data-wc-time]').forEach(el => {
                const idx = parseInt(el.dataset.wcTime, 10);
                if (wcClocks[idx]) el.textContent = formatWcTime(wcClocks[idx].tz, use24);
            });
            wcList.querySelectorAll('[data-wc-date]').forEach(el => {
                const idx = parseInt(el.dataset.wcDate, 10);
                if (wcClocks[idx]) el.textContent = formatWcDate(wcClocks[idx].tz);
            });
        }

        function startTick() {
            if (!wcTickInterval) wcTickInterval = setInterval(tickClocks, 1000);
        }
        function stopTick() {
            if (wcTickInterval) { clearInterval(wcTickInterval); wcTickInterval = null; }
        }

        // ---- Search / Suggestions ----
        function showSuggestions(query) {
            const q = query.trim().toLowerCase();
            if (!q) { wcSuggestions.classList.add('hidden'); wcSuggestions.innerHTML = ''; return; }
            const matches = TZ_DB.filter(e =>
                e.city.toLowerCase().includes(q) || e.tz.toLowerCase().includes(q)
            ).slice(0, 8);
            if (!matches.length) { wcSuggestions.classList.add('hidden'); wcSuggestions.innerHTML = ''; return; }
            wcSuggestions.innerHTML = '';
            matches.forEach(m => {
                const item = document.createElement('div');
                item.className = 'wc-suggestion-item';
                const citySpan = document.createElement('span');
                citySpan.className = 'wc-sug-city';
                citySpan.textContent = (m.flag ? m.flag + ' ' : '') + m.city;
                const tzSpan = document.createElement('span');
                tzSpan.className = 'wc-sug-tz';
                tzSpan.textContent = m.tz;
                item.appendChild(citySpan);
                item.appendChild(tzSpan);
                item.addEventListener('click', () => {
                    // Avoid duplicates (same city+tz)
                    const alreadyAdded = wcClocks.some(c => c.city === m.city && c.tz === m.tz);
                    if (!alreadyAdded) {
                        wcClocks.push({ city: m.city, tz: m.tz, flag: m.flag || '' });
                        saveClocks();
                        renderAll();
                    }
                    wcSearchInput.value = '';
                    wcSearchClear.classList.add('hidden');
                    wcSuggestions.classList.add('hidden');
                    wcSuggestions.innerHTML = '';
                });
                wcSuggestions.appendChild(item);
            });
            wcSuggestions.classList.remove('hidden');
        }

        wcSearchInput.addEventListener('input', () => {
            const v = wcSearchInput.value;
            wcSearchClear.classList.toggle('hidden', !v);
            showSuggestions(v);
        });
        wcSearchClear.addEventListener('click', () => {
            wcSearchInput.value = '';
            wcSearchClear.classList.add('hidden');
            wcSuggestions.classList.add('hidden');
            wcSuggestions.innerHTML = '';
            wcSearchInput.focus();
        });
        document.addEventListener('click', e => {
            if (!e.target.closest('.wc-add-row')) {
                wcSuggestions.classList.add('hidden');
            }
        });

        // ---- Init ----
        loadClocks();
    })();

    // ============================================================
    //   COUNTDOWN TIMER
    // ============================================================
    let timerTotal = 0, timerLeft = 0, timerInterval = null, timerState = 'idle';
    const timerDisplay    = document.getElementById('timer-display');
    const ringProgress    = document.getElementById('timer-ring-progress');
    const RING_CIRCUM     = 2 * Math.PI * 54; // 339.3

    function setRing(fraction) {
        if (!ringProgress) return;
        const offset = RING_CIRCUM * (1 - fraction);
        ringProgress.style.strokeDashoffset = offset;
        ringProgress.classList.toggle('warning', fraction < 0.25 && fraction > 0.1);
        ringProgress.classList.toggle('danger',  fraction <= 0.1);
    }

    function formatTimer(secs) {
        const h = Math.floor(secs / 3600);
        const m = Math.floor((secs % 3600) / 60);
        const s = secs % 60;
        if (h > 0) return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
        return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
    }

    function updateTimerDisplay() {
        if (timerDisplay) timerDisplay.textContent = formatTimer(timerLeft);
        if (timerTotal > 0) setRing(timerLeft / timerTotal);
    }

    function startTimer() {
        if (timerLeft <= 0) return;
        timerState = 'running';
        toggleTimerButtons();
        timerInterval = setInterval(() => {
            timerLeft--;
            updateTimerDisplay();
            if (timerLeft <= 0) {
                clearInterval(timerInterval);
                timerState = 'done';
                timerDone();
            }
        }, 1000);
    }

    function timerDone() {
        setRing(0);
        toggleTimerButtons();
        const doneMsg = document.getElementById('timer-done-msg');
        const doneLabel = document.getElementById('timer-done-label');
        const labelVal = document.getElementById('timer-label-input') ? document.getElementById('timer-label-input').value.trim() : '';
        if (doneMsg) doneMsg.classList.remove('hidden');
        if (doneLabel) doneLabel.textContent = labelVal ? `"${labelVal}" is done!` : "Time's up!";
        // Browser notification
        if (Notification && Notification.permission === 'granted') {
            new Notification('Timer Done', { body: labelVal || "Your timer has finished!", icon: '' });
        } else if (Notification && Notification.permission !== 'denied') {
            Notification.requestPermission().then(p => {
                if (p === 'granted') new Notification('Timer Done', { body: labelVal || "Your timer has finished!" });
            });
        }
        // Play beep
        playBeep();
    }

    function playBeep() {
        try {
            const ctx = new (window.AudioContext || window.webkitAudioContext)();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain); gain.connect(ctx.destination);
            osc.frequency.setValueAtTime(880, ctx.currentTime);
            gain.gain.setValueAtTime(0.4, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.5);
            osc.start(ctx.currentTime);
            osc.stop(ctx.currentTime + 1.5);
        } catch(e) {}
    }

    function resetTimer() {
        clearInterval(timerInterval);
        timerState = 'idle';
        timerLeft = timerTotal;
        updateTimerDisplay();
        setRing(1);
        const doneMsg = document.getElementById('timer-done-msg');
        if (doneMsg) doneMsg.classList.add('hidden');
        toggleTimerButtons();
    }

    function toggleTimerButtons() {
        const startBtn  = document.getElementById('timer-start-btn');
        const pauseBtn  = document.getElementById('timer-pause-btn');
        const resumeBtn = document.getElementById('timer-resume-btn');
        const resetBtn  = document.getElementById('timer-reset-btn');
        if (timerState === 'idle') {
            if (startBtn)  startBtn.classList.remove('hidden');
            if (pauseBtn)  pauseBtn.classList.add('hidden');
            if (resumeBtn) resumeBtn.classList.add('hidden');
            if (resetBtn)  resetBtn.classList.add('hidden');
        } else if (timerState === 'running') {
            if (startBtn)  startBtn.classList.add('hidden');
            if (pauseBtn)  pauseBtn.classList.remove('hidden');
            if (resumeBtn) resumeBtn.classList.add('hidden');
            if (resetBtn)  resetBtn.classList.remove('hidden');
        } else if (timerState === 'paused') {
            if (startBtn)  startBtn.classList.add('hidden');
            if (pauseBtn)  pauseBtn.classList.add('hidden');
            if (resumeBtn) resumeBtn.classList.remove('hidden');
            if (resetBtn)  resetBtn.classList.remove('hidden');
        } else if (timerState === 'done') {
            if (startBtn)  startBtn.classList.add('hidden');
            if (pauseBtn)  pauseBtn.classList.add('hidden');
            if (resumeBtn) resumeBtn.classList.add('hidden');
            if (resetBtn)  resetBtn.classList.remove('hidden');
        }
    }

    function getInputSeconds() {
        const h = parseInt(document.getElementById('timer-h').value) || 0;
        const m = parseInt(document.getElementById('timer-m').value) || 0;
        const s = parseInt(document.getElementById('timer-s').value) || 0;
        return h * 3600 + m * 60 + s;
    }

    document.querySelectorAll('.timer-preset-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            clearInterval(timerInterval);
            timerState = 'idle';
            const secs = parseInt(this.dataset.seconds);
            timerTotal = secs; timerLeft = secs;
            updateTimerDisplay(); setRing(1);
            toggleTimerButtons();
            const doneMsg = document.getElementById('timer-done-msg');
            if (doneMsg) doneMsg.classList.add('hidden');
        });
    });

    document.getElementById('timer-start-btn') && document.getElementById('timer-start-btn').addEventListener('click', function() {
        if (timerTotal === 0) {
            const s = getInputSeconds();
            if (!s) return;
            timerTotal = s; timerLeft = s;
        }
        updateTimerDisplay();
        startTimer();
    });

    document.getElementById('timer-pause-btn') && document.getElementById('timer-pause-btn').addEventListener('click', function() {
        clearInterval(timerInterval);
        timerState = 'paused';
        toggleTimerButtons();
    });

    document.getElementById('timer-resume-btn') && document.getElementById('timer-resume-btn').addEventListener('click', function() {
        startTimer();
    });

    document.getElementById('timer-reset-btn') && document.getElementById('timer-reset-btn').addEventListener('click', resetTimer);

    document.getElementById('timer-dismiss-btn') && document.getElementById('timer-dismiss-btn').addEventListener('click', resetTimer);

    // Custom inputs: update preview
    ['timer-h','timer-m','timer-s'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('input', function() {
            if (timerState !== 'idle') return;
            const s = getInputSeconds();
            timerTotal = s; timerLeft = s;
            updateTimerDisplay(); setRing(1);
        });
    });

    // ============================================================
    //   STOPWATCH
    // ============================================================
    let swStart = 0, swElapsed = 0, swInterval = null, swRunning = false, swLapCount = 0, swLapBase = 0;

    function formatSW(ms) {
        const totalSecs = Math.floor(ms / 1000);
        const m = Math.floor(totalSecs / 60);
        const s = totalSecs % 60;
        const cs = Math.floor((ms % 1000) / 10);
        return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}.${String(cs).padStart(2,'0')}`;
    }

    function updateSWDisplay() {
        const el = document.getElementById('sw-display');
        if (el) el.textContent = formatSW(swElapsed);
    }

    document.getElementById('sw-start-btn') && document.getElementById('sw-start-btn').addEventListener('click', function() {
        swRunning = true; swStart = Date.now() - swElapsed;
        swInterval = setInterval(() => { swElapsed = Date.now() - swStart; updateSWDisplay(); }, 50);
        this.classList.add('hidden');
        document.getElementById('sw-pause-btn').classList.remove('hidden');
        document.getElementById('sw-lap-btn').classList.remove('hidden');
    });

    document.getElementById('sw-pause-btn') && document.getElementById('sw-pause-btn').addEventListener('click', function() {
        clearInterval(swInterval); swRunning = false;
        this.classList.add('hidden');
        document.getElementById('sw-resume-btn').classList.remove('hidden');
        document.getElementById('sw-lap-btn').classList.add('hidden');
    });

    document.getElementById('sw-resume-btn') && document.getElementById('sw-resume-btn').addEventListener('click', function() {
        swRunning = true; swStart = Date.now() - swElapsed;
        swInterval = setInterval(() => { swElapsed = Date.now() - swStart; updateSWDisplay(); }, 50);
        this.classList.add('hidden');
        document.getElementById('sw-pause-btn').classList.remove('hidden');
        document.getElementById('sw-lap-btn').classList.remove('hidden');
    });

    document.getElementById('sw-lap-btn') && document.getElementById('sw-lap-btn').addEventListener('click', function() {
        swLapCount++;
        const lapTime = swElapsed - swLapBase;
        swLapBase = swElapsed;
        const lapsEl = document.getElementById('sw-laps');
        if (lapsEl) {
            const item = document.createElement('div');
            item.className = 'sw-lap-item';
            const lapNum = document.createElement('span'); lapNum.className = 'sw-lap-num'; lapNum.textContent = `Lap ${swLapCount}`;
            const lapTime2 = document.createElement('span'); lapTime2.textContent = formatSW(lapTime);
            const lapTotal = document.createElement('span'); lapTotal.textContent = formatSW(swElapsed);
            item.append(lapNum, lapTime2, lapTotal);
            lapsEl.insertBefore(item, lapsEl.firstChild);
        }
    });

    document.getElementById('sw-reset-btn') && document.getElementById('sw-reset-btn').addEventListener('click', function() {
        clearInterval(swInterval); swRunning = false; swElapsed = 0; swStart = 0; swLapCount = 0; swLapBase = 0;
        updateSWDisplay();
        document.getElementById('sw-start-btn').classList.remove('hidden');
        document.getElementById('sw-pause-btn').classList.add('hidden');
        document.getElementById('sw-resume-btn').classList.add('hidden');
        document.getElementById('sw-lap-btn').classList.add('hidden');
        const lapsEl = document.getElementById('sw-laps');
        if (lapsEl) lapsEl.innerHTML = '';
    });

    // ============================================================
    //   ALARM
    // ============================================================
    let alarms = [];
    let alarmCheckInterval = null;
    let firingAlarmId = null;
    let selectedDays = [];

    function loadAlarms() {
        chrome.storage.local.get(['alarms'], function(r) {
            alarms = r.alarms || [];
            renderAlarmList();
        });
    }

    function saveAlarms() {
        chrome.storage.local.set({ alarms });
    }

    // Expose so the clock-format toggle can re-render alarm times live
    window._renderAlarmList = function() { renderAlarmList(); };

    function renderAlarmList() {
        const list = document.getElementById('alarm-list');
        if (!list) return;
        list.innerHTML = '';
        if (alarms.length === 0) {
            const empty = document.createElement('div');
            empty.style.cssText = 'text-align:center;opacity:0.4;font-size:0.85rem;padding:1.5rem;';
            empty.textContent = 'No alarms set';
            list.appendChild(empty);
            return;
        }

        // Sort alarms chronologically by their stored "HH:MM" time
        const sorted = alarms
            .map((a, originalIdx) => ({ a, originalIdx }))
            .sort((x, y) => x.a.time.localeCompare(y.a.time));

        // Format "HH:MM" to respect the user's clockFormat (12 or 24h)
        function formatAlarmTime(timeStr) {
            if (!timeStr) return timeStr;
            const [hStr, mStr] = timeStr.split(':');
            const h = parseInt(hStr, 10);
            const m = mStr;
            if (clockFormat === '12') {
                const period = h >= 12 ? 'PM' : 'AM';
                const h12 = h % 12 || 12;
                return `${h12}:${m} ${period}`;
            }
            return timeStr; // already "HH:MM" in 24h
        }

        sorted.forEach(({ a, originalIdx }) => {
            const item = document.createElement('div');
            item.className = 'alarm-item';

            const timeEl = document.createElement('div');
            timeEl.className = 'alarm-item-time';
            timeEl.textContent = formatAlarmTime(a.time);

            const info = document.createElement('div');
            info.className = 'alarm-item-info';
            const labelEl = document.createElement('div');
            labelEl.className = 'alarm-item-label';
            labelEl.textContent = a.label || 'Alarm';
            const daysEl = document.createElement('div');
            daysEl.className = 'alarm-item-days';
            const dayNames = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
            daysEl.textContent = a.days && a.days.length ? a.days.map(d => dayNames[d]).join(', ') : 'Once';
            info.append(labelEl, daysEl);

            // Toggle
            const toggleLabel = document.createElement('label');
            toggleLabel.className = 'toggle-switch alarm-item-toggle';
            toggleLabel.style.width = '36px'; toggleLabel.style.height = '20px';
            const toggleInput = document.createElement('input');
            toggleInput.type = 'checkbox';
            toggleInput.checked = a.enabled !== false;
            const toggleTrackEl = document.createElement('span');
            toggleTrackEl.className = 'toggle-track';
            const toggleThumbEl = document.createElement('span');
            toggleThumbEl.className = 'toggle-thumb';
            toggleLabel.append(toggleInput, toggleTrackEl, toggleThumbEl);
            toggleInput.addEventListener('change', function() {
                alarms[originalIdx].enabled = this.checked;
                saveAlarms();
            });

            const delBtn = document.createElement('button');
            delBtn.className = 'alarm-item-delete';
            delBtn.textContent = '×';
            delBtn.addEventListener('click', function() {
                alarms.splice(originalIdx, 1);
                saveAlarms();
                renderAlarmList();
            });

            item.append(timeEl, info, toggleLabel, delBtn);
            list.appendChild(item);
        });
    }

    // Day toggle buttons
    document.querySelectorAll('.alarm-day-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const day = parseInt(this.dataset.day);
            this.classList.toggle('active');
            if (this.classList.contains('active')) {
                if (!selectedDays.includes(day)) selectedDays.push(day);
            } else {
                selectedDays = selectedDays.filter(d => d !== day);
            }
        });
    });

    // ============================================================
    //   CUSTOM ALARM TIME PICKER
    // ============================================================
    (function initAlarmTimePicker() {
        const display   = document.getElementById('alarm-time-display');
        const picker    = document.getElementById('alarm-time-picker');
        const colH      = document.getElementById('atp-hours');
        const colM      = document.getElementById('atp-minutes');
        const colAmpm   = document.getElementById('atp-ampm');
        if (!display || !picker) return;

        let selH = -1, selM = -1, selAmpm = 'AM'; // -1 = nothing chosen yet

        function is12() { return (typeof clockFormat !== 'undefined') ? clockFormat === '12' : false; }

        function buildCols() {
            colH.innerHTML = '';
            colM.innerHTML = '';
            colAmpm.innerHTML = '';

            const hours = is12()
                ? Array.from({length:12}, (_,i) => String(i+1).padStart(2,'0'))   // 01-12
                : Array.from({length:24}, (_,i) => String(i).padStart(2,'0'));     // 00-23
            const mins  = Array.from({length:60}, (_,i) => String(i).padStart(2,'0'));

            hours.forEach(h => {
                const cell = document.createElement('div');
                cell.className = 'atp-cell';
                cell.textContent = h;
                cell.dataset.val = h;
                if (selH !== -1) {
                    const displayH = is12() ? String(selH === 0 ? 12 : selH > 12 ? selH - 12 : selH).padStart(2,'0') : String(selH).padStart(2,'0');
                    if (h === displayH) cell.classList.add('atp-selected');
                }
                cell.addEventListener('click', () => {
                    colH.querySelectorAll('.atp-cell').forEach(c => c.classList.remove('atp-selected'));
                    cell.classList.add('atp-selected');
                    selH = is12() ? parseInt(h, 10) : parseInt(h, 10); // keep as display value for now
                    updateDisplay();
                });
                colH.appendChild(cell);
            });

            mins.forEach(m => {
                const cell = document.createElement('div');
                cell.className = 'atp-cell';
                cell.textContent = m;
                cell.dataset.val = m;
                if (selM !== -1 && parseInt(m,10) === selM) cell.classList.add('atp-selected');
                cell.addEventListener('click', () => {
                    colM.querySelectorAll('.atp-cell').forEach(c => c.classList.remove('atp-selected'));
                    cell.classList.add('atp-selected');
                    selM = parseInt(m, 10);
                    updateDisplay();
                });
                colM.appendChild(cell);
            });

            if (is12()) {
                colAmpm.classList.remove('hidden');
                ['AM','PM'].forEach(p => {
                    const cell = document.createElement('div');
                    cell.className = 'atp-cell' + (selAmpm === p ? ' atp-selected' : '');
                    cell.textContent = p;
                    cell.addEventListener('click', () => {
                        colAmpm.querySelectorAll('.atp-cell').forEach(c => c.classList.remove('atp-selected'));
                        cell.classList.add('atp-selected');
                        selAmpm = p;
                        updateDisplay();
                    });
                    colAmpm.appendChild(cell);
                });
            } else {
                colAmpm.classList.add('hidden');
            }
        }

        function updateDisplay() {
            if (selH === -1 || selM === -1) { display.textContent = '--:-- ' + (is12() ? '--' : ''); return; }
            const mStr = String(selM).padStart(2,'0');
            if (is12()) {
                display.textContent = `${String(selH).padStart(2,'0')}:${mStr} ${selAmpm}`;
            } else {
                display.textContent = `${String(selH).padStart(2,'0')}:${mStr}`;
            }
        }

        // Convert picker state → "HH:MM" 24h for storage
        function getTime24() {
            if (selH === -1 || selM === -1) return null;
            let h = selH;
            if (is12()) {
                if (selAmpm === 'AM') { h = (selH === 12) ? 0 : selH; }
                else                  { h = (selH === 12) ? 12 : selH + 12; }
            }
            return `${String(h).padStart(2,'0')}:${String(selM).padStart(2,'0')}`;
        }

        // Rebuild when format changes (called from clock-format toggle)
        window._rebuildAlarmPicker = function() {
            // Rebuild keeping existing selection
            buildCols();
            updateDisplay();
            // Update the display button text format
            if (picker.classList.contains('hidden')) {
                // picker closed — just refresh display label
            }
        };

        // Toggle picker open/close
        display.addEventListener('click', () => {
            const isOpen = !picker.classList.contains('hidden');
            if (isOpen) {
                picker.classList.add('hidden');
                display.classList.remove('atp-open');
            } else {
                buildCols();
                picker.classList.remove('hidden');
                display.classList.add('atp-open');
            }
        });

        // Expose getter for the add-alarm handler
        window._getAlarmPickerTime = getTime24;
        window._resetAlarmPicker   = function() {
            selH = -1; selM = -1; selAmpm = 'AM';
            display.textContent = '--:-- ' + (is12() ? '--' : '');
            picker.classList.add('hidden');
            display.classList.remove('atp-open');
        };
    })();

    document.getElementById('alarm-add-btn') && document.getElementById('alarm-add-btn').addEventListener('click', function() {
        const labelInput = document.getElementById('alarm-label-input');
        const time24 = typeof window._getAlarmPickerTime === 'function' ? window._getAlarmPickerTime() : null;
        if (!time24) return; // nothing selected
        const alarm = {
            id: 'alarm_' + Date.now(),
            time: time24,
            label: labelInput ? labelInput.value.trim() : '',
            days: [...selectedDays],
            enabled: true
        };
        alarms.push(alarm);
        saveAlarms();
        renderAlarmList();
        if (typeof window._resetAlarmPicker === 'function') window._resetAlarmPicker();
        if (labelInput) labelInput.value = '';
        selectedDays = [];
        document.querySelectorAll('.alarm-day-btn').forEach(b => b.classList.remove('active'));
    });

    // Alarm checker
    function checkAlarms() {
        if (!alarms.length || firingAlarmId) return;
        const now = new Date();
        const hh = String(now.getHours()).padStart(2,'0');
        const mm = String(now.getMinutes()).padStart(2,'0');
        const currentTime = `${hh}:${mm}`;
        const currentDay = now.getDay();

        alarms.forEach(a => {
            if (!a.enabled || a.time !== currentTime) return;
            if (a.days && a.days.length && !a.days.includes(currentDay)) return;
            fireAlarm(a);
        });
    }

    function fireAlarm(a) {
        firingAlarmId = a.id;
        const banner = document.getElementById('alarm-firing');
        const lbl = document.getElementById('alarm-firing-label');
        if (banner) banner.classList.remove('hidden');
        if (lbl) lbl.textContent = a.label || 'Alarm!';
        playBeep();
        // Also open panel if closed
        if (!panelOpen) {
            openPanel();
            // Switch to alarm tab
            timerTabs.forEach(t => t.classList.remove('active'));
            document.querySelector('.timer-tab[data-tab="alarm"]') && document.querySelector('.timer-tab[data-tab="alarm"]').classList.add('active');
            Object.entries(views).forEach(([k, v]) => { if (v) v.classList.toggle('hidden', k !== 'alarm'); });
        }
        if (Notification && Notification.permission === 'granted') {
            new Notification('Alarm', { body: a.label || 'Time to wake up!' });
        }
    }

    document.getElementById('alarm-dismiss-alarm-btn') && document.getElementById('alarm-dismiss-alarm-btn').addEventListener('click', function() {
        const dismissingId = firingAlarmId;
        firingAlarmId = null;
        const banner = document.getElementById('alarm-firing');
        if (banner) banner.classList.add('hidden');
        // If once alarm, disable it
        if (dismissingId) {
            const a = alarms.find(x => x.id === dismissingId);
            if (a && (!a.days || !a.days.length)) { a.enabled = false; saveAlarms(); renderAlarmList(); }
        }
    });

    document.getElementById('alarm-snooze-btn') && document.getElementById('alarm-snooze-btn').addEventListener('click', function() {
        firingAlarmId = null;
        const banner = document.getElementById('alarm-firing');
        if (banner) banner.classList.add('hidden');
        // Add snooze alarm 5 minutes from now
        const snoozeTime = new Date(Date.now() + 5 * 60 * 1000);
        const sh = String(snoozeTime.getHours()).padStart(2,'0');
        const sm = String(snoozeTime.getMinutes()).padStart(2,'0');
        alarms.push({ id: 'snooze_' + Date.now(), time: `${sh}:${sm}`, label: 'Snooze', days: [], enabled: true, _snooze: true });
        saveAlarms();
        renderAlarmList();
    });

    // Init alarms
    loadAlarms();
    alarmCheckInterval = setInterval(checkAlarms, 10000); // check every 10s
    checkAlarms(); // check immediately

})();


// =============================================
//   CUSTOM CONTEXT MENU ENGINE
//   Glassmorphism right-click menus
// =============================================

(function initContextMenus() {

    // ── State ──
    let activeMenu = null;
    let ctxShortcutIndex = null;     // index of right-clicked shortcut in myShortcuts
    let ctxShortcutData  = null;     // { name, url, customFavicon? }
    let pendingFaviconData = null;   // { type: 'default'|'url'|'local', value: string|null }
    let activeFavTab = 'default';

    const menuWallpaper = document.getElementById('ctx-wallpaper');
    const menuShortcut  = document.getElementById('ctx-shortcut');
    const addPopup      = document.getElementById('ctx-add-shortcut-popup');
    const editPopup     = document.getElementById('ctx-edit-popup');

    // ── Helpers ──
    function hideAllMenus() {
        [menuWallpaper, menuShortcut].forEach(m => {
            if (m) m.classList.remove('ctx-visible');
        });
        activeMenu = null;
    }

    function showMenu(menu, x, y) {
        hideAllMenus();
        activeMenu = menu;
        menu.style.left = '0px';
        menu.style.top  = '0px';
        menu.classList.add('ctx-visible');

        // Clamp to viewport
        const rect = menu.getBoundingClientRect();
        const maxX = window.innerWidth  - rect.width  - 8;
        const maxY = window.innerHeight - rect.height - 8;
        menu.style.left = Math.min(x, maxX) + 'px';
        menu.style.top  = Math.min(y, maxY) + 'px';
    }

    function openPopup(popup) {
        popup.classList.remove('ctx-popup-hidden');
    }

    function closePopup(popup) {
        popup.classList.add('ctx-popup-hidden');
    }

    function getFaviconUrl(url, customFavicon) {
        if (customFavicon) return customFavicon;
        return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(url)}&sz=64`;
    }

    // ── Global listeners ──
    document.addEventListener('click', function(e) {
        if (!activeMenu) return;
        if (!activeMenu.contains(e.target)) hideAllMenus();
    });

    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            hideAllMenus();
            closePopup(addPopup);
            closePopup(editPopup);
        }
    });

    // ── WALLPAPER CONTEXT MENU ──
    document.addEventListener('contextmenu', function(e) {
        // Allow native context menu when Alt is held
        if (e.altKey) return;

        const shortcutEl = e.target.closest('.shortcut-item');

        if (shortcutEl) {
            // ── Shortcut right-click ──
            e.preventDefault();
            const idx = parseInt(shortcutEl.getAttribute('data-index'));
            chrome.storage.local.get(['myShortcuts'], function(result) {
                const shortcuts = result.myShortcuts || [];
                ctxShortcutIndex = idx;
                ctxShortcutData  = shortcuts[idx];
                if (!ctxShortcutData) return;

                const nameEl = document.getElementById('ctx-shortcut-name');
                if (nameEl) nameEl.textContent = ctxShortcutData.name || 'Shortcut';
                showMenu(menuShortcut, e.clientX, e.clientY);
            });
            return;
        }

        // ── Wallpaper right-click (not on interactive elements) ──
        const interactiveEl = e.target.closest(
            'button, a, input, select, textarea, label, ' +
            '#settings-modal, #timer-panel, #history-panel, ' +
            '#bookmarks-panel, #calendar-panel, #notes-panel, ' +
            '#cal-notes-panel, [id$="-panel"], ' +
            '#ctx-add-shortcut-popup, #ctx-edit-popup'
        );
        if (interactiveEl) return; // let native or extension handle

        e.preventDefault();

        // Sync lock button label based on current bg state
        chrome.storage.local.get(['bgSetting'], function(result) {
            const bg = result.bgSetting || {};
            const lockLabel = document.getElementById('ctx-bg-lock-label');
            const lockHint  = document.getElementById('ctx-bg-lock-hint');
            const isLocked  = bg.interval === 'locked';
            const isRotation = bg.type === 'rotation' || bg.type === 'pixabay';

            if (lockLabel) lockLabel.textContent = isLocked ? 'Unlock Background' : 'Lock Background';
            if (lockHint)  lockHint.textContent  = isLocked ? 'Resume rotation' : 'Pause rotation';

            const nextBtn = document.getElementById('ctx-bg-next');
            if (nextBtn) nextBtn.style.opacity = (!isRotation || isLocked) ? '0.35' : '1';
            if (nextBtn) nextBtn.style.pointerEvents = (!isRotation || isLocked) ? 'none' : '';

            showMenu(menuWallpaper, e.clientX, e.clientY);
        });
    });

    // ── WALLPAPER MENU ACTIONS ──

    document.getElementById('ctx-bg-settings') && document.getElementById('ctx-bg-settings').addEventListener('click', function() {
        hideAllMenus();
        // Open settings modal using the same mechanism as the settings button
        const modal = document.getElementById('settings-modal');
        if (modal) {
            modal.classList.add('active');
            // Scroll to background type select (first real setting)
            setTimeout(function() {
                const bgTypeEl = document.getElementById('bg-type-select');
                if (bgTypeEl) bgTypeEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }, 120);
        }
    });

    document.getElementById('ctx-bg-lock') && document.getElementById('ctx-bg-lock').addEventListener('click', function() {
        hideAllMenus();
        chrome.storage.local.get(['bgSetting'], function(result) {
            const bg = result.bgSetting || {};
            const isLocked = bg.interval === 'locked';
            const newInterval = isLocked ? 'newtab' : 'locked';
            chrome.storage.local.set({ bgSetting: { ...bg, interval: newInterval } }, function() {
                // Sync the settings UI select if open
                const bgIntSel = document.getElementById('bg-interval-select');
                if (bgIntSel) bgIntSel.value = newInterval;
                const pexIntSel = document.getElementById('pixabay-interval-select');
                if (pexIntSel) pexIntSel.value = newInterval;
            });
        });
    });

    document.getElementById('ctx-bg-next') && document.getElementById('ctx-bg-next').addEventListener('click', function() {
        hideAllMenus();
        chrome.storage.local.get(['bgSetting'], function(result) {
            const bg = result.bgSetting || {};
            if (bg.interval === 'locked') return;
            if (bg.type === 'pixabay') {
                if (typeof triggerPixabayRotation === 'function') triggerPixabayRotation(bg.interval || 'newtab');
            } else {
                if (typeof triggerNewPicsumRotation === 'function') triggerNewPicsumRotation(bg.interval || 'newtab');
            }
        });
    });

    document.getElementById('ctx-bg-download') && document.getElementById('ctx-bg-download').addEventListener('click', function() {
        hideAllMenus();
        chrome.storage.local.get(['bgSetting'], function(result) {
            const bg = result.bgSetting || {};
            const url = bg.value || document.body.style.backgroundImage.replace(/url\(['"]?|['"]?\)/g, '');
            if (!url || url === 'none' || url.startsWith('data:video') || url === '__idb_video__') {
                // Video background — can't easily download
                const toastEl = document.createElement('div');
                toastEl.textContent = 'Video backgrounds cannot be downloaded here.';
                toastEl.style.cssText = 'position:fixed;bottom:30px;left:50%;transform:translateX(-50%);background:rgba(20,20,30,0.85);color:#fff;padding:10px 18px;border-radius:10px;font-size:0.85rem;z-index:999999;backdrop-filter:blur(12px);';
                document.body.appendChild(toastEl);
                setTimeout(() => toastEl.remove(), 3000);
                return;
            }
            // Fetch and download
            fetch(url)
                .then(r => r.blob())
                .then(blob => {
                    const ext = blob.type.includes('png') ? 'png' : blob.type.includes('webp') ? 'webp' : 'jpg';
                    const a = document.createElement('a');
                    a.href = URL.createObjectURL(blob);
                    a.download = `wallpaper.${ext}`;
                    a.click();
                    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
                })
                .catch(() => {
                    // Cross-origin: open in new tab as fallback
                    window.open(url, '_blank');
                });
        });
    });

    document.getElementById('ctx-add-shortcut') && document.getElementById('ctx-add-shortcut').addEventListener('click', function() {
        hideAllMenus();
        openAddShortcutPopup();
    });

    // ── SHORTCUT MENU ACTIONS ──

    document.getElementById('ctx-sc-edit') && document.getElementById('ctx-sc-edit').addEventListener('click', function() {
        hideAllMenus();
        if (ctxShortcutData !== null) openEditPopup(ctxShortcutIndex, ctxShortcutData);
    });

    document.getElementById('ctx-sc-favicon') && document.getElementById('ctx-sc-favicon').addEventListener('click', function() {
        hideAllMenus();
        if (ctxShortcutData !== null) {
            openEditPopup(ctxShortcutIndex, ctxShortcutData, true /* openToFavicon */);
        }
    });

    document.getElementById('ctx-sc-refresh-favicon') && document.getElementById('ctx-sc-refresh-favicon').addEventListener('click', function() {
        hideAllMenus();
        if (ctxShortcutIndex === null) return;
        // Remove customFavicon so it falls back to Google favicon service
        chrome.storage.local.get(['myShortcuts'], function(result) {
            const shortcuts = result.myShortcuts || [];
            if (!shortcuts[ctxShortcutIndex]) return;
            delete shortcuts[ctxShortcutIndex].customFavicon;
            chrome.storage.local.set({ myShortcuts: shortcuts }, function() {
                const display = (_groupsEnabled && _activeGroup) ? shortcuts.filter(s => s.groupId === _activeGroup) : shortcuts;
                renderShortcuts(display);
                showToast('Icon refreshed');
            });
        });
    });

    document.getElementById('ctx-sc-delete') && document.getElementById('ctx-sc-delete').addEventListener('click', function() {
        hideAllMenus();
        if (ctxShortcutIndex !== null && typeof removeShortcut === 'function') {
            removeShortcut(ctxShortcutIndex);
        }
    });

    // ── ADD SHORTCUT POPUP ──

    function openAddShortcutPopup() {
        document.getElementById('ctx-add-name').value = '';
        document.getElementById('ctx-add-url').value  = '';
        document.getElementById('ctx-add-preview').classList.add('ctx-hidden');
        openPopup(addPopup);
        setTimeout(() => document.getElementById('ctx-add-name').focus(), 120);
    }

    // Live preview when URL changes
    let addUrlDebounce = null;
    document.getElementById('ctx-add-url') && document.getElementById('ctx-add-url').addEventListener('input', function() {
        clearTimeout(addUrlDebounce);
        const val = this.value.trim();
        addUrlDebounce = setTimeout(function() {
            const preview = document.getElementById('ctx-add-preview');
            const img = document.getElementById('ctx-add-preview-img');
            const name = document.getElementById('ctx-add-preview-name');
            const nameInput = document.getElementById('ctx-add-name');
            if (!val) { preview.classList.add('ctx-hidden'); return; }
            let url = val;
            if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
            img.src = `https://www.google.com/s2/favicons?domain=${encodeURIComponent(url)}&sz=64`;
            name.textContent = nameInput.value.trim() || url;
            preview.classList.remove('ctx-hidden');
        }, 500);
    });

    document.getElementById('ctx-add-name') && document.getElementById('ctx-add-name').addEventListener('input', function() {
        const name = document.getElementById('ctx-add-preview-name');
        if (name) name.textContent = this.value.trim() || document.getElementById('ctx-add-url').value.trim();
    });

    document.getElementById('ctx-add-close') && document.getElementById('ctx-add-close').addEventListener('click', function() {
        closePopup(addPopup);
    });
    document.getElementById('ctx-add-cancel') && document.getElementById('ctx-add-cancel').addEventListener('click', function() {
        closePopup(addPopup);
    });
    addPopup && addPopup.addEventListener('click', function(e) {
        if (e.target === addPopup) closePopup(addPopup);
    });

    document.getElementById('ctx-add-save') && document.getElementById('ctx-add-save').addEventListener('click', function() {
        let name = document.getElementById('ctx-add-name').value.trim();
        let url  = document.getElementById('ctx-add-url').value.trim();
        if (!name || !url) {
            const emptyField = !name ? document.getElementById('ctx-add-name') : document.getElementById('ctx-add-url');
            emptyField.focus();
            emptyField.style.borderColor = 'rgba(255,100,90,0.5)';
            setTimeout(() => emptyField.style.borderColor = '', 1200);
            return;
        }
        if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
        chrome.storage.local.get(['myShortcuts'], function(result) {
            const shortcuts = result.myShortcuts || [];
            shortcuts.push({ name, url });
            chrome.storage.local.set({ myShortcuts: shortcuts }, function() {
                closePopup(addPopup);
                const display = (_groupsEnabled && _activeGroup) ? shortcuts.filter(s => s.groupId === _activeGroup) : shortcuts;
                renderShortcuts(display);
                renderManageList(shortcuts);
                showToast('Shortcut added!');
            });
        });
    });

    // Enter key in add popup
    [document.getElementById('ctx-add-name'), document.getElementById('ctx-add-url')].forEach(el => {
        el && el.addEventListener('keydown', function(e) {
            if (e.key === 'Enter') document.getElementById('ctx-add-save').click();
        });
    });

    // ── EDIT SHORTCUT POPUP ──

    function openEditPopup(index, data, openToFavicon) {
        ctxShortcutIndex = index;
        ctxShortcutData  = data;
        pendingFaviconData = null;

        document.getElementById('ctx-edit-name').value = data.name || '';
        document.getElementById('ctx-edit-url').value  = data.url  || '';

        // Header favicon
        const headerFav = document.getElementById('ctx-edit-header-favicon');
        if (headerFav) headerFav.src = getFaviconUrl(data.url, data.customFavicon);

        // Default favicon preview
        const favPreview = document.getElementById('ctx-edit-favicon-preview');
        if (favPreview) favPreview.src = getFaviconUrl(data.url, data.customFavicon);

        // Reset favicon tab to 'default'
        switchFavTab('default');

        openPopup(editPopup);
        if (openToFavicon) {
            // Scroll to favicon section
            const favSection = document.getElementById('ctx-fav-panel-default');
            if (favSection) setTimeout(() => favSection.scrollIntoView({ behavior: 'smooth' }), 120);
        } else {
            setTimeout(() => document.getElementById('ctx-edit-name').focus(), 120);
        }
    }

    function switchFavTab(tab) {
        activeFavTab = tab;
        document.querySelectorAll('.ctx-favicon-tab').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.favTab === tab);
        });
        ['default', 'url', 'local'].forEach(t => {
            const panel = document.getElementById('ctx-fav-panel-' + t);
            if (panel) panel.classList.toggle('ctx-hidden', t !== tab);
        });
    }

    document.querySelectorAll('.ctx-favicon-tab').forEach(btn => {
        btn.addEventListener('click', function() {
            switchFavTab(this.dataset.favTab);
        });
    });

    document.getElementById('ctx-edit-close') && document.getElementById('ctx-edit-close').addEventListener('click', function() {
        closePopup(editPopup);
    });
    document.getElementById('ctx-edit-cancel') && document.getElementById('ctx-edit-cancel').addEventListener('click', function() {
        closePopup(editPopup);
    });
    editPopup && editPopup.addEventListener('click', function(e) {
        if (e.target === editPopup) closePopup(editPopup);
    });

    // URL favicon preview
    document.getElementById('ctx-favicon-url-preview-btn') && document.getElementById('ctx-favicon-url-preview-btn').addEventListener('click', function() {
        const urlVal = document.getElementById('ctx-edit-favicon-url').value.trim();
        if (!urlVal) return;
        const img = document.getElementById('ctx-favicon-url-preview-img');
        img.src = urlVal;
        img.style.display = 'block';
        pendingFaviconData = { type: 'url', value: urlVal };
    });

    // Local file favicon
    document.getElementById('ctx-edit-favicon-file') && document.getElementById('ctx-edit-favicon-file').addEventListener('change', function(e) {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = function(ev) {
            const dataUrl = ev.target.result;
            const img = document.getElementById('ctx-favicon-local-preview-img');
            img.src = dataUrl;
            img.style.display = 'block';
            pendingFaviconData = { type: 'local', value: dataUrl };
        };
        reader.readAsDataURL(file);
    });

    // URL input live update of preview
    document.getElementById('ctx-edit-url') && document.getElementById('ctx-edit-url').addEventListener('input', function() {
        const url = this.value.trim() || (ctxShortcutData && ctxShortcutData.url) || '';
        const hf = document.getElementById('ctx-edit-header-favicon');
        const fp = document.getElementById('ctx-edit-favicon-preview');
        if (hf) hf.src = `https://www.google.com/s2/favicons?domain=${encodeURIComponent(url)}&sz=64`;
        if (fp) fp.src = `https://www.google.com/s2/favicons?domain=${encodeURIComponent(url)}&sz=64`;
    });

    document.getElementById('ctx-edit-save') && document.getElementById('ctx-edit-save').addEventListener('click', function() {
        let name = document.getElementById('ctx-edit-name').value.trim();
        let url  = document.getElementById('ctx-edit-url').value.trim();
        if (!name || !url) {
            const emptyField = !name ? document.getElementById('ctx-edit-name') : document.getElementById('ctx-edit-url');
            emptyField.focus();
            emptyField.style.borderColor = 'rgba(255,100,90,0.5)';
            setTimeout(() => emptyField.style.borderColor = '', 1200);
            return;
        }
        if (!/^https?:\/\//i.test(url)) url = 'https://' + url;

        chrome.storage.local.get(['myShortcuts'], function(result) {
            const shortcuts = result.myShortcuts || [];
            if (ctxShortcutIndex === null || !shortcuts[ctxShortcutIndex]) return;

            const updated = { ...shortcuts[ctxShortcutIndex], name, url };

            // Handle favicon
            if (activeFavTab === 'default') {
                delete updated.customFavicon; // use auto
            } else if (activeFavTab === 'url' && pendingFaviconData && pendingFaviconData.type === 'url') {
                updated.customFavicon = pendingFaviconData.value;
            } else if (activeFavTab === 'local' && pendingFaviconData && pendingFaviconData.type === 'local') {
                updated.customFavicon = pendingFaviconData.value;
            }
            // If tab is url/local but no pending data, keep existing customFavicon

            shortcuts[ctxShortcutIndex] = updated;
            chrome.storage.local.set({ myShortcuts: shortcuts }, function() {
                closePopup(editPopup);
                const display = (_groupsEnabled && _activeGroup) ? shortcuts.filter(s => s.groupId === _activeGroup) : shortcuts;
                renderShortcuts(display);
                renderManageList(shortcuts);
                showToast('Shortcut updated!');
            });
        });
    });

    // Enter key in edit popup
    [document.getElementById('ctx-edit-name'), document.getElementById('ctx-edit-url')].forEach(el => {
        el && el.addEventListener('keydown', function(e) {
            if (e.key === 'Enter') document.getElementById('ctx-edit-save').click();
        });
    });

    // ── TOAST NOTIFICATION ──
    function showToast(msg, duration) {
        const existing = document.getElementById('ctx-toast');
        if (existing) existing.remove();
        const toast = document.createElement('div');
        toast.id = 'ctx-toast';
        toast.textContent = msg;
        toast.style.cssText = [
            'position:fixed',
            'bottom:32px',
            'left:50%',
            'transform:translateX(-50%) translateY(10px)',
            'background:rgba(20,20,30,0.88)',
            'color:rgba(255,255,255,0.95)',
            'padding:9px 20px',
            'border-radius:50px',
            'font-size:0.84rem',
            'font-weight:500',
            'z-index:999999',
            'backdrop-filter:blur(16px)',
            'border:1px solid rgba(255,255,255,0.12)',
            'box-shadow:0 4px 16px rgba(0,0,0,0.3)',
            'transition:all 0.25s cubic-bezier(0.16,1,0.3,1)',
            'opacity:0',
        ].join(';');
        document.body.appendChild(toast);
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                toast.style.opacity = '1';
                toast.style.transform = 'translateX(-50%) translateY(0)';
            });
        });
        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateX(-50%) translateY(10px)';
            setTimeout(() => toast.remove(), 300);
        }, duration || 2200);
    }

})();

// =============================================
//   AUTO-SCALE GLASS CONTAINER
//   Uses transform:scale() for uniform shrink,
//   compensates with negative margins so flexbox
//   keeps the card perfectly vertically centered.
// =============================================
(function initAutoScale() {
    const container = document.querySelector('.glass-container');
    if (!container) return;

    const MAX_VH = 0.90;

    function applyScale() {
        container.style.transform    = '';
        container.style.marginTop    = '';
        container.style.marginBottom = '';

        const naturalH = container.getBoundingClientRect().height;
        const maxH     = window.innerHeight * MAX_VH;

        if (naturalH > maxH) {
            const scale  = maxH / naturalH;
            const lost   = naturalH * (1 - scale);
            const offset = -(lost / 2) + 'px';
            container.style.transform    = `scale(${scale})`;
            container.style.marginTop    = offset;
            container.style.marginBottom = offset;
        }
    }

    const ro = new ResizeObserver(() => applyScale());
    ro.observe(container);
    window.addEventListener('resize', applyScale);
    applyScale();
})();
