// --- Core Configuration and Shortcuts ---
const defaultShortcuts = [
    { name: 'YouTube', url: 'https://www.youtube.com' },
    { name: 'GitHub', url: 'https://www.github.com' },
    { name: 'Reddit', url: 'https://www.reddit.com' },
    { name: 'Gmail', url: 'https://mail.google.com' }
];

const defaultBg = "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=1920";

// Grab DOM Elements
const shortcutsGrid = document.getElementById('shortcuts-grid');
const settingsBtn = document.getElementById('settings-btn');
const settingsModal = document.getElementById('settings-modal');
const closeModal = document.getElementById('close-modal');
const addShortcutForm = document.getElementById('add-shortcut-form');
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

// Dark Text Toggle DOM elements
const darkTextToggle = document.getElementById('dark-text-toggle');
const toggleTrack = document.getElementById('toggle-track');
const toggleThumb = document.getElementById('toggle-thumb');

// Global index pointer for Drag-and-Drop operations
let draggedItemIndex = null;

// Clock format: '12' or '24'
let clockFormat = '24';

// --- CRITICAL: High-Priority Wallpaper Preloader ---
(function preloadWallpaper() {
    if (chrome && chrome.storage && chrome.storage.local) {
        chrome.storage.local.get(['bgSetting'], function(result) {
            let bgConfig = result.bgSetting || { type: 'default', value: defaultBg, interval: '1', lastUpdated: 0 };
            
            if (bgConfig.type === 'rotation') {
                const now = Date.now();
                const hoursPassed = (now - bgConfig.lastUpdated) / (1000 * 60 * 60);
                const intervalLimit = parseInt(bgConfig.interval) || 1;
                
                // If the user sets an hour interval, only query a brand new link if that time expired
                if (hoursPassed < intervalLimit && bgConfig.value) {
                    document.body.style.backgroundImage = `url('${bgConfig.value}')`;
                }
            } else if (bgConfig.value) {
                document.body.style.backgroundImage = `url('${bgConfig.value}')`;
            } else {
                document.body.style.backgroundImage = `url('${defaultBg}')`;
            }
        });
    }
})();

// --- Time & Greeting Logic ---
function updateDashboard() {
    const now = new Date();
    let hours24 = now.getHours();
    let minutes = now.getMinutes();
    let clockText;

    if (clockFormat === '12') {
        const ampm = hours24 >= 12 ? 'PM' : 'AM';
        let hours12 = hours24 % 12 || 12;
        const mm = minutes < 10 ? '0' + minutes : minutes;
        clockText = `${hours12}:${mm} ${ampm}`;
    } else {
        const hh = hours24 < 10 ? '0' + hours24 : hours24;
        const mm = minutes < 10 ? '0' + minutes : minutes;
        clockText = `${hh}:${mm}`;
    }

    document.getElementById('clock').textContent = clockText;

    let greeting = "Good evening";
    if (hours24 < 12) {
        greeting = "Good morning";
    } else if (hours24 < 18) {
        greeting = "Good afternoon";
    }
    document.getElementById('greeting').textContent = greeting;
}
updateDashboard();
setInterval(updateDashboard, 1000);


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

    let icon = "☀️";
    let desc = "Clear Skies";

    if (code === 0) { icon = "☀️"; desc = "Clear sky"; }
    else if (code >= 1 && code <= 3) { icon = "⛅"; desc = "Partly Cloudy"; }
    else if (code === 45 || code === 48) { icon = "🌫️"; desc = "Foggy"; }
    else if (code >= 51 && code <= 55) { icon = "🌧️"; desc = "Drizzle"; }
    else if (code >= 61 && code <= 65) { icon = "🌧️"; desc = "Rainy"; }
    else if (code >= 71 && code <= 75) { icon = "❄️"; desc = "Snowy"; }
    else if (code >= 80 && code <= 82) { icon = "🌦️"; desc = "Rain Showers"; }
    else if (code >= 95) { icon = "⛈️"; desc = "Thunderstorm"; }

    iconEl.textContent = icon;
    tempEl.textContent = `${temp}°C`;
    descEl.textContent = desc;
}

function initExtension() {
    initWeather();

    if (chrome && chrome.storage && chrome.storage.local) {
        chrome.storage.local.get(['myShortcuts', 'bgSetting', 'blurSetting', 'darknessSetting', 'darkTextSetting', 'clockFormatSetting'], function(result) {
            let shortcuts = result.myShortcuts;
            if (!shortcuts) {
                shortcuts = defaultShortcuts;
                chrome.storage.local.set({ myShortcuts: shortcuts });
            }
            renderShortcuts(shortcuts);
            renderManageList(shortcuts);

            // Wallpaper UI syncing
            let bgConfig = result.bgSetting || { type: 'default', value: defaultBg, interval: '1', lastUpdated: 0 };
            bgTypeSelect.value = bgConfig.type;
            if (bgConfig.interval) bgIntervalSelect.value = bgConfig.interval;
            
            updateBgSettingsUI(bgConfig.type, bgConfig.value);
            
            if (bgConfig.type === 'rotation') {
                handleRotationCheck(bgConfig);
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
            document.documentElement.style.setProperty('--glass-darkness', storedDarkness / 100);

            // Dark Text Mode setup
            let storedDarkText = result.darkTextSetting || false;
            applyDarkTextMode(storedDarkText);
            darkTextToggle.checked = storedDarkText;

            // Clock Format setup
            clockFormat = result.clockFormatSetting || '24';
            document.getElementById('clock-format-select').value = clockFormat;
            updateDashboard();
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
        
        const faviconUrl = `https://www.google.com/s2/favicons?domain=${item.url}&sz=64`;
        
        const iconWrapper = document.createElement('div');
        iconWrapper.className = 'icon-wrapper';
        
        const img = document.createElement('img');
        img.src = faviconUrl;
        img.alt = item.name;
        img.onerror = function() {
            this.src = 'https://www.google.com/s2/favicons?domain=example.com&sz=64';
        };
        
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
            initExtension();
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
        
        const span = document.createElement('span');
        span.textContent = item.name;
        
        const btn = document.createElement('button');
        btn.className = 'delete-btn';
        btn.setAttribute('data-index', index);
        btn.textContent = 'Delete';
        
        div.appendChild(span);
        div.appendChild(btn);

        // --- Settings Elements Drag Operations ---
        div.addEventListener('dragstart', function(e) {
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

    document.querySelectorAll('.manage-item .delete-btn').forEach(btn => {
        btn.addEventListener('click', function(e) {
            e.stopPropagation(); 
            const indexToRemove = parseInt(this.getAttribute('data-index'));
            removeShortcut(indexToRemove);
        });
    });
}

addShortcutForm.addEventListener('submit', function(e) {
    e.preventDefault();
    const nameInput = document.getElementById('site-name');
    const urlInput = document.getElementById('site-url');
    let url = urlInput.value.trim();
    if (!/^https?:\/\//i.test(url)) url = 'https://' + url;

    chrome.storage.local.get(['myShortcuts'], function(result) {
        const shortcuts = result.myShortcuts || [];
        shortcuts.push({ name: nameInput.value.trim(), url: url });
        chrome.storage.local.set({ myShortcuts: shortcuts }, function() {
            initExtension();
            nameInput.value = '';
            urlInput.value = '';
        });
    });
});

function removeShortcut(index) {
    chrome.storage.local.get(['myShortcuts'], function(result) {
        let shortcuts = result.myShortcuts || [];
        shortcuts.splice(index, 1);
        chrome.storage.local.set({ myShortcuts: shortcuts }, function() {
            initExtension();
        });
    });
}

// --- Wallpaper Customization Logic ---
bgTypeSelect.addEventListener('change', function() {
    const selectedType = this.value;
    updateBgSettingsUI(selectedType, '');
    
    if (selectedType === 'default') {
        const bgConfig = { type: 'default', value: defaultBg, interval: '1', lastUpdated: 0 };
        chrome.storage.local.set({ bgSetting: bgConfig }, function() {
            applyWallpaper(defaultBg);
        });
    } else if (selectedType === 'rotation') {
        // Trigger instantly when clicking/choosing this option manually
        triggerNewUnsplashRotation(bgIntervalSelect.value);
    }
});

bgIntervalSelect.addEventListener('change', function() {
    if (bgTypeSelect.value === 'rotation') {
        triggerNewUnsplashRotation(this.value);
    }
});

function updateBgSettingsUI(type, currentVal) {
    bgWebGroup.classList.add('hidden');
    bgLocalGroup.classList.add('hidden');
    bgRotationGroup.classList.add('hidden');

    if (type === 'web') {
        bgWebGroup.classList.remove('hidden');
        if (currentVal) bgUrlInput.value = currentVal;
    } else if (type === 'local') {
        bgLocalGroup.classList.remove('hidden');
    } else if (type === 'rotation') {
        bgRotationGroup.classList.remove('hidden');
    }
}

// Passive Verification: Evaluates only when a brand new tab instance loads up
function handleRotationCheck(bgConfig) {
    const now = Date.now();
    const hoursPassed = (now - bgConfig.lastUpdated) / (1000 * 60 * 60);
    const intervalLimit = parseInt(bgConfig.interval) || 1;

    // Checks time delta window threshold
    if (hoursPassed >= intervalLimit || !bgConfig.value) {
        triggerNewUnsplashRotation(bgConfig.interval);
    } else {
        applyWallpaper(bgConfig.value);
    }
}

// Fetches a new Picsum image, resolves the final stable URL via the /id/ API, then stores it
function triggerNewUnsplashRotation(intervalValue) {
    // Picsum has ~1000 images (IDs 0–999); pick one at random
    const randomId = Math.floor(Math.random() * 1000);

    // The /id/{id}/info endpoint returns metadata including a stable download_url
    fetch(`https://picsum.photos/id/${randomId}/info`)
        .then(response => {
            if (!response.ok) throw new Error('Picsum info fetch failed');
            return response.json();
        })
        .then(data => {
            // data.download_url is a fully-resolved, stable image URL — it will NOT redirect
            const stableUrl = `https://picsum.photos/id/${randomId}/1920/1080`;

            const bgConfig = {
                type: 'rotation',
                value: stableUrl,
                interval: intervalValue,
                lastUpdated: Date.now()
            };

            chrome.storage.local.set({ bgSetting: bgConfig }, function() {
                applyWallpaper(stableUrl);
            });
        })
        .catch(() => {
            // Fallback: try the next ID if this one doesn't exist
            const fallbackId = Math.floor(Math.random() * 1000);
            const fallbackUrl = `https://picsum.photos/id/${fallbackId}/1920/1080`;
            const bgConfig = {
                type: 'rotation',
                value: fallbackUrl,
                interval: intervalValue,
                lastUpdated: Date.now()
            };
            chrome.storage.local.set({ bgSetting: bgConfig }, function() {
                applyWallpaper(fallbackUrl);
            });
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

    const reader = new FileReader();
    reader.onload = function(event) {
        const base64String = event.target.result;
        const bgConfig = { type: 'local', value: base64String, interval: '1', lastUpdated: 0 };
        chrome.storage.local.set({ bgSetting: bgConfig }, function() {
            applyWallpaper(base64String);
        });
    };
    reader.readAsDataURL(file);
});

function applyWallpaper(imgValue) {
    if (imgValue) {
        document.body.style.backgroundImage = `url('${imgValue}')`;
    } else {
        document.body.style.backgroundImage = `url('${defaultBg}')`;
    }
}

// --- Blur Slider Runtime Interaction ---
blurSlider.addEventListener('input', function() {
    const value = this.value;
    blurValueDisplay.textContent = `${value}px`;
    document.documentElement.style.setProperty('--blur-amount', `${value}px`);
    
    if (chrome && chrome.storage && chrome.storage.local) {
        chrome.storage.local.set({ blurSetting: parseInt(value) });
    }
});

// --- Reset Blur Button Listener ---
resetBlurBtn.addEventListener('click', function() {
    const defaultBlur = 25;
    blurSlider.value = defaultBlur;
    blurValueDisplay.textContent = `${defaultBlur}px`;
    document.documentElement.style.setProperty('--blur-amount', `${defaultBlur}px`);
    
    if (chrome && chrome.storage && chrome.storage.local) {
        chrome.storage.local.set({ blurSetting: defaultBlur });
    }
});

// --- Darkness Slider Runtime Interaction ---
darknessSlider.addEventListener('input', function() {
    const value = this.value;
    darknessValueDisplay.textContent = `${value}%`;
    document.documentElement.style.setProperty('--glass-darkness', value / 100);

    if (chrome && chrome.storage && chrome.storage.local) {
        chrome.storage.local.set({ darknessSetting: parseInt(value) });
    }
});

// --- Reset Darkness Button Listener ---
resetDarknessBtn.addEventListener('click', function() {
    const defaultDarkness = 0;
    darknessSlider.value = defaultDarkness;
    darknessValueDisplay.textContent = `${defaultDarkness}%`;
    document.documentElement.style.setProperty('--glass-darkness', defaultDarkness / 100);

    if (chrome && chrome.storage && chrome.storage.local) {
        chrome.storage.local.set({ darknessSetting: defaultDarkness });
    }
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

    if (chrome && chrome.storage && chrome.storage.local) {
        chrome.storage.local.set({ darkTextSetting: isDark });
    }
});

// --- Clock Format Toggle ---
document.getElementById('clock-format-select').addEventListener('change', function() {
    clockFormat = this.value;
    updateDashboard();
    if (chrome && chrome.storage && chrome.storage.local) {
        chrome.storage.local.set({ clockFormatSetting: clockFormat });
    }
});


settingsBtn.addEventListener('click', () => settingsModal.classList.add('active'));
closeModal.addEventListener('click', () => settingsModal.classList.remove('active'));
window.addEventListener('click', (e) => {
    if (e.target === settingsModal) settingsModal.classList.remove('active');
});

document.addEventListener('DOMContentLoaded', initExtension);