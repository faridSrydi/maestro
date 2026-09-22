/**
 * ==============================================================================
 * MAESTRO COOLER - CLIENT CONTROLLER ENGINE
 * Modern iOS Frost Theme Controller with Web Bluetooth API & Edge ML Integration
 * ==============================================================================
 */

'use strict';

// BLE UUID Configuration matching MaestroCooler.ino exactly
const BLE_CONFIG = {
  DEVICE_NAME: 'Maestro Cooler',
  SERVICE_UUID: '4fafc201-1fb5-459e-8fcc-c5c9c331914b',
  CHAR_COMMAND_UUID: 'beb5483e-36e1-4688-b7f5-ea07361b26a8',
  CHAR_TELEMETRY_UUID: 'beb5483f-36e1-4688-b7f5-ea07361b26a8'
};

// Application State
const AppState = {
  connected: false,
  device: null,
  server: null,
  commandChar: null,
  telemetryChar: null,
  
  // Theme mode ('light' | 'dark')
  theme: 'light',

  // Cooling & Fan state (Strictly 5, 9, 12. NO OFF MODE)
  activeMode: 12, // Hardware default on boot
  currentTemp: null,      // Cold plate (GPIO3)
  currentHotTemp: null,   // Heatsink hot side (GPIO1)
  coldTempRate: 0,
  hotTempRate: 0,
  coolingDuration: 0,
  previousColdTemp: null,
  previousHotTemp: null,

  // Historical min/max
  lowestTemp: null,
  highestTemp: null,
  lowestHotTemp: null,
  highestHotTemp: null,
  tempHistory: [],
  
  // Stopwatch live timer (Only runs when connected)
  coolingSeconds: 0,
  coolingTimerId: null,

  // AI mode state
  aiCoolingEnabled: false,
  lastAiDecision: null,

  // Hardware Specs
  HARDWARE: {
    FAN: {
      SWITCH_TYPE: 'AO3400 N-MOSFET (Low-Side)',
      PWM_FREQ: '25 kHz',
      PIN_PWM: 'GPIO5'
    },
    TEMPERATURE: {
      COLD_PIN: 'GPIO3 (ADC1_CH3)',
      HOT_PIN: 'GPIO1 (ADC1_CH1)',
      BETA_COEFFICIENT: '3950K',
      FIXED_RESISTOR: '10 kΩ 1% to GND'
    },
    BUTTON: {
      PIN: 'GPIO2',
      MODE: 'INPUT_PULLUP'
    },
    PELTIER: {
      SUPPLY: '12V Fixed DC'
    }
  }
};

/* ==============================================================================
 * 1. DOM ELEMENTS SELECTION
 * ============================================================================== */
const DOM = {
  // Header
  headerStatusDot: document.getElementById('headerStatusDot'),
  headerStatusText: document.getElementById('headerStatusText'),
  btnConnectionStatus: document.getElementById('btnConnectionStatus'),
  btnBleAction: document.getElementById('btnBleAction'),
  headerBleIcon: document.getElementById('headerBleIcon'),
  btnNotifications: document.getElementById('btnNotifications'),
  btnThemeToggle: document.getElementById('btnThemeToggle'),

  // Home Screen
  heroTempVal: document.getElementById('heroTempVal'),
  heroHotVal: document.getElementById('heroHotVal'),
  heroStatusPill: document.getElementById('heroStatusPill'),
  heroStatusPillText: document.getElementById('heroStatusPillText'),
  tempProgressBar: document.getElementById('tempProgressBar'),
  heroStabilityWrap: document.getElementById('heroStabilityWrap'),
  heroStabilityText: document.getElementById('heroStabilityText'),
  heroCoolerImg: document.getElementById('heroCoolerImg'),
  miniFanWrapper: document.getElementById('miniFanWrapper'),
  miniFanSvg: document.getElementById('miniFanSvg'),
  modeControlStateBadge: document.getElementById('modeControlStateBadge'),

  // Fan Tiles
  btnTile5: document.getElementById('btnTile5'),
  btnTile9: document.getElementById('btnTile9'),
  btnTile12: document.getElementById('btnTile12'),
  fanTiles: document.querySelectorAll('.fan-mode-tile'),

  // Home Chart & Stats
  homeChart: document.getElementById('homeTempChart'),
  chartLiveBadge: document.getElementById('chartLiveBadge'),
  quickLowestTemp: document.getElementById('quickLowestTemp'),
  quickCoolingTime: document.getElementById('quickCoolingTime'),

  // AI Toggle (Home)
  toggleAiCooling: document.getElementById('toggleAiCooling'),
  cardAiToggle: document.getElementById('cardAiToggle'),

  // Statistics Screen
  btnBackStats: document.getElementById('btnBackStats'),
  btnStatsHelp: document.getElementById('btnStatsHelp'),
  statsLowestVal: document.getElementById('statsLowestVal'),
  statsHighestVal: document.getElementById('statsHighestVal'),
  statsAverageVal: document.getElementById('statsAverageVal'),
  statsCoolingTimeVal: document.getElementById('statsCoolingTimeVal'),
  statsLowestHotVal: document.getElementById('statsLowestHotVal'),
  statsHighestHotVal: document.getElementById('statsHighestHotVal'),
  statsAverageHotVal: document.getElementById('statsAverageHotVal'),
  statsAiDurationBadge: document.getElementById('statsAiDurationBadge'),
  statsAiPct5: document.getElementById('statsAiPct5'),
  statsAiPct9: document.getElementById('statsAiPct9'),
  statsAiPct12: document.getElementById('statsAiPct12'),
  statsChart: document.getElementById('statsHistoryChart'),
  statsChartBadge: document.getElementById('statsChartBadge'),

  // AI Screen
  btnBackAi: document.getElementById('btnBackAi'),
  btnAiHelp: document.getElementById('btnAiHelp'),
  aiDecisionStatusPill: document.getElementById('aiDecisionStatusPill'),
  aiDecisionStatusText: document.getElementById('aiDecisionStatusText'),
  aiCurrentFanVal: document.getElementById('aiCurrentFanVal'),
  aiRecommendedFanVal: document.getElementById('aiRecommendedFanVal'),
  aiConfidenceVal: document.getElementById('aiConfidenceVal'),
  aiColdSideVal: document.getElementById('aiColdSideVal'),
  aiHotSideVal: document.getElementById('aiHotSideVal'),
  aiTrendVal: document.getElementById('aiTrendVal'),
  aiDecisionReason: document.getElementById('aiDecisionReason'),

  // Data Logger Controls (AI Screen)
  dataLoggerCount: document.getElementById('dataLoggerCount'),
  btnStartLogging: document.getElementById('btnStartLogging'),
  btnStopLogging: document.getElementById('btnStopLogging'),
  btnExportCsv: document.getElementById('btnExportCsv'),

  // Settings Screen
  settingsStatusVal: document.getElementById('settingsStatusVal'),
  btnSettingsBle: document.getElementById('btnSettingsBle'),
  toggleThemeSwitch: document.getElementById('toggleThemeSwitch'),
  settingsAiStatus: document.getElementById('settingsAiStatus'),
  settingsAiDataset: document.getElementById('settingsAiDataset'),
  settingsAiAccuracy: document.getElementById('settingsAiAccuracy'),

  // Bottom Navigation
  navTabs: document.querySelectorAll('.nav-tab-btn'),
  tabViews: document.querySelectorAll('.tab-view'),

  // Toast
  toast: document.getElementById('appToast'),
  toastMsg: document.getElementById('toastMsg'),
  toastIcon: document.getElementById('toastIcon'),

  // Onboarding Screen
  onboardingScreen: document.getElementById('onboardingScreen'),
  btnGetStarted: document.getElementById('btnGetStarted'),
  btnOnboardingSkip: document.getElementById('btnOnboardingSkip'),
  fanTransitionOverlay: document.getElementById('fanTransitionOverlay'),
  btnReplayOnboarding: document.getElementById('btnReplayOnboarding'),

  // PWA Install
  pwaInstallRow: document.getElementById('pwaInstallRow'),
  btnInstallPwa: document.getElementById('btnInstallPwa')
};

/* ==============================================================================
 * 2. INITIALIZATION & THEME SETUP
 * ============================================================================== */
function initApp() {
  setupThemeControls();
  setupNavigation();
  setupOnboarding();
  setupPwa();
  setupFanControls();
  setupAiControls();
  setupDataLoggerControls();
  setupBleControls();
  setupStatsFilterPills();
  resetDisconnectedUI();
  renderAllCharts();

  // Mode active tile indicator (12V default on boot)
  updateFanTileUI(AppState.activeMode);
  updateMiniFanSpeed();
  updateSettingsAiSpecs();
}

// Reset all live data displays to '-' when not connected
function resetDisconnectedUI() {
  if (DOM.heroTempVal) DOM.heroTempVal.textContent = '-';
  if (DOM.heroHotVal) DOM.heroHotVal.textContent = '-';
  if (DOM.heroStatusPillText) DOM.heroStatusPillText.textContent = 'Offline';
  if (DOM.heroStatusPill) DOM.heroStatusPill.classList.add('offline');
  if (DOM.tempProgressBar) DOM.tempProgressBar.style.width = '0%';
  if (DOM.heroStabilityText) DOM.heroStabilityText.textContent = 'Offline';
  if (DOM.heroStabilityWrap) DOM.heroStabilityWrap.classList.add('offline');

  if (DOM.quickLowestTemp) DOM.quickLowestTemp.textContent = '-';
  if (DOM.quickCoolingTime) DOM.quickCoolingTime.textContent = '-';

  if (DOM.statsLowestVal) DOM.statsLowestVal.textContent = '-';
  if (DOM.statsHighestVal) DOM.statsHighestVal.textContent = '-';
  if (DOM.statsAverageVal) DOM.statsAverageVal.textContent = '-';
  if (DOM.statsCoolingTimeVal) DOM.statsCoolingTimeVal.textContent = '-';
  if (DOM.statsLowestHotVal) DOM.statsLowestHotVal.textContent = '-';
  if (DOM.statsHighestHotVal) DOM.statsHighestHotVal.textContent = '-';
  if (DOM.statsAverageHotVal) DOM.statsAverageHotVal.textContent = '-';

  if (DOM.chartLiveBadge) DOM.chartLiveBadge.textContent = '-';
  if (DOM.statsChartBadge) DOM.statsChartBadge.textContent = '-';

  // AI Decision card reset
  if (DOM.aiColdSideVal) DOM.aiColdSideVal.textContent = '-';
  if (DOM.aiHotSideVal) DOM.aiHotSideVal.textContent = '-';
  if (DOM.aiTrendVal) DOM.aiTrendVal.textContent = '→ Stable';

  // Ensure mini fan is stationary
  if (DOM.miniFanWrapper) {
    DOM.miniFanWrapper.classList.remove('running');
    DOM.miniFanWrapper.classList.add('paused');
  }
  if (DOM.miniFanSvg) {
    DOM.miniFanSvg.style.animationPlayState = 'paused';
  }
}

/* ==============================================================================
 * 2.1 THEME MANAGEMENT (Light / Dark Mode)
 * ============================================================================== */
function setupThemeControls() {
  const savedTheme = localStorage.getItem('maestro_theme');
  const systemPrefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  const initialTheme = savedTheme ? savedTheme : (systemPrefersDark ? 'dark' : 'light');

  applyTheme(initialTheme, false);

  if (DOM.btnThemeToggle) {
    DOM.btnThemeToggle.addEventListener('click', () => {
      const nextTheme = AppState.theme === 'dark' ? 'light' : 'dark';
      applyTheme(nextTheme, true);
      showToast(nextTheme === 'dark' ? 'Dark Mode enabled' : 'Light Mode enabled');
    });
  }

  if (DOM.toggleThemeSwitch) {
    DOM.toggleThemeSwitch.addEventListener('change', (e) => {
      const nextTheme = e.target.checked ? 'dark' : 'light';
      applyTheme(nextTheme, true);
      showToast(nextTheme === 'dark' ? 'Dark Mode enabled' : 'Light Mode enabled');
    });
  }

  if (window.matchMedia) {
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
      if (!localStorage.getItem('maestro_theme')) {
        applyTheme(e.matches ? 'dark' : 'light', false);
      }
    });
  }
}

function applyTheme(theme, save = true) {
  AppState.theme = theme;
  document.documentElement.setAttribute('data-theme', theme);

  if (DOM.toggleThemeSwitch) {
    DOM.toggleThemeSwitch.checked = (theme === 'dark');
  }

  const metaThemeColor = document.querySelector('meta[name="theme-color"]');
  if (metaThemeColor) {
    metaThemeColor.setAttribute('content', theme === 'dark' ? '#080c14' : '#f2f5fb');
  }

  if (save) {
    localStorage.setItem('maestro_theme', theme);
  }

  renderAllCharts();
}

/* ==============================================================================
 * 2.2 ONBOARDING & FAN TRANSITION
 * ============================================================================== */
function setupOnboarding() {
  const onboarding = DOM.onboardingScreen || document.getElementById('onboardingScreen');
  const btnStart = DOM.btnGetStarted || document.getElementById('btnGetStarted');
  const btnSkip = DOM.btnOnboardingSkip || document.getElementById('btnOnboardingSkip');
  const overlay = DOM.fanTransitionOverlay || document.getElementById('fanTransitionOverlay');
  const btnReplay = DOM.btnReplayOnboarding || document.getElementById('btnReplayOnboarding');

  if (!onboarding) return;

  function handleExitOnboarding() {
    if (overlay) {
      overlay.classList.add('active');
    }

    // Spin fan with backdrop blur for ~1200ms
    setTimeout(() => {
      if (overlay) {
        overlay.classList.remove('active');
      }
      onboarding.classList.add('fade-out');

      setTimeout(() => {
        onboarding.classList.remove('visible', 'fade-out');
        onboarding.style.display = 'none';
        document.body.classList.remove('onboarding-open');
        localStorage.setItem('maestro_onboarded', 'true');
        renderAllCharts();
      }, 350);
    }, 1200);
  }

  if (btnStart) {
    btnStart.addEventListener('click', handleExitOnboarding);
  }
  if (btnSkip) {
    btnSkip.addEventListener('click', handleExitOnboarding);
  }

  if (btnReplay) {
    btnReplay.addEventListener('click', () => {
      showOnboardingScreen();
    });
  }

  checkOnboardingState();
}

function showOnboardingScreen() {
  const onboarding = DOM.onboardingScreen || document.getElementById('onboardingScreen');
  if (!onboarding) return;

  onboarding.style.display = 'flex';
  requestAnimationFrame(() => {
    onboarding.classList.remove('fade-out');
    onboarding.classList.add('visible');
    document.body.classList.add('onboarding-open');
  });
}

function checkOnboardingState() {
  const onboarding = DOM.onboardingScreen || document.getElementById('onboardingScreen');
  if (!onboarding) return;

  const urlParams = new URLSearchParams(window.location.search);
  const forceWelcome = urlParams.has('welcome') || urlParams.has('onboarding');
  const hasSeen = localStorage.getItem('maestro_onboarded');

  if (!hasSeen || forceWelcome) {
    showOnboardingScreen();
  } else {
    onboarding.classList.remove('visible');
    onboarding.style.display = 'none';
    document.body.classList.remove('onboarding-open');
  }
}

/* ==============================================================================
 * 2.3 PWA & SERVICE WORKER MANAGEMENT
 * ============================================================================== */
let deferredInstallPrompt = null;

function setupPwa() {
  // Register Service Worker for offline support & PWA caching
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js')
        .then((reg) => {
          console.log('PWA ServiceWorker registered with scope:', reg.scope);
        })
        .catch((err) => {
          console.warn('PWA ServiceWorker registration failed:', err);
        });
    });
  }

  // Intercept beforeinstallprompt for native Android install prompt
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredInstallPrompt = e;
    if (DOM.pwaInstallRow) {
      DOM.pwaInstallRow.style.display = 'flex';
    }
  });

  // Handle click on Settings > Mobile App (PWA) Install button
  if (DOM.btnInstallPwa) {
    DOM.btnInstallPwa.addEventListener('click', async () => {
      if (deferredInstallPrompt) {
        deferredInstallPrompt.prompt();
        const { outcome } = await deferredInstallPrompt.userChoice;
        if (outcome === 'accepted') {
          showToast('Installing Maestro Cooler app...');
        }
        deferredInstallPrompt = null;
      } else {
        const isIos = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
        if (isIos) {
          showToast('Tap Share (↑) then "Add to Home Screen"');
        } else {
          showToast('Tap browser menu (⋮) then "Install app"');
        }
      }
    });
  }

  // Listen for completed install
  window.addEventListener('appinstalled', () => {
    showToast('Maestro Cooler installed to home screen!');
    if (DOM.pwaInstallRow) {
      DOM.pwaInstallRow.style.display = 'none';
    }
  });
}

/* ==============================================================================
 * 3. NAVIGATION MANAGEMENT
 * ============================================================================== */
function setupNavigation() {
  DOM.navTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const targetViewId = tab.dataset.tab;
      switchView(targetViewId);
    });
  });

  if (DOM.btnBackStats) {
    DOM.btnBackStats.addEventListener('click', () => switchView('viewHome'));
  }
  if (DOM.btnBackAi) {
    DOM.btnBackAi.addEventListener('click', () => switchView('viewHome'));
  }

  if (DOM.btnStatsHelp) {
    DOM.btnStatsHelp.addEventListener('click', () => {
      showToast('Real-time thermal statistics and dual NTC history');
    });
  }

  if (DOM.btnAiHelp) {
    DOM.btnAiHelp.addEventListener('click', () => {
      showToast('AI Cooling dynamically optimizes fan voltage based on thermal rate');
    });
  }

  if (DOM.btnNotifications) {
    DOM.btnNotifications.addEventListener('click', () => {
      if (AppState.connected) {
        showToast('Maestro Cooler running optimally');
      } else {
        showToast('Status: Not connected to cooler');
      }
    });
  }
}

function setupStatsFilterPills() {
  const pills = document.querySelectorAll('.filter-pill');
  pills.forEach(pill => {
    pill.addEventListener('click', () => {
      pills.forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      const range = pill.dataset.range || '1d';
      AppState.statsRange = range;
      showToast(`Time Range: ${pill.textContent.trim()}`);
      renderStatsChart();
    });
  });
}

function switchView(viewId) {
  DOM.tabViews.forEach(v => v.classList.remove('active'));
  const targetView = document.getElementById(viewId);
  if (targetView) targetView.classList.add('active');

  DOM.navTabs.forEach(tab => {
    if (tab.dataset.tab === viewId) {
      tab.classList.add('active');
    } else {
      tab.classList.remove('active');
    }
  });

  if (viewId === 'viewHome') {
    setTimeout(renderHomeChart, 50);
  } else if (viewId === 'viewStats') {
    setTimeout(renderStatsChart, 50);
    updateAiStatisticsUI();
  } else if (viewId === 'viewSettings') {
    updateSettingsAiSpecs();
  }

  window.scrollTo({ top: 0, behavior: 'smooth' });
}

/* ==============================================================================
 * 4. FAN CONTROLS & DUAL-WAY FEEDBACK
 * ============================================================================== */
function setupFanControls() {
  DOM.fanTiles.forEach(tile => {
    tile.addEventListener('click', () => {
      // If user manually taps fan mode, notify if AI was active
      if (AppState.aiCoolingEnabled) {
        showToast('Notice: Manual control override while AI Cooling is active');
      }
      const mode = parseInt(tile.dataset.mode, 10);
      setFanMode(mode);
    });
  });
}

function setFanMode(mode) {
  if (![5, 9, 12].includes(mode)) return;

  AppState.activeMode = mode;
  updateFanTileUI(mode);
  updateMiniFanSpeed();

  if (DOM.aiCurrentFanVal) {
    DOM.aiCurrentFanVal.textContent = `${mode}V`;
  }

  const labels = {
    5: 'Fan mode: 5V (Silent)',
    9: 'Fan mode: 9V (Balanced)',
    12: 'Fan mode: 12V (Turbo)'
  };
  showToast(labels[mode] || `Fan mode: ${mode}V`);

  sendBleCommand(String(mode));
}

function updateFanTileUI(activeMode) {
  DOM.fanTiles.forEach(tile => {
    const tileMode = parseInt(tile.dataset.mode, 10);
    if (tileMode === activeMode) {
      tile.classList.add('active');
    } else {
      tile.classList.remove('active');
    }
  });
}

function updateMiniFanSpeed() {
  const wrapper = DOM.miniFanWrapper;
  const svg = DOM.miniFanSvg;
  if (!wrapper || !svg) return;

  if (!AppState.connected) {
    wrapper.classList.remove('running');
    wrapper.classList.add('paused');
    svg.style.animationPlayState = 'paused';
    return;
  }

  wrapper.classList.remove('paused');
  wrapper.classList.add('running');
  svg.style.animationPlayState = 'running';

  let duration = '0.32s';
  if (AppState.activeMode === 5) {
    duration = '1.3s';
  } else if (AppState.activeMode === 9) {
    duration = '0.65s';
  } else if (AppState.activeMode === 12) {
    duration = '0.32s';
  }

  svg.style.setProperty('--mini-fan-speed', duration);
  svg.style.animationDuration = duration;
}

/* ==============================================================================
 * 5. DUAL NTC TEMPERATURE & STATS UI UPDATES
 * ============================================================================== */
function updateDualTemperatureUI() {
  const cold = AppState.currentTemp;
  const hot = AppState.currentHotTemp;

  // Cold temperature hero
  if (DOM.heroTempVal && cold !== null) {
    DOM.heroTempVal.textContent = cold.toFixed(1);
  }

  // Hot temperature hero subrow
  if (DOM.heroHotVal && hot !== null) {
    DOM.heroHotVal.textContent = `${hot.toFixed(1)}°C`;
  }

  // Progress gauge based on Cold Plate
  if (DOM.tempProgressBar && cold !== null) {
    const clamped = Math.max(5, Math.min(35, cold));
    const percent = ((35 - clamped) / 30) * 85 + 10;
    DOM.tempProgressBar.style.width = `${percent.toFixed(0)}%`;
  }

  // Status pill
  if (DOM.heroStatusPill) DOM.heroStatusPill.classList.remove('offline');
  if (DOM.heroStatusPillText && cold !== null) {
    if (cold <= 15) {
      DOM.heroStatusPillText.textContent = 'Freezing';
    } else if (cold <= 22) {
      DOM.heroStatusPillText.textContent = 'Cooling';
    } else {
      DOM.heroStatusPillText.textContent = 'Normal';
    }
  }

  if (DOM.heroStabilityWrap) DOM.heroStabilityWrap.classList.remove('offline');
  if (DOM.heroStabilityText) DOM.heroStabilityText.textContent = 'Active';

  // Quick stats
  if (DOM.quickLowestTemp && AppState.lowestTemp !== null) {
    DOM.quickLowestTemp.textContent = `${AppState.lowestTemp.toFixed(1)}°C`;
  }

  // Statistics tab - Cold NTC
  if (DOM.statsLowestVal && AppState.lowestTemp !== null) DOM.statsLowestVal.textContent = `${AppState.lowestTemp.toFixed(1)}°C`;
  if (DOM.statsHighestVal && AppState.highestTemp !== null) DOM.statsHighestVal.textContent = `${AppState.highestTemp.toFixed(1)}°C`;
  
  if (AppState.tempHistory.length > 0 && DOM.statsAverageVal) {
    const sum = AppState.tempHistory.reduce((acc, p) => acc + p.temp, 0);
    const avg = sum / AppState.tempHistory.length;
    DOM.statsAverageVal.textContent = `${avg.toFixed(1)}°C`;
  }

  // Statistics tab - Hot NTC
  if (DOM.statsLowestHotVal && AppState.lowestHotTemp !== null) DOM.statsLowestHotVal.textContent = `${AppState.lowestHotTemp.toFixed(1)}°C`;
  if (DOM.statsHighestHotVal && AppState.highestHotTemp !== null) DOM.statsHighestHotVal.textContent = `${AppState.highestHotTemp.toFixed(1)}°C`;
  if (DOM.statsAverageHotVal && hot !== null) {
    const avgHot = (AppState.lowestHotTemp && AppState.highestHotTemp) ? ((AppState.lowestHotTemp + AppState.highestHotTemp) / 2) : hot;
    DOM.statsAverageHotVal.textContent = `${avgHot.toFixed(1)}°C`;
  }

  // Chart badge update
  if (DOM.chartLiveBadge && cold !== null) {
    DOM.chartLiveBadge.textContent = `${cold.toFixed(1)}°C`;
  }
  if (DOM.statsChartBadge && cold !== null) {
    DOM.statsChartBadge.textContent = `${cold.toFixed(1)}°C`;
  }

  // Add to history
  if (cold !== null) {
    AppState.tempHistory.push({
      timestamp: new Date(),
      temp: cold,
      hotTemp: hot !== null ? hot : cold + 15
    });

    if (AppState.tempHistory.length > 25) {
      AppState.tempHistory.shift();
    }
  }

  renderAllCharts();
}

/* ==============================================================================
 * 6. STOPWATCH LIVE TIMER
 * ============================================================================== */
function startCoolingTimer() {
  stopCoolingTimer();
  AppState.coolingSeconds = 0;
  updateCoolingTimeDisplay();

  AppState.coolingTimerId = setInterval(() => {
    if (!AppState.connected) return;
    AppState.coolingSeconds++;
    updateCoolingTimeDisplay();
  }, 1000);
}

function stopCoolingTimer() {
  if (AppState.coolingTimerId) {
    clearInterval(AppState.coolingTimerId);
    AppState.coolingTimerId = null;
  }
  AppState.coolingSeconds = 0;
  if (DOM.quickCoolingTime) DOM.quickCoolingTime.textContent = '-';
  if (DOM.statsCoolingTimeVal) DOM.statsCoolingTimeVal.textContent = '-';
}

function updateCoolingTimeDisplay() {
  if (!AppState.connected) {
    if (DOM.quickCoolingTime) DOM.quickCoolingTime.textContent = '-';
    if (DOM.statsCoolingTimeVal) DOM.statsCoolingTimeVal.textContent = '-';
    return;
  }

  const totalSec = AppState.coolingSeconds;
  const hours = Math.floor(totalSec / 3600);
  const minutes = Math.floor((totalSec % 3600) / 60);
  const seconds = totalSec % 60;

  let quickStr = '';
  if (hours > 0) {
    quickStr = `${hours}h ${minutes}m`;
  } else if (minutes > 0) {
    quickStr = `${minutes}m ${seconds}s`;
  } else {
    quickStr = `${seconds}s`;
  }

  if (DOM.quickCoolingTime) DOM.quickCoolingTime.textContent = quickStr;
  if (DOM.statsCoolingTimeVal) DOM.statsCoolingTimeVal.textContent = quickStr;
}

/* ==============================================================================
 * 7. AI ENGINE CONTROLS & DATA LOGGER INTEGRATION
 * ============================================================================== */
function setupAiControls() {
  if (DOM.toggleAiCooling) {
    DOM.toggleAiCooling.addEventListener('change', (e) => {
      AppState.aiCoolingEnabled = e.target.checked;
      
      // Update mode control badge on Home screen
      if (DOM.modeControlStateBadge) {
        DOM.modeControlStateBadge.textContent = AppState.aiCoolingEnabled ? 'AI COOLING ACTIVE' : 'MANUAL';
        DOM.modeControlStateBadge.classList.toggle('ai-active', AppState.aiCoolingEnabled);
      }

      if (AppState.aiCoolingEnabled) {
        if (window.maestroAi) window.maestroAi.startSession();
        showToast('AI Cooling enabled (Random Forest Active)');
        processAiInferenceTick();
      } else {
        if (window.maestroAi) window.maestroAi.stopSession();
        showToast('Manual Mode enabled');
        if (DOM.aiDecisionStatusPill) {
          DOM.aiDecisionStatusPill.className = 'ai-status-pill';
          if (DOM.aiDecisionStatusText) DOM.aiDecisionStatusText.textContent = 'Manual Mode (AI Inactive)';
        }
      }
    });
  }
}

function setupDataLoggerControls() {
  const logger = window.thermalLogger;
  if (!logger) return;

  logger.onSampleLogged = (count) => {
    if (DOM.dataLoggerCount) DOM.dataLoggerCount.textContent = count;
    if (DOM.settingsAiDataset) DOM.settingsAiDataset.textContent = count;
  };

  if (DOM.btnStartLogging) {
    DOM.btnStartLogging.addEventListener('click', () => {
      logger.start();
      DOM.btnStartLogging.classList.add('recording');
      DOM.btnStartLogging.innerHTML = '<span class="btn-logger-dot"></span> Recording...';
      if (DOM.btnStopLogging) DOM.btnStopLogging.disabled = false;
      showToast('Data Collection started. Recording thermal telemetry.');
    });
  }

  if (DOM.btnStopLogging) {
    DOM.btnStopLogging.addEventListener('click', () => {
      logger.stop();
      if (DOM.btnStartLogging) {
        DOM.btnStartLogging.classList.remove('recording');
        DOM.btnStartLogging.innerHTML = '<span class="btn-logger-dot"></span> Start Logging';
      }
      DOM.btnStopLogging.disabled = true;
      showToast(`Recording stopped. Total ${logger.getSampleCount()} samples ready for export.`);
    });
  }

  if (DOM.btnExportCsv) {
    DOM.btnExportCsv.addEventListener('click', async () => {
      const ok = await logger.exportCsv();
      if (ok) {
        showToast('maestro_dataset.csv downloaded successfully ✓');
      }
    });
  }
}

function processAiInferenceTick() {
  const ai = window.maestroAi;
  if (!ai) return;

  const cold = AppState.currentTemp;
  const hot = AppState.currentHotTemp !== null ? AppState.currentHotTemp : (cold !== null ? cold + 15 : null);

  const telemetry = {
    coldTemp: cold,
    hotTemp: hot,
    coldTempRate: AppState.coldTempRate,
    hotTempRate: AppState.hotTempRate,
    fanMode: AppState.activeMode,
    coolingDuration: AppState.coolingDuration || AppState.coolingSeconds,
    previousColdTemp: AppState.previousColdTemp || cold,
    previousHotTemp: AppState.previousHotTemp || hot
  };

  // Temperature trend
  let trendText = '→ Stable';
  if (AppState.coldTempRate > 0.25 || AppState.hotTempRate > 0.25) {
    trendText = '↑ Rising';
  } else if (AppState.coldTempRate < -0.25 || AppState.hotTempRate < -0.25) {
    trendText = '↓ Falling';
  }

  // Update AI Screen Telemetry Row
  if (DOM.aiColdSideVal && cold !== null) DOM.aiColdSideVal.textContent = `${cold.toFixed(1)}°C`;
  if (DOM.aiHotSideVal && hot !== null) DOM.aiHotSideVal.textContent = `${hot.toFixed(1)}°C`;
  if (DOM.aiTrendVal) DOM.aiTrendVal.textContent = trendText;
  if (DOM.aiCurrentFanVal) DOM.aiCurrentFanVal.textContent = `${AppState.activeMode}V`;

  // Check model training status (STRICT INTEGRITY: NO FAKE PREDICTIONS)
  if (!ai.isModelLoaded) {
    if (DOM.aiDecisionStatusPill) {
      DOM.aiDecisionStatusPill.className = 'ai-status-pill untrained';
      if (DOM.aiDecisionStatusText) DOM.aiDecisionStatusText.textContent = 'Model Not Trained';
    }
    if (DOM.aiRecommendedFanVal) DOM.aiRecommendedFanVal.textContent = '--';
    if (DOM.aiConfidenceVal) DOM.aiConfidenceVal.textContent = '--';
    if (DOM.aiDecisionReason) {
      DOM.aiDecisionReason.textContent = 'Model Random Forest belum dilatih. Kumpulkan data nyata melalui panel Data Collection di bawah untuk melatih model.';
    }
    return;
  }

  // Model is trained! Run inference:
  const prediction = ai.predictFanMode(telemetry);
  if (!prediction) return;

  AppState.lastAiDecision = prediction;

  if (DOM.aiRecommendedFanVal) DOM.aiRecommendedFanVal.textContent = `${prediction.mode}V`;
  if (DOM.aiConfidenceVal) DOM.aiConfidenceVal.textContent = `${prediction.confidence}%`;
  if (DOM.aiDecisionReason) DOM.aiDecisionReason.textContent = prediction.reason;

  if (AppState.aiCoolingEnabled) {
    if (DOM.aiDecisionStatusPill) {
      DOM.aiDecisionStatusPill.className = 'ai-status-pill active';
      if (DOM.aiDecisionStatusText) DOM.aiDecisionStatusText.textContent = '● AI Cooling Active';
    }

    // Anti-oscillation filter (hold-down timer + consecutive confirmation)
    const targetMode = ai.filterAndStabilizeDecision(prediction, AppState.activeMode);
    if (targetMode && targetMode !== AppState.activeMode) {
      console.log(`[Maestro AI] Changing fan mode to ${targetMode}V (Confidence: ${prediction.confidence}%)`);
      setFanMode(targetMode);
      showToast(`AI Decision: ${targetMode}V (Confidence: ${prediction.confidence}%)`);
    }
  } else {
    if (DOM.aiDecisionStatusPill) {
      DOM.aiDecisionStatusPill.className = 'ai-status-pill';
      if (DOM.aiDecisionStatusText) DOM.aiDecisionStatusText.textContent = 'Manual Mode (AI Inactive)';
    }
  }

  updateAiStatisticsUI();
}

function updateAiStatisticsUI() {
  const ai = window.maestroAi;
  if (!ai) return;

  const stats = ai.getSessionStatistics();
  if (DOM.statsAiDurationBadge) DOM.statsAiDurationBadge.textContent = `${stats.durationMinutes} min active`;
  if (DOM.statsAiPct5) DOM.statsAiPct5.textContent = stats.totalDecisions > 0 ? `${stats.pct5}%` : '-';
  if (DOM.statsAiPct9) DOM.statsAiPct9.textContent = stats.totalDecisions > 0 ? `${stats.pct9}%` : '-';
  if (DOM.statsAiPct12) DOM.statsAiPct12.textContent = stats.totalDecisions > 0 ? `${stats.pct12}%` : '-';
}

function updateSettingsAiSpecs() {
  const ai = window.maestroAi;
  if (!ai) return;

  if (DOM.settingsAiStatus) DOM.settingsAiStatus.textContent = ai.modelStatus;
  if (DOM.settingsAiAccuracy) DOM.settingsAiAccuracy.textContent = ai.modelMetadata.accuracy !== null ? `${ai.modelMetadata.accuracy}%` : '--';
  if (DOM.settingsAiDataset) {
    const count = (window.thermalLogger && window.thermalLogger.getSampleCount()) || ai.modelMetadata.datasetSamples || 0;
    DOM.settingsAiDataset.textContent = count;
  }
}

/* ==============================================================================
 * 8. REAL-TIME CANVAS CHARTS
 * ============================================================================== */
function renderAllCharts() {
  renderHomeChart();
  renderStatsChart();
}

function renderHomeChart() {
  const canvas = DOM.homeChart;
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();

  if (rect.width === 0 || rect.height === 0) return;

  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;
  ctx.scale(dpr, dpr);

  const w = rect.width;
  const h = rect.height;

  ctx.clearRect(0, 0, w, h);

  const padLeft = 36;
  const padRight = 18;
  const padTop = 16;
  const padBottom = 26;
  const plotW = w - padLeft - padRight;
  const plotH = h - padTop - padBottom;

  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  const gridColor = isDark ? 'rgba(255, 255, 255, 0.08)' : '#f1f5f9';
  const labelColor = isDark ? '#64748b' : '#94a3b8';
  const standbyLineColor = isDark ? 'rgba(255, 255, 255, 0.12)' : '#e2e8f0';
  const lineColor = isDark ? '#38bdf8' : '#0066ff';
  const dotColor = isDark ? '#38bdf8' : '#0066ff';
  const areaTopColor = isDark ? 'rgba(56, 189, 248, 0.25)' : 'rgba(0, 102, 255, 0.22)';

  const data = AppState.tempHistory;

  if (!AppState.connected || data.length < 2) {
    const minTemp = 10;
    const maxTemp = 30;

    ctx.strokeStyle = gridColor;
    ctx.lineWidth = 1;
    ctx.fillStyle = labelColor;
    ctx.font = '500 10px Outfit, sans-serif';
    ctx.textAlign = 'right';

    const gridLines = [30, 20, 10];
    gridLines.forEach(val => {
      const y = padTop + (1 - (val - minTemp) / (maxTemp - minTemp)) * plotH;
      ctx.beginPath();
      ctx.moveTo(padLeft, y);
      ctx.lineTo(w - padRight, y);
      ctx.stroke();
      ctx.fillText(`${val}°C`, padLeft - 6, y + 3.5);
    });

    ctx.beginPath();
    ctx.setLineDash([4, 4]);
    ctx.strokeStyle = standbyLineColor;
    ctx.lineWidth = 1.5;
    const midY = padTop + plotH * 0.5;
    ctx.moveTo(padLeft, midY);
    ctx.lineTo(w - padRight, midY);
    ctx.stroke();
    ctx.setLineDash([]);

    // Bottom horizontal axis time labels (HH:mm)
    ctx.fillStyle = labelColor;
    ctx.font = '500 10px Outfit, sans-serif';
    ctx.textAlign = 'center';
    const timeLabelCount = 5;
    const now = Date.now();
    for (let k = 0; k < timeLabelCount; k++) {
      const ratio = k / (timeLabelCount - 1);
      const x = padLeft + ratio * plotW;
      const d = new Date(now - (4 - k) * 60000);
      const hh = String(d.getHours()).padStart(2, '0');
      const mm = String(d.getMinutes()).padStart(2, '0');
      ctx.fillText(`${hh}:${mm}`, x, h - 7);
    }
    return;
  }

  // Dynamic range calculation
  const temps = data.map(d => d.temp);
  const rawMin = Math.min(...temps);
  const rawMax = Math.max(...temps);
  const spread = rawMax - rawMin;

  let minTemp, maxTemp;
  if (spread < 0.6) {
    const center = (rawMin + rawMax) / 2;
    minTemp = Math.floor(center - 1.5);
    maxTemp = Math.ceil(center + 1.5);
  } else {
    minTemp = Math.floor(rawMin - 0.5);
    maxTemp = Math.ceil(rawMax + 0.5);
  }

  ctx.strokeStyle = gridColor;
  ctx.lineWidth = 1;
  ctx.fillStyle = labelColor;
  ctx.font = '500 10px Outfit, sans-serif';
  ctx.textAlign = 'right';

  const gridLineCount = 4;
  const stepVal = (maxTemp - minTemp) / (gridLineCount - 1);
  for (let s = 0; s < gridLineCount; s++) {
    const val = maxTemp - s * stepVal;
    const y = padTop + (1 - (val - minTemp) / (maxTemp - minTemp)) * plotH;
    ctx.beginPath();
    ctx.moveTo(padLeft, y);
    ctx.lineTo(w - padRight, y);
    ctx.stroke();

    const labelStr = Number.isInteger(val) ? `${val}°C` : `${val.toFixed(1)}°C`;
    ctx.fillText(labelStr, padLeft - 6, y + 3.5);
  }

  const points = data.map((d, i) => {
    const x = padLeft + (i / (data.length - 1)) * plotW;
    const norm = (d.temp - minTemp) / (maxTemp - minTemp);
    const clamped = Math.max(0, Math.min(1, norm));
    const y = padTop + (1 - clamped) * plotH;
    return { x, y, temp: d.temp };
  });

  // Area
  const areaGrad = ctx.createLinearGradient(0, padTop, 0, h - padBottom);
  areaGrad.addColorStop(0, areaTopColor);
  areaGrad.addColorStop(1, 'rgba(0, 102, 255, 0.00)');

  ctx.beginPath();
  ctx.moveTo(points[0].x, h - padBottom);
  ctx.lineTo(points[0].x, points[0].y);

  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i];
    const p1 = points[i + 1];
    const mx = (p0.x + p1.x) / 2;
    ctx.bezierCurveTo(mx, p0.y, mx, p1.y, p1.x, p1.y);
  }

  ctx.lineTo(points[points.length - 1].x, h - padBottom);
  ctx.closePath();
  ctx.fillStyle = areaGrad;
  ctx.fill();

  // Line
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i];
    const p1 = points[i + 1];
    const mx = (p0.x + p1.x) / 2;
    ctx.bezierCurveTo(mx, p0.y, mx, p1.y, p1.x, p1.y);
  }
  ctx.strokeStyle = lineColor;
  ctx.lineWidth = 2.5;
  ctx.stroke();

  // Last point
  const last = points[points.length - 1];
  ctx.beginPath();
  ctx.arc(last.x, last.y, 4.5, 0, Math.PI * 2);
  ctx.fillStyle = dotColor;
  ctx.fill();

  if (DOM.chartLiveBadge) {
    DOM.chartLiveBadge.textContent = `${last.temp.toFixed(1)}°C`;
    DOM.chartLiveBadge.style.left = `${Math.min(w - 70, last.x - 22)}px`;
    DOM.chartLiveBadge.style.top = `${Math.max(4, last.y - 28)}px`;
  }

  // Bottom horizontal axis time labels (HH:mm)
  ctx.fillStyle = labelColor;
  ctx.font = '500 10px Outfit, sans-serif';
  ctx.textAlign = 'center';

  const timeLabelCount = 5;
  for (let k = 0; k < timeLabelCount; k++) {
    const ratio = k / (timeLabelCount - 1);
    const x = padLeft + ratio * plotW;
    const idx = Math.min(data.length - 1, Math.round(ratio * (data.length - 1)));
    const entry = data[idx];
    const d = entry && entry.timestamp ? new Date(entry.timestamp) : new Date();
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    ctx.fillText(`${hh}:${mm}`, x, h - 7);
  }
}

function renderStatsChart() {
  const canvas = DOM.statsChart;
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();

  if (rect.width === 0 || rect.height === 0) return;

  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;
  ctx.scale(dpr, dpr);

  const w = rect.width;
  const h = rect.height;

  ctx.clearRect(0, 0, w, h);

  const padLeft = 36;
  const padRight = 18;
  const padTop = 16;
  const padBottom = 24;
  const plotW = w - padLeft - padRight;
  const plotH = h - padTop - padBottom;

  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  const gridColor = isDark ? 'rgba(255, 255, 255, 0.08)' : '#f1f5f9';
  const labelColor = isDark ? '#64748b' : '#94a3b8';
  const standbyLineColor = isDark ? 'rgba(255, 255, 255, 0.12)' : '#e2e8f0';
  const lineColor = isDark ? '#38bdf8' : '#0066ff';
  const dotColor = isDark ? '#38bdf8' : '#0066ff';
  const areaTopColor = isDark ? 'rgba(56, 189, 248, 0.25)' : 'rgba(0, 102, 255, 0.22)';

  const data = AppState.tempHistory;

  if (!AppState.connected || data.length < 2) {
    const minTemp = 10;
    const maxTemp = 30;

    ctx.strokeStyle = gridColor;
    ctx.lineWidth = 1;
    ctx.fillStyle = labelColor;
    ctx.font = '500 10px Outfit, sans-serif';
    ctx.textAlign = 'right';

    [30, 20, 10].forEach(val => {
      const y = padTop + (1 - (val - minTemp) / (maxTemp - minTemp)) * plotH;
      ctx.beginPath();
      ctx.moveTo(padLeft, y);
      ctx.lineTo(w - padRight, y);
      ctx.stroke();
      ctx.fillText(`${val}°C`, padLeft - 6, y + 3.5);
    });

    ctx.beginPath();
    ctx.setLineDash([4, 4]);
    ctx.strokeStyle = standbyLineColor;
    ctx.lineWidth = 1.5;
    const midY = padTop + plotH * 0.5;
    ctx.moveTo(padLeft, midY);
    ctx.lineTo(w - padRight, midY);
    ctx.stroke();
    ctx.setLineDash([]);

    // Bottom horizontal axis time labels (HH:mm)
    ctx.fillStyle = labelColor;
    ctx.font = '500 10px Outfit, sans-serif';
    ctx.textAlign = 'center';
    const timeLabelCount = 5;
    const now = Date.now();
    for (let k = 0; k < timeLabelCount; k++) {
      const ratio = k / (timeLabelCount - 1);
      const x = padLeft + ratio * plotW;
      const d = new Date(now - (4 - k) * 60000);
      const hh = String(d.getHours()).padStart(2, '0');
      const mm = String(d.getMinutes()).padStart(2, '0');
      ctx.fillText(`${hh}:${mm}`, x, h - 7);
    }
    return;
  }

  const temps = data.map(d => d.temp);
  const rawMin = Math.min(...temps);
  const rawMax = Math.max(...temps);
  const spread = rawMax - rawMin;

  let minTemp, maxTemp;
  if (spread < 0.6) {
    const center = (rawMin + rawMax) / 2;
    minTemp = Math.floor(center - 1.5);
    maxTemp = Math.ceil(center + 1.5);
  } else {
    minTemp = Math.floor(rawMin - 0.5);
    maxTemp = Math.ceil(rawMax + 0.5);
  }

  ctx.strokeStyle = gridColor;
  ctx.lineWidth = 1;
  ctx.fillStyle = labelColor;
  ctx.font = '500 10px Outfit, sans-serif';
  ctx.textAlign = 'right';

  const gridLineCount = 4;
  const stepVal = (maxTemp - minTemp) / (gridLineCount - 1);
  for (let s = 0; s < gridLineCount; s++) {
    const val = maxTemp - s * stepVal;
    const y = padTop + (1 - (val - minTemp) / (maxTemp - minTemp)) * plotH;
    ctx.beginPath();
    ctx.moveTo(padLeft, y);
    ctx.lineTo(w - padRight, y);
    ctx.stroke();

    const labelStr = Number.isInteger(val) ? `${val}°C` : `${val.toFixed(1)}°C`;
    ctx.fillText(labelStr, padLeft - 6, y + 3.5);
  }

  const points = data.map((d, i) => {
    const x = padLeft + (i / (data.length - 1)) * plotW;
    const norm = (d.temp - minTemp) / (maxTemp - minTemp);
    const clamped = Math.max(0, Math.min(1, norm));
    const y = padTop + (1 - clamped) * plotH;
    return { x, y, temp: d.temp };
  });

  const areaGrad = ctx.createLinearGradient(0, padTop, 0, h - padBottom);
  areaGrad.addColorStop(0, areaTopColor);
  areaGrad.addColorStop(1, 'rgba(0, 102, 255, 0.00)');

  ctx.beginPath();
  ctx.moveTo(points[0].x, h - padBottom);
  ctx.lineTo(points[0].x, points[0].y);

  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i];
    const p1 = points[i + 1];
    const mx = (p0.x + p1.x) / 2;
    ctx.bezierCurveTo(mx, p0.y, mx, p1.y, p1.x, p1.y);
  }

  ctx.lineTo(points[points.length - 1].x, h - padBottom);
  ctx.closePath();
  ctx.fillStyle = areaGrad;
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i];
    const p1 = points[i + 1];
    const mx = (p0.x + p1.x) / 2;
    ctx.bezierCurveTo(mx, p0.y, mx, p1.y, p1.x, p1.y);
  }
  ctx.strokeStyle = lineColor;
  ctx.lineWidth = 2.5;
  ctx.stroke();

  const last = points[points.length - 1];
  ctx.beginPath();
  ctx.arc(last.x, last.y, 4.5, 0, Math.PI * 2);
  ctx.fillStyle = dotColor;
  ctx.fill();

  if (DOM.statsChartBadge) {
    DOM.statsChartBadge.textContent = `${last.temp.toFixed(1)}°C`;
    DOM.statsChartBadge.style.left = `${Math.min(w - 70, last.x - 22)}px`;
    DOM.statsChartBadge.style.top = `${Math.max(4, last.y - 28)}px`;
  }

  // Bottom horizontal axis time labels (HH:mm)
  ctx.fillStyle = labelColor;
  ctx.font = '500 10px Outfit, sans-serif';
  ctx.textAlign = 'center';

  const timeLabelCount = 5;
  for (let k = 0; k < timeLabelCount; k++) {
    const ratio = k / (timeLabelCount - 1);
    const x = padLeft + ratio * plotW;
    const idx = Math.min(data.length - 1, Math.round(ratio * (data.length - 1)));
    const entry = data[idx];
    const d = entry && entry.timestamp ? new Date(entry.timestamp) : new Date();
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    ctx.fillText(`${hh}:${mm}`, x, h - 7);
  }
}

/* ==============================================================================
 * 9. WEB BLUETOOTH API ENGINE
 * ============================================================================== */
function setupBleControls() {
  const triggerConnect = () => {
    if (AppState.connected) {
      disconnectBle();
    } else {
      connectBle();
    }
  };

  if (DOM.btnConnectionStatus) DOM.btnConnectionStatus.addEventListener('click', triggerConnect);
  if (DOM.btnBleAction) DOM.btnBleAction.addEventListener('click', triggerConnect);
  if (DOM.btnSettingsBle) DOM.btnSettingsBle.addEventListener('click', triggerConnect);
}

async function connectBle() {
  if (!navigator.bluetooth) {
    showToast('Web Bluetooth is not supported by this browser. Please use Chrome on Android/PC.');
    return;
  }

  try {
    showToast('Searching for Maestro Cooler...');

    const device = await navigator.bluetooth.requestDevice({
      filters: [
        { name: BLE_CONFIG.DEVICE_NAME },
        { namePrefix: 'Maestro' },
        { services: [BLE_CONFIG.SERVICE_UUID.toLowerCase()] }
      ],
      optionalServices: [BLE_CONFIG.SERVICE_UUID.toLowerCase()]
    });

    AppState.device = device;
    device.addEventListener('gattserverdisconnected', onBleDisconnected);

    const server = await device.gatt.connect();
    AppState.server = server;

    const service = await server.getPrimaryService(BLE_CONFIG.SERVICE_UUID.toLowerCase());

    // Command characteristic (Write)
    AppState.commandChar = await service.getCharacteristic(BLE_CONFIG.CHAR_COMMAND_UUID.toLowerCase());

    // Telemetry characteristic (Notify + Read)
    AppState.telemetryChar = await service.getCharacteristic(BLE_CONFIG.CHAR_TELEMETRY_UUID.toLowerCase());
    await AppState.telemetryChar.startNotifications();
    AppState.telemetryChar.addEventListener('characteristicvaluechanged', onTelemetryReceived);

    setBleConnectedState(true);
    showToast('Connected to Maestro Cooler ✓');

    // Read initial telemetry state immediately
    try {
      const initialData = await AppState.telemetryChar.readValue();
      onTelemetryReceived({ target: { value: initialData } });
    } catch (readErr) {
      console.log('Initial telemetry read skipped:', readErr);
    }

  } catch (error) {
    console.warn('Bluetooth connection error:', error);
    if (error.name === 'NotFoundError' && (error.message.includes('User cancelled') || error.message.includes('cancelled'))) {
      return;
    }
    showToast(`Connection failed: ${error.message}`);
  }
}

function disconnectBle() {
  if (AppState.device && AppState.device.gatt.connected) {
    AppState.device.gatt.disconnect();
  }
  setBleConnectedState(false);
  showToast('Bluetooth disconnected');
}

function onBleDisconnected() {
  setBleConnectedState(false);
  showToast('Cooler connection disconnected');
}

function setBleConnectedState(isConnected) {
  AppState.connected = isConnected;

  if (isConnected) {
    DOM.headerStatusDot.classList.add('connected');
    DOM.headerStatusText.textContent = 'Connected';
    DOM.headerStatusText.classList.add('connected');
    DOM.btnBleAction.classList.add('connected');

    if (DOM.settingsStatusVal) DOM.settingsStatusVal.textContent = 'Connected';
    if (DOM.btnSettingsBle) DOM.btnSettingsBle.textContent = 'Disconnect Maestro Cooler';

    startCoolingTimer();
    updateMiniFanSpeed();
  } else {
    DOM.headerStatusDot.classList.remove('connected');
    DOM.headerStatusText.textContent = 'Disconnected';
    DOM.headerStatusText.classList.remove('connected');
    DOM.btnBleAction.classList.remove('connected');

    if (DOM.settingsStatusVal) DOM.settingsStatusVal.textContent = 'Disconnected';
    if (DOM.btnSettingsBle) DOM.btnSettingsBle.textContent = 'Connect Maestro Cooler';

    stopCoolingTimer();
    AppState.currentTemp = null;
    AppState.currentHotTemp = null;
    AppState.lowestTemp = null;
    AppState.highestTemp = null;
    AppState.lowestHotTemp = null;
    AppState.highestHotTemp = null;
    AppState.tempHistory = [];
    resetDisconnectedUI();
    renderAllCharts();
    updateMiniFanSpeed();
  }
}

async function sendBleCommand(cmdString) {
  if (!AppState.connected || !AppState.commandChar) return;

  try {
    const encoder = new TextEncoder();
    const data = encoder.encode(cmdString);
    if (AppState.commandChar.writeValueWithoutResponse) {
      await AppState.commandChar.writeValueWithoutResponse(data);
    } else {
      await AppState.commandChar.writeValue(data);
    }
  } catch (err) {
    console.warn('Error sending BLE command:', err);
  }
}

/**
 * Handle incoming telemetry JSON from ESP32-C3
 */
function onTelemetryReceived(event) {
  const decoder = new TextDecoder();
  const raw = decoder.decode(event.target.value).trim();
  if (!raw) return;

  try {
    if (raw.startsWith('{') && raw.endsWith('}')) {
      const data = JSON.parse(raw);

      // 1. Cold Temperature (GPIO3)
      if (data.coldTemp !== null && data.coldTemp !== undefined) {
        const parsedCold = parseFloat(data.coldTemp);
        if (!isNaN(parsedCold) && parsedCold > -90) {
          AppState.currentTemp = parsedCold;
          if (AppState.lowestTemp === null || parsedCold < AppState.lowestTemp) AppState.lowestTemp = parsedCold;
          if (AppState.highestTemp === null || parsedCold > AppState.highestTemp) AppState.highestTemp = parsedCold;
        }
      }

      // 2. Hot Temperature (GPIO1)
      if (data.hotTemp !== null && data.hotTemp !== undefined) {
        const parsedHot = parseFloat(data.hotTemp);
        if (!isNaN(parsedHot) && parsedHot > -90) {
          AppState.currentHotTemp = parsedHot;
          if (AppState.lowestHotTemp === null || parsedHot < AppState.lowestHotTemp) AppState.lowestHotTemp = parsedHot;
          if (AppState.highestHotTemp === null || parsedHot > AppState.highestHotTemp) AppState.highestHotTemp = parsedHot;
        }
      } else if (AppState.currentTemp !== null) {
        // Fallback hot temperature estimate if sensor not yet plugged in
        AppState.currentHotTemp = Number((AppState.currentTemp + 15.0).toFixed(1));
      }

      // 3. Thermal rates & session data
      if (data.coldTempRate !== undefined) AppState.coldTempRate = parseFloat(data.coldTempRate) || 0;
      if (data.hotTempRate !== undefined) AppState.hotTempRate = parseFloat(data.hotTempRate) || 0;
      if (data.coolingDuration !== undefined) AppState.coolingDuration = parseInt(data.coolingDuration, 10) || 0;
      if (data.previousColdTemp !== undefined) AppState.previousColdTemp = parseFloat(data.previousColdTemp);
      if (data.previousHotTemp !== undefined) AppState.previousHotTemp = parseFloat(data.previousHotTemp);

      // 4. Fan Mode update
      if (data.fanMode) {
        const parsedMode = parseInt(data.fanMode, 10);
        if ([5, 9, 12].includes(parsedMode) && parsedMode !== AppState.activeMode) {
          AppState.activeMode = parsedMode;
          updateFanTileUI(parsedMode);
          updateMiniFanSpeed();
          const labels = {
            5: 'Fan mode: 5V (Silent)',
            9: 'Fan mode: 9V (Balanced)',
            12: 'Fan mode: 12V (Turbo)'
          };
          showToast(labels[parsedMode] || `Fan mode: ${parsedMode}V`);
        }
      }

      // 5. Update UI
      updateDualTemperatureUI();

      // 6. Log sample if Data Collection is active
      if (window.thermalLogger && window.thermalLogger.isRecording) {
        window.thermalLogger.logSample({
          coldTemp: AppState.currentTemp,
          hotTemp: AppState.currentHotTemp,
          coldTempRate: AppState.coldTempRate,
          hotTempRate: AppState.hotTempRate,
          fanMode: AppState.activeMode,
          coolingDuration: AppState.coolingDuration || AppState.coolingSeconds,
          previousColdTemp: AppState.previousColdTemp,
          previousHotTemp: AppState.previousHotTemp
        });
      }

      // 7. Trigger AI decision processing
      processAiInferenceTick();

      return;
    }
  } catch (err) {
    console.warn('Telemetry JSON parse error:', err, 'Raw:', raw);
  }
}

/* ==============================================================================
 * 10. TOAST POPUP HELPER
 * ============================================================================== */
let toastTimeout = null;
function showToast(message) {
  if (!DOM.toast || !DOM.toastMsg) return;

  DOM.toastMsg.textContent = message;
  DOM.toast.classList.add('show');

  if (toastTimeout) clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => {
    DOM.toast.classList.remove('show');
  }, 2400);
}

/* ==============================================================================
 * START APPLICATION
 * ============================================================================== */
window.addEventListener('DOMContentLoaded', () => {
  initApp();
});

window.addEventListener('resize', () => {
  renderAllCharts();
});

// Expose MaestroCooler API on window for testing & debugging
window.MaestroCooler = {
  AppState,
  connectBle,
  disconnectBle,
  setBleConnectedState,
  sendBleCommand,
  setFanMode,
  processAiInferenceTick,
  simulateTelemetry: (coldTemp = 18.4, hotTemp = 42.0, mode = 9) => {
    setBleConnectedState(true);
    onTelemetryReceived({
      target: {
        value: new TextEncoder().encode(JSON.stringify({
          coldTemp: coldTemp,
          hotTemp: hotTemp,
          coldTempRate: 0.8,
          hotTempRate: 0.5,
          fanMode: mode,
          coolingDuration: 120,
          previousColdTemp: coldTemp - 0.5,
          previousHotTemp: hotTemp - 0.8
        }))
      }
    });
  },
  applyTheme,
  showOnboarding: showOnboardingScreen,
  resetOnboarding: () => {
    localStorage.removeItem('maestro_onboarded');
    showOnboardingScreen();
  }
};
