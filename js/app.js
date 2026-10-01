/**
 * ==============================================================================
 * MAESTRO COOLER - CLIENT CONTROLLER ENGINE (v2.0)
 * Modern iOS Frost Theme Controller with Web Bluetooth API,
 * Synchronized Stepped Voltage Slider, Adaptive AI Thermal Engine,
 * and Full Customizable WS2812B RGB Studio.
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

  // Voltage Mode (5V to 12V - Strictly NO OFF MODE, Minimum 5V)
  activeMode: 12, // Hardware default on boot
  controlMode: 'MANUAL', // 'AI' | 'MANUAL'
  fanPWM: 255,
  fanPct: 100,
  peltierPWM: 255,
  peltierState: 'DIRECT 12V',

  // Temperature sensors
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
  
  // Stopwatch live timer
  coolingSeconds: 0,
  coolingTimerId: null,

  // Adaptive AI State
  aiCoolingEnabled: true,
  thermalLoad: 0.50,
  aiRecommendation: 'MAINTAIN',
  safetyState: 'NORMAL',

  // RGB LED Studio State
  ledEffect: 'BREATH', // BREATH, SPIN, RAINBOW, STROBE, STATIC, AI, OFF
  ledColor: '#00f0ff',
  ledBrightness: 80, // %
  ledSpeed: 'normal', // slow, normal, fast
  ledSpeedMs: 2000
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

  // Home Screen - Hero
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

  // Voltage Mode Controls (Home)
  btnTile5: document.getElementById('btnTile5'),
  btnTile9: document.getElementById('btnTile9'),
  btnTile12: document.getElementById('btnTile12'),
  fanTiles: document.querySelectorAll('.fan-mode-tile'),
  speedLiveBadge: document.getElementById('speedLiveBadge'),
  speedLivePct: document.getElementById('speedLivePct'),
  sliderVoltageBadge: document.getElementById('sliderVoltageBadge'),
  steppedTrackWrap: document.getElementById('steppedTrackWrap'),
  steppedTrack: document.getElementById('steppedTrack'),
  steppedThumb: document.getElementById('steppedThumb'),
  steppedThumbBubble: document.getElementById('steppedThumbBubble'),
  steppedFill: document.getElementById('steppedFill'),
  tick5: document.getElementById('tick5'),
  tick9: document.getElementById('tick9'),
  tick12: document.getElementById('tick12'),

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
  statsChart: document.getElementById('statsHistoryChart'),
  statsChartBadge: document.getElementById('statsChartBadge'),

  // RGB Studio Screen (NEW)
  btnBackLed: document.getElementById('btnBackLed'),
  btnLedHelp: document.getElementById('btnLedHelp'),
  ledCurrentModeBadge: document.getElementById('ledCurrentModeBadge'),
  ledPreviewCaption: document.getElementById('ledPreviewCaption'),
  ledRingContainer: document.getElementById('ledRingContainer'),
  ledRingGlow: document.getElementById('ledRingGlow'),
  ledPixelBeads: document.querySelectorAll('.led-pixel-bead'),
  ledEffectTiles: document.querySelectorAll('.led-effect-tile'),
  ledColorCard: document.getElementById('ledColorCard'),
  ledNativeColorPicker: document.getElementById('ledNativeColorPicker'),
  ledColorHexTag: document.getElementById('ledColorHexTag'),
  colorSwatches: document.querySelectorAll('.color-swatch-btn'),
  ledBrightnessSlider: document.getElementById('ledBrightnessSlider'),
  ledBrightnessVal: document.getElementById('ledBrightnessVal'),
  speedPills: document.querySelectorAll('.speed-pill'),
  ledSpeedVal: document.getElementById('ledSpeedVal'),

  // Adaptive AI Screen
  btnBackAi: document.getElementById('btnBackAi'),
  btnAiHelp: document.getElementById('btnAiHelp'),
  aiDecisionStatusPill: document.getElementById('aiDecisionStatusPill'),
  aiDecisionStatusText: document.getElementById('aiDecisionStatusText'),
  aiGaugeFill: document.getElementById('aiGaugeFill'),
  aiThermalLoadVal: document.getElementById('aiThermalLoadVal'),
  aiActionVal: document.getElementById('aiActionVal'),
  aiColdRateVal: document.getElementById('aiColdRateVal'),
  aiTrendPill: document.getElementById('aiTrendPill'),
  aiActuationVal: document.getElementById('aiActuationVal'),
  safetyStatusPill: document.getElementById('safetyStatusPill'),
  safetyStatusPillText: document.getElementById('safetyStatusPillText'),
  aiDecisionReason: document.getElementById('aiDecisionReason'),

  // Settings Screen
  settingsStatusVal: document.getElementById('settingsStatusVal'),
  btnSettingsBle: document.getElementById('btnSettingsBle'),
  toggleThemeSwitch: document.getElementById('toggleThemeSwitch'),

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
 * 2. INITIALIZATION
 * ============================================================================== */
function initApp() {
  setupThemeControls();
  setupNavigation();
  setupOnboarding();
  setupPwa();
  setupSynchronizedControls();
  setupLedStudio();
  setupAdaptiveAiControls();
  setupBleControls();
  setupStatsFilterPills();
  resetDisconnectedUI();
  renderAllCharts();

  // Initialize UI with 12V default
  updateSynchronizedModeUI(12);
  startLedRingAnimation();
}

function resetDisconnectedUI() {
  if (DOM.heroTempVal) DOM.heroTempVal.textContent = '-';
  if (DOM.heroHotVal) DOM.heroHotVal.textContent = '-';
  if (DOM.heroStatusPill) DOM.heroStatusPill.className = 'temp-status-pill offline';
  if (DOM.heroStatusPillText) DOM.heroStatusPillText.textContent = 'Offline';
  if (DOM.tempProgressBar) DOM.tempProgressBar.style.width = '0%';
  if (DOM.heroStabilityWrap) DOM.heroStabilityWrap.style.display = 'none';
  if (DOM.quickLowestTemp) DOM.quickLowestTemp.textContent = '-';
  if (DOM.quickCoolingTime) DOM.quickCoolingTime.textContent = '-';
  if (DOM.miniFanWrapper) {
    DOM.miniFanWrapper.classList.remove('running');
    DOM.miniFanWrapper.classList.add('paused');
  }
  if (DOM.miniFanSvg) {
    DOM.miniFanSvg.style.animationPlayState = 'paused';
  }
}

/* ==============================================================================
 * 2.1 THEME MANAGEMENT
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
 * 2.2 ONBOARDING
 * ============================================================================== */
function setupOnboarding() {
  const onboarding = DOM.onboardingScreen || document.getElementById('onboardingScreen');
  const btnStart = DOM.btnGetStarted || document.getElementById('btnGetStarted');
  const btnSkip = DOM.btnOnboardingSkip || document.getElementById('btnOnboardingSkip');
  const overlay = DOM.fanTransitionOverlay || document.getElementById('fanTransitionOverlay');
  const btnReplay = DOM.btnReplayOnboarding || document.getElementById('btnReplayOnboarding');

  if (!onboarding) return;

  function handleExitOnboarding() {
    if (overlay) overlay.classList.add('active');

    setTimeout(() => {
      if (overlay) overlay.classList.remove('active');
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

  if (btnStart) btnStart.addEventListener('click', handleExitOnboarding);
  if (btnSkip) btnSkip.addEventListener('click', handleExitOnboarding);
  if (btnReplay) btnReplay.addEventListener('click', () => showOnboardingScreen());

  checkOnboardingState();
}

function showOnboardingScreen() {
  const onboarding = DOM.onboardingScreen;
  if (!onboarding) return;
  onboarding.style.display = 'flex';
  requestAnimationFrame(() => {
    onboarding.classList.remove('fade-out');
    onboarding.classList.add('visible');
    document.body.classList.add('onboarding-open');
  });
}

function checkOnboardingState() {
  const onboarding = DOM.onboardingScreen;
  if (!onboarding) return;
  const hasSeen = localStorage.getItem('maestro_onboarded');
  if (!hasSeen) {
    showOnboardingScreen();
  } else {
    onboarding.classList.remove('visible');
    onboarding.style.display = 'none';
    document.body.classList.remove('onboarding-open');
  }
}

/* ==============================================================================
 * 2.3 PWA SETUP
 * ============================================================================== */
let deferredInstallPrompt = null;
function setupPwa() {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js').catch(() => {});
    });
  }

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredInstallPrompt = e;
    if (DOM.pwaInstallRow) DOM.pwaInstallRow.style.display = 'flex';
  });

  if (DOM.btnInstallPwa) {
    DOM.btnInstallPwa.addEventListener('click', async () => {
      if (deferredInstallPrompt) {
        deferredInstallPrompt.prompt();
        deferredInstallPrompt = null;
      } else {
        showToast('Tap browser menu (⋮) then "Install app"');
      }
    });
  }
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

  if (DOM.btnBackStats) DOM.btnBackStats.addEventListener('click', () => switchView('viewHome'));
  if (DOM.btnBackLed) DOM.btnBackLed.addEventListener('click', () => switchView('viewHome'));
  if (DOM.btnBackAi) DOM.btnBackAi.addEventListener('click', () => switchView('viewHome'));

  if (DOM.btnStatsHelp) {
    DOM.btnStatsHelp.addEventListener('click', () => {
      showToast('Real-time dual temperature telemetry & rate history');
    });
  }
  if (DOM.btnLedHelp) {
    DOM.btnLedHelp.addEventListener('click', () => {
      showToast('Kustomisasi warna, efek klip-klip, muter-muter & kecerahan WS2812B');
    });
  }
  if (DOM.btnAiHelp) {
    DOM.btnAiHelp.addEventListener('click', () => {
      showToast('Adaptive AI mendeteksi lonjakan panas tangan & HP seketika');
    });
  }
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
    setTimeout(() => {
      updateSynchronizedModeUI(AppState.activeMode);
      renderHomeChart();
    }, 50);
  } else if (viewId === 'viewStats') {
    setTimeout(renderStatsChart, 50);
  } else if (viewId === 'viewAi') {
    renderAdaptiveAiUI();
  }

  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function setupStatsFilterPills() {
  const pills = document.querySelectorAll('.filter-pill');
  pills.forEach(pill => {
    pill.addEventListener('click', () => {
      pills.forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      showToast(`Time Range: ${pill.textContent.trim()}`);
      renderStatsChart();
    });
  });
}

/* ==============================================================================
 * 4. FAN VOLTAGE & CONTINUOUS SPEED CONTROLS (5V TO 12V - MINIMUM 5V, NEVER 0)
 * ============================================================================== */
let isSliderDragging = false;
let lastBlePwmTime = 0;

function throttleSendBlePwm(pwm) {
  const now = Date.now();
  if (now - lastBlePwmTime >= 75) {
    lastBlePwmTime = now;
    sendBleCommand(`PWM:${pwm}`);
  }
}

function getPctFromRatio(ratio) {
  ratio = Math.max(0, Math.min(1, ratio));
  if (ratio <= 0.5) {
    const t = ratio / 0.5;
    return Math.round(15 + t * (50 - 15));
  } else {
    const t = (ratio - 0.5) / 0.5;
    return Math.round(50 + t * (100 - 50));
  }
}

function getRatioFromPct(pct) {
  pct = Math.max(15, Math.min(100, pct));
  if (pct <= 50) {
    const t = (pct - 15) / (50 - 15);
    return 0.5 * t;
  } else {
    const t = (pct - 50) / (100 - 50);
    return 0.5 + 0.5 * t;
  }
}

function setupSynchronizedControls() {
  // 1. Preset Tiles Direct Click
  DOM.fanTiles.forEach(tile => {
    tile.addEventListener('click', () => {
      const mode = parseInt(tile.dataset.mode, 10);
      setSynchronizedMode(mode);
    });
  });

  // 2. Responsive 1:1 Pointer/Touch Drag with Free Continuous Movement (Min 5V, Never 0)
  const trackWrap = DOM.steppedTrackWrap;
  if (trackWrap) {
    function getRatioFromEvent(e) {
      const rect = trackWrap.getBoundingClientRect();
      const startX = 18;
      const trackWidth = Math.max(10, rect.width - 36);
      const currentX = e.clientX - rect.left;
      let ratio = (currentX - startX) / trackWidth;
      return Math.max(0, Math.min(1, ratio));
    }

    function onPointerDown(e) {
      if (e.button && e.button !== 0) return;

      isSliderDragging = true;
      try { trackWrap.setPointerCapture(e.pointerId); } catch (_) {}

      if (DOM.steppedThumb) DOM.steppedThumb.classList.add('dragging');
      if (DOM.steppedFill) DOM.steppedFill.style.transition = 'none';
      if (DOM.steppedThumb) DOM.steppedThumb.style.transition = 'none';

      const ratio = getRatioFromEvent(e);
      updateVisualsFromRatio(ratio, true);
    }

    function onPointerMove(e) {
      if (!isSliderDragging) return;
      const ratio = getRatioFromEvent(e);
      updateVisualsFromRatio(ratio, true);
    }

    function onPointerUp(e) {
      if (!isSliderDragging) return;
      isSliderDragging = false;
      try { trackWrap.releasePointerCapture(e.pointerId); } catch (_) {}

      if (DOM.steppedThumb) DOM.steppedThumb.classList.remove('dragging');
      if (DOM.steppedFill) DOM.steppedFill.style.transition = 'width 0.15s ease-out';
      if (DOM.steppedThumb) DOM.steppedThumb.style.transition = 'left 0.15s ease-out';

      // Keep exact free position without snapping to 5/9/12!
      const finalRatio = getRatioFromEvent(e);
      const pct = updateVisualsFromRatio(finalRatio, false);
      const pwm = Math.max(35, Math.min(255, Math.round((pct / 100) * 255)));

      AppState.controlMode = 'MANUAL';
      if (DOM.toggleAiCooling) DOM.toggleAiCooling.checked = false;
      if (DOM.modeControlStateBadge) {
        DOM.modeControlStateBadge.textContent = 'MANUAL';
        DOM.modeControlStateBadge.classList.remove('ai-active');
      }

      sendBleCommand(`PWM:${pwm}`);
      updateMiniFanSpeed();

      if (Math.abs(pct - 15) <= 3) {
        showToast('5V Silent • 15%');
      } else if (Math.abs(pct - 50) <= 4) {
        showToast('9V Balanced • 50%');
      } else if (Math.abs(pct - 100) <= 4) {
        showToast('12V Turbo • 100%');
      } else {
        showToast(`Speed: ${pct}%`);
      }
    }

    trackWrap.addEventListener('pointerdown', onPointerDown);
    trackWrap.addEventListener('pointermove', onPointerMove);
    trackWrap.addEventListener('pointerup', onPointerUp);
    trackWrap.addEventListener('pointercancel', onPointerUp);
  }

  // 3. Ticks Direct Click (Smooth glide to 5V, 9V, 12V presets)
  if (DOM.tick5) DOM.tick5.addEventListener('click', (e) => { e.stopPropagation(); setSynchronizedMode(5); });
  if (DOM.tick9) DOM.tick9.addEventListener('click', (e) => { e.stopPropagation(); setSynchronizedMode(9); });
  if (DOM.tick12) DOM.tick12.addEventListener('click', (e) => { e.stopPropagation(); setSynchronizedMode(12); });

  // 4. Keyboard Navigation on Thumb (ArrowLeft / ArrowRight in 5% increments, min 15%)
  if (DOM.steppedThumb) {
    DOM.steppedThumb.addEventListener('keydown', (e) => {
      const currentPct = AppState.fanPct !== undefined ? AppState.fanPct : 100;
      if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
        e.preventDefault();
        const newPct = Math.min(100, currentPct + 5);
        const r = getRatioFromPct(newPct);
        updateVisualsFromRatio(r, false);
        const pwm = Math.max(35, Math.min(255, Math.round((newPct / 100) * 255)));
        sendBleCommand(`PWM:${pwm}`);
        updateMiniFanSpeed();
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
        e.preventDefault();
        const newPct = Math.max(15, currentPct - 5); // Minimum 15% (5V), never 0!
        const r = getRatioFromPct(newPct);
        updateVisualsFromRatio(r, false);
        const pwm = Math.max(35, Math.min(255, Math.round((newPct / 100) * 255)));
        sendBleCommand(`PWM:${pwm}`);
        updateMiniFanSpeed();
      }
    });
  }
}

function updateVisualsFromRatio(ratio, isDragging = false) {
  // Clamp 0.0 to 1.0 (0.0 = 5V / 15%, 0.5 = 9V / 50%, 1.0 = 12V / 100%)
  ratio = Math.max(0, Math.min(1, ratio));
  const pct = getPctFromRatio(ratio);
  const pwm = Math.max(35, Math.min(255, Math.round((pct / 100) * 255)));

  AppState.fanPct = pct;
  AppState.fanPWM = pwm;

  // 1. Update Track Fill Width
  if (DOM.steppedFill) DOM.steppedFill.style.width = `${ratio * 100}%`;

  // 2. Update Thumb Pixel Center along Track
  if (DOM.steppedThumb && DOM.steppedTrackWrap) {
    const wrapWidth = DOM.steppedTrackWrap.getBoundingClientRect().width;
    if (wrapWidth > 40) {
      const startX = 18;
      const trackWidth = wrapWidth - 36;
      const pixelX = startX + ratio * trackWidth;
      DOM.steppedThumb.style.left = `${pixelX}px`;
    } else {
      DOM.steppedThumb.style.left = `calc(18px + ${ratio} * (100% - 36px))`;
    }
  }

  // 3. Update Floating Percentage Bubble on Thumb (Strictly minimum 15%, never 0)
  if (DOM.steppedThumbBubble) {
    DOM.steppedThumbBubble.textContent = `${pct}%`;
  }

  // 4. Update Header Live Percentage Badge (Strictly minimum 15%, never 0)
  if (DOM.speedLivePct) {
    DOM.speedLivePct.textContent = `${pct}%`;
  }

  if (DOM.steppedThumb) {
    DOM.steppedThumb.setAttribute('aria-valuenow', String(pct));
  }

  // 5. Detect Nearest Preset (5V @ 15%, 9V @ 50%, 12V @ 100%)
  let activePreset = null;
  if (Math.abs(pct - 15) <= 3) activePreset = 5;
  else if (Math.abs(pct - 50) <= 4) activePreset = 9;
  else if (Math.abs(pct - 100) <= 4) activePreset = 12;

  AppState.activeMode = activePreset;

  // 6. Highlight Preset Ticks and Button Tiles
  if (DOM.tick5) DOM.tick5.classList.toggle('active', activePreset === 5);
  if (DOM.tick9) DOM.tick9.classList.toggle('active', activePreset === 9);
  if (DOM.tick12) DOM.tick12.classList.toggle('active', activePreset === 12);

  DOM.fanTiles.forEach(tile => {
    const m = parseInt(tile.dataset.mode, 10);
    tile.classList.toggle('active', m === activePreset);
  });

  if (isDragging) {
    throttleSendBlePwm(pwm);
    updateMiniFanSpeed();
  }

  return pct;
}

function setSynchronizedMode(mode) {
  if (![5, 9, 12].includes(mode)) return;

  AppState.activeMode = mode;
  AppState.controlMode = 'MANUAL';
  if (DOM.toggleAiCooling) DOM.toggleAiCooling.checked = false;
  if (DOM.modeControlStateBadge) {
    DOM.modeControlStateBadge.textContent = 'MANUAL';
    DOM.modeControlStateBadge.classList.remove('ai-active');
  }

  const modePresets = {
    5: { ratio: 0.00, pwm: 35, pct: 15, label: '5V Silent • 15%' },
    9: { ratio: 0.50, pwm: 128, pct: 50, label: '9V Balanced • 50%' },
    12: { ratio: 1.00, pwm: 255, pct: 100, label: '12V Turbo • 100%' }
  };

  const preset = modePresets[mode];
  if (preset) {
    AppState.fanPct = preset.pct;
    AppState.fanPWM = preset.pwm;

    if (!isSliderDragging) {
      if (DOM.steppedFill) {
        DOM.steppedFill.style.transition = 'width 0.28s cubic-bezier(0.34, 1.56, 0.64, 1)';
        DOM.steppedFill.style.width = `${preset.ratio * 100}%`;
      }
      if (DOM.steppedThumb && DOM.steppedTrackWrap) {
        DOM.steppedThumb.style.transition = 'left 0.28s cubic-bezier(0.34, 1.56, 0.64, 1)';
        const wrapWidth = DOM.steppedTrackWrap.getBoundingClientRect().width;
        const startX = 18;
        const trackWidth = wrapWidth - 36;
        const pixelX = startX + preset.ratio * trackWidth;
        DOM.steppedThumb.style.left = `${pixelX}px`;
      }
      if (DOM.steppedThumbBubble) DOM.steppedThumbBubble.textContent = `${preset.pct}%`;
      if (DOM.speedLivePct) DOM.speedLivePct.textContent = `${preset.pct}%`;
      if (DOM.steppedThumb) DOM.steppedThumb.setAttribute('aria-valuenow', String(preset.pct));

      // Highlight Tiles and Ticks
      DOM.fanTiles.forEach(tile => {
        tile.classList.toggle('active', parseInt(tile.dataset.mode, 10) === mode);
      });
      if (DOM.tick5) DOM.tick5.classList.toggle('active', mode === 5);
      if (DOM.tick9) DOM.tick9.classList.toggle('active', mode === 9);
      if (DOM.tick12) DOM.tick12.classList.toggle('active', mode === 12);
    }

    updateMiniFanSpeed();
    showToast(preset.label);
    sendBleCommand(`MODE:${mode}`);
  }
}

function updateSynchronizedModeUI(activeMode) {
  if (isSliderDragging) return;
  if ([5, 9, 12].includes(activeMode)) {
    const modeRatios = { 5: 0.00, 9: 0.50, 12: 1.00 };
    const r = modeRatios[activeMode] !== undefined ? modeRatios[activeMode] : 1.0;
    if (DOM.steppedFill) DOM.steppedFill.style.transition = 'width 0.28s cubic-bezier(0.34, 1.56, 0.64, 1)';
    if (DOM.steppedThumb) DOM.steppedThumb.style.transition = 'left 0.28s cubic-bezier(0.34, 1.56, 0.64, 1)';
    updateVisualsFromRatio(r, false);
  } else if (AppState.fanPct !== undefined) {
    const r = getRatioFromPct(AppState.fanPct);
    updateVisualsFromRatio(r, false);
  }
}

function updateMiniFanSpeed() {
  const wrapper = DOM.miniFanWrapper;
  const svg = DOM.miniFanSvg;
  if (!wrapper || !svg) return;

  if (!AppState.connected || (AppState.fanPWM !== undefined && AppState.fanPWM === 0)) {
    wrapper.classList.remove('running');
    wrapper.classList.add('paused');
    svg.style.animationPlayState = 'paused';
    return;
  }

  wrapper.classList.remove('paused');
  wrapper.classList.add('running');
  svg.style.animationPlayState = 'running';

  // Smooth dynamic duration between 0.22s (100% Turbo) and 2.6s (10% Whisper)
  const pwm = AppState.fanPWM !== undefined ? AppState.fanPWM : 255;
  const ratio = Math.max(0.05, Math.min(1.0, pwm / 255));
  const durSec = (0.22 + (1.0 - ratio) * 2.4).toFixed(2);
  const duration = `${durSec}s`;

  svg.style.setProperty('--mini-fan-speed', duration);
  svg.style.animationDuration = duration;
}

/* ==============================================================================
 * 5. RGB LED STUDIO CONTROLLER (WS2812B)
 * ============================================================================== */
function setupLedStudio() {
  // 1. Animation Effect Tiles
  DOM.ledEffectTiles.forEach(tile => {
    tile.addEventListener('click', () => {
      DOM.ledEffectTiles.forEach(t => t.classList.remove('active'));
      tile.classList.add('active');
      const effect = tile.dataset.effect;
      AppState.ledEffect = effect;

      if (DOM.ledCurrentModeBadge) DOM.ledCurrentModeBadge.textContent = effect;
      if (DOM.ledPreviewCaption) {
        const captions = {
          BREATH: 'Efek denyut bernapas halus',
          STACK: 'Bola jatuh mengisi tabung satu per satu sampai penuh!',
          SPIN: 'Efek putaran turbin kipas 1 arah (muter-muter)',
          DUAL: 'Putaran turbin ganda berlawanan arah (Cyberpunk)',
          RAINBOW: 'Efek pelangi spektrum mengalir',
          AURORA: 'Tirai cahaya kutub utara mistis (Aurora Borealis)',
          FIRE: 'Kobaran bara api tungku dinamis membara',
          METEOR: 'Komet melesat cepat dengan ekor memudar bertahap',
          PULSE: 'Detak jantung ganda ritmis (Lub-dub)',
          STROBE: 'Efek lampu kilat strobo (klip-klip)',
          STATIC: 'Glow warna solid konsisten',
          AI: 'Warna dinamis reaktif mengikuti suhu HP',
          OFF: 'Lampu LED dimatikan'
        };
        DOM.ledPreviewCaption.textContent = captions[effect] || effect;
      }

      showToast(`LED Effect: ${effect}`);
      sendBleCommand(`LED:EFFECT:${effect}`);
    });
  });

  // 2. Color Swatches
  DOM.colorSwatches.forEach(swatch => {
    swatch.addEventListener('click', () => {
      DOM.colorSwatches.forEach(s => s.classList.remove('active'));
      swatch.classList.add('active');
      const hex = swatch.dataset.color;
      AppState.ledColor = hex;

      if (DOM.ledNativeColorPicker) DOM.ledNativeColorPicker.value = hex;
      if (DOM.ledColorHexTag) DOM.ledColorHexTag.textContent = hex.toUpperCase();

      showToast(`LED Color: ${hex.toUpperCase()}`);
      sendBleCommand(`LED:COLOR:${hex}`);
    });
  });

  // 3. Native Color Picker
  if (DOM.ledNativeColorPicker) {
    DOM.ledNativeColorPicker.addEventListener('input', (e) => {
      const hex = e.target.value;
      AppState.ledColor = hex;
      if (DOM.ledColorHexTag) DOM.ledColorHexTag.textContent = hex.toUpperCase();

      DOM.colorSwatches.forEach(s => {
        s.classList.toggle('active', s.dataset.color.toLowerCase() === hex.toLowerCase());
      });

      sendBleCommand(`LED:COLOR:${hex}`);
    });
  }

  // 4. Brightness Slider
  if (DOM.ledBrightnessSlider) {
    DOM.ledBrightnessSlider.addEventListener('input', (e) => {
      const val = parseInt(e.target.value, 10);
      AppState.ledBrightness = val;
      if (DOM.ledBrightnessVal) DOM.ledBrightnessVal.textContent = `${val}%`;
      sendBleCommand(`LED:BRIGHT:${Math.round(val * 2.55)}`);
    });
  }

  // 5. Speed Pills
  DOM.speedPills.forEach(pill => {
    pill.addEventListener('click', () => {
      DOM.speedPills.forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      const spd = pill.dataset.speed;
      AppState.ledSpeed = spd;

      let speedMs = 2000;
      let label = 'Normal (1.0x)';
      if (spd === 'slow') {
        speedMs = 3600;
        label = 'Slow (0.5x)';
      } else if (spd === 'fast') {
        speedMs = 900;
        label = 'Fast (2.0x)';
      }

      AppState.ledSpeedMs = speedMs;
      if (DOM.ledSpeedVal) DOM.ledSpeedVal.textContent = label;
      showToast(`LED Speed: ${label}`);
      sendBleCommand(`LED:SPEED:${speedMs}`);
    });
  });
}

/**
 * Continuous 8-Pixel Ring Animation Simulator in Browser
 */
function startLedRingAnimation() {
  const beads = DOM.ledPixelBeads && DOM.ledPixelBeads.length > 0
    ? DOM.ledPixelBeads
    : document.querySelectorAll('.led-pixel-bead');
  const glow = DOM.ledRingGlow;

  function renderRingFrame() {
    const now = Date.now();
    const effect = AppState.ledEffect;
    const color = AppState.ledColor;
    const brightness = AppState.ledBrightness / 100.0;
    const speed = AppState.ledSpeedMs;
    const totalBeads = (beads && beads.length > 0) ? beads.length : 26;

    if (glow) {
      glow.style.setProperty('--led-glow-color', color);
      glow.style.opacity = (effect === 'OFF') ? '0' : String(0.18 * brightness);
    }

    if (beads && beads.length > 0) {
      if (effect === 'OFF') {
        beads.forEach(b => {
          b.style.setProperty('--pixel-color', '#1e293b');
          b.style.opacity = '0.15';
        });
      }
      else if (effect === 'STATIC') {
        beads.forEach(b => {
          b.style.setProperty('--pixel-color', color);
          b.style.opacity = String(brightness);
        });
      }
      else if (effect === 'BREATH') {
        const phase = (now % speed) / speed;
        const breath = (Math.sin(phase * 2 * Math.PI) + 1) * 0.5;
        const op = (0.2 + 0.8 * breath) * brightness;
        beads.forEach(b => {
          b.style.setProperty('--pixel-color', color);
          b.style.opacity = String(op);
        });
      }
      else if (effect === 'SPIN') {
        // Turbine chase across 26 beads: smooth comet head + 7-bead fading tail
        const step = Math.floor((now / (speed / totalBeads))) % totalBeads;
        beads.forEach((b, idx) => {
          const diff = (step - idx + totalBeads) % totalBeads;
          let factor = 0.05;
          if (diff === 0) factor = 1.0;
          else if (diff === 1) factor = 0.82;
          else if (diff === 2) factor = 0.64;
          else if (diff === 3) factor = 0.46;
          else if (diff === 4) factor = 0.30;
          else if (diff === 5) factor = 0.16;
          else if (diff === 6) factor = 0.06;
          b.style.setProperty('--pixel-color', color);
          b.style.opacity = String(factor * brightness);
        });
      }
      else if (effect === 'RAINBOW') {
        const hueOffset = (now / (speed / 360)) % 360;
        beads.forEach((b, idx) => {
          const hue = (idx * (360 / totalBeads) + hueOffset) % 360;
          const rainbowColor = `hsl(${hue}, 100%, 55%)`;
          b.style.setProperty('--pixel-color', rainbowColor);
          b.style.opacity = String(brightness);
        });
      }
      else if (effect === 'STACK') {
        // Tabung bola jatuh satu per satu sampai penuh (Gravity Stack Fill)
        const dropSpeed = Math.max(18, Math.floor(speed / (totalBeads * 2)));
        const totalSteps = (totalBeads * (totalBeads + 1)) / 2;
        const celebSteps = 26;
        const cycleSteps = totalSteps + celebSteps;
        const currentTick = Math.floor(now / dropSpeed) % cycleSteps;

        if (currentTick >= totalSteps) {
          // Full Celebration Flash!
          const isFlash = Math.floor((currentTick - totalSteps) / 4) % 2 === 0;
          beads.forEach(b => {
            b.style.setProperty('--pixel-color', color);
            b.style.opacity = isFlash ? String(brightness) : '0.08';
          });
        } else {
          let accum = 0;
          let floor = totalBeads - 1;
          let dropPos = 0;

          for (let k = 0; k < totalBeads; k++) {
            const stepsForThisBall = totalBeads - k;
            if (currentTick < accum + stepsForThisBall) {
              floor = totalBeads - 1 - k;
              dropPos = currentTick - accum;
              break;
            }
            accum += stepsForThisBall;
          }

          beads.forEach((b, idx) => {
            if (idx > floor) {
              // Bola yang sudah menumpuk di dasar tabung
              b.style.setProperty('--pixel-color', color);
              b.style.opacity = String(brightness);
            } else if (idx === dropPos) {
              // Bola yang sedang meluncur jatuh
              b.style.setProperty('--pixel-color', color);
              b.style.opacity = String(brightness);
            } else if (idx === dropPos - 1 && dropPos > 0) {
              // Ekor lembut di belakang bola jatuh
              b.style.setProperty('--pixel-color', color);
              b.style.opacity = String(0.38 * brightness);
            } else {
              b.style.setProperty('--pixel-color', '#1e293b');
              b.style.opacity = '0.12';
            }
          });
        }
      }
      else if (effect === 'DUAL') {
        // Dual Counter-Rotating Cyberpunk Chase
        const step = Math.floor((now / (speed / totalBeads))) % totalBeads;
        const stepCCW = (totalBeads - 1 - step + totalBeads) % totalBeads;
        beads.forEach((b, idx) => {
          const diffCW = (step - idx + totalBeads) % totalBeads;
          const diffCCW = (idx - stepCCW + totalBeads) % totalBeads;
          const fCW = (diffCW < 5) ? (1.0 - diffCW * 0.2) : 0.0;
          const fCCW = (diffCCW < 5) ? (1.0 - diffCCW * 0.2) : 0.0;

          if (fCW > 0 && fCCW > 0) {
            b.style.setProperty('--pixel-color', '#ffffff');
            b.style.opacity = String(brightness);
          } else if (fCW > 0) {
            b.style.setProperty('--pixel-color', '#00f0ff');
            b.style.opacity = String(fCW * brightness);
          } else if (fCCW > 0) {
            b.style.setProperty('--pixel-color', '#ff00aa');
            b.style.opacity = String(fCCW * brightness);
          } else {
            b.style.setProperty('--pixel-color', '#1e293b');
            b.style.opacity = '0.08';
          }
        });
      }
      else if (effect === 'AURORA') {
        // Aurora Borealis multi-gradient wave
        beads.forEach((b, idx) => {
          const w1 = Math.sin(now * 0.002 + idx * 0.28);
          const w2 = Math.cos(now * 0.0016 - idx * 0.22);
          const blend = (w1 + w2 + 2) * 0.25;
          const hue = Math.floor(140 + blend * 120); // 140 (emerald/cyan) to 260 (violet/purple)
          b.style.setProperty('--pixel-color', `hsl(${hue}, 100%, 55%)`);
          b.style.opacity = String((0.4 + 0.6 * blend) * brightness);
        });
      }
      else if (effect === 'FIRE') {
        // Flame / Ember: bara api berkobar dinamis
        beads.forEach((b, idx) => {
          const flicker = Math.min(1.0, Math.max(0.15,
            Math.sin(now * 0.012 + idx * 1.8) * 0.35 +
            Math.cos(now * 0.022 + idx * 3.4) * 0.25 + 0.4
          ));
          const hue = Math.floor(10 + flicker * 35); // Merah pekat ke kuning emas
          const light = Math.floor(35 + flicker * 30);
          b.style.setProperty('--pixel-color', `hsl(${hue}, 100%, ${light}%)`);
          b.style.opacity = String(flicker * brightness);
        });
      }
      else if (effect === 'METEOR') {
        // Shooting Meteor Rain with trailing fade decay
        const mSpeed = Math.max(15, Math.floor(speed / (totalBeads * 2)));
        const cycle = Math.floor(now / mSpeed) % (totalBeads + 8);
        beads.forEach((b, idx) => {
          const diff = cycle - idx;
          if (diff >= 0 && diff < 8) {
            const factor = Math.pow(0.65, diff);
            b.style.setProperty('--pixel-color', color);
            b.style.opacity = String(factor * brightness);
          } else {
            b.style.setProperty('--pixel-color', '#1e293b');
            b.style.opacity = '0.08';
          }
        });
      }
      else if (effect === 'PULSE') {
        // Cardiac / Heartbeat double-thump pulse (Lub-dub)
        const cycle = now % 1300;
        let beat = 0.08;
        if (cycle >= 50 && cycle < 200) {
          const t = (cycle - 50) / 150.0;
          beat = Math.sin(t * Math.PI);
        } else if (cycle >= 250 && cycle < 400) {
          const t = (cycle - 250) / 150.0;
          beat = Math.sin(t * Math.PI) * 0.85;
        }
        beat = Math.min(1.0, Math.max(0.08, beat));
        beads.forEach(b => {
          b.style.setProperty('--pixel-color', color);
          b.style.opacity = String(beat * brightness);
        });
      }
      else if (effect === 'STROBE') {
        const isFlash = Math.floor(now / (speed / 8)) % 2 === 0;
        beads.forEach(b => {
          b.style.setProperty('--pixel-color', color);
          b.style.opacity = isFlash ? String(brightness) : '0.05';
        });
      }
      else if (effect === 'AI') {
        // Cyan/Blue scaling with thermalLoad
        const phase = (now % 2200) / 2200;
        const breath = (Math.sin(phase * 2 * Math.PI) + 1) * 0.5;
        const base = 0.35 + AppState.thermalLoad * 0.65;
        const aiColor = AppState.thermalLoad > 0.75 ? '#ff3b30' : (AppState.thermalLoad > 0.45 ? '#00b8ff' : '#0066ff');
        beads.forEach(b => {
          b.style.setProperty('--pixel-color', aiColor);
          b.style.opacity = String(base * (0.4 + 0.6 * breath) * brightness);
        });
      }
    }

    requestAnimationFrame(renderRingFrame);
  }

  requestAnimationFrame(renderRingFrame);
}

/* ==============================================================================
 * 6. ADAPTIVE AI CONTROLS & DASHBOARD
 * ============================================================================== */
function setupAdaptiveAiControls() {
  if (DOM.toggleAiCooling) {
    DOM.toggleAiCooling.addEventListener('change', (e) => {
      AppState.aiCoolingEnabled = e.target.checked;
      AppState.controlMode = AppState.aiCoolingEnabled ? 'AI' : 'MANUAL';

      if (DOM.modeControlStateBadge) {
        DOM.modeControlStateBadge.textContent = AppState.aiCoolingEnabled ? 'AI ADAPTIVE ACTIVE' : 'MANUAL';
        DOM.modeControlStateBadge.classList.toggle('ai-active', AppState.aiCoolingEnabled);
      }

      if (AppState.aiCoolingEnabled) {
        showToast('Adaptive AI Cooling diaktifkan ✓');
        sendBleCommand('CONTROL:AI');
      } else {
        showToast('Beralih ke Kontrol Manual');
        sendBleCommand('CONTROL:MANUAL');
      }
      renderAdaptiveAiUI();
    });
  }
}

function renderAdaptiveAiUI() {
  const loadPct = Math.round(AppState.thermalLoad * 100);

  if (DOM.aiGaugeFill) DOM.aiGaugeFill.style.width = `${Math.min(100, Math.max(5, loadPct))}%`;
  if (DOM.aiThermalLoadVal) DOM.aiThermalLoadVal.textContent = `${loadPct}%`;
  if (DOM.aiActionVal) DOM.aiActionVal.textContent = AppState.aiRecommendation;

  // Rate & Trend
  if (DOM.aiColdRateVal) {
    const prefix = AppState.coldTempRate > 0 ? '+' : '';
    DOM.aiColdRateVal.textContent = `${prefix}${AppState.coldTempRate.toFixed(1)} °C/min`;
  }

  if (DOM.aiTrendPill) {
    if (AppState.coldTempRate > 0.8) {
      DOM.aiTrendPill.className = 'adaptive-trend-pill up';
      DOM.aiTrendPill.textContent = '↗ Warming';
    } else if (AppState.coldTempRate < -0.8) {
      DOM.aiTrendPill.className = 'adaptive-trend-pill down';
      DOM.aiTrendPill.textContent = '↘ Chilling';
    } else {
      DOM.aiTrendPill.className = 'adaptive-trend-pill stable';
      DOM.aiTrendPill.textContent = '→ Stable';
    }
  }

  // Actuation Output
  if (DOM.aiActuationVal) {
    const fanPct = Math.round(AppState.fanPWM / 2.55);
    DOM.aiActuationVal.textContent = `${fanPct}%`;
  }

  // Safety Status Card
  if (DOM.safetyStatusPill && DOM.safetyStatusPillText) {
    if (AppState.safetyState === 'CRITICAL') {
      DOM.safetyStatusPill.className = 'temp-status-pill hot';
      DOM.safetyStatusPillText.textContent = 'CRITICAL (> 65°C)';
    } else if (AppState.safetyState === 'WARNING') {
      DOM.safetyStatusPill.className = 'temp-status-pill moderate';
      DOM.safetyStatusPillText.textContent = 'WARNING (> 55°C)';
    } else {
      DOM.safetyStatusPill.className = 'temp-status-pill optimal';
      DOM.safetyStatusPillText.textContent = 'Normal (< 55°C)';
    }
  }

  if (DOM.aiDecisionStatusPill && DOM.aiDecisionStatusText) {
    if (AppState.controlMode === 'AI') {
      DOM.aiDecisionStatusPill.className = 'ai-status-pill trained';
      DOM.aiDecisionStatusText.textContent = 'ACTIVE INVERTER';
    } else {
      DOM.aiDecisionStatusPill.className = 'ai-status-pill';
      DOM.aiDecisionStatusText.textContent = 'MANUAL OVERRIDE';
    }
  }
}

/* ==============================================================================
 * 7. DUAL NTC TEMPERATURE & STATS UI UPDATES
 * ============================================================================== */
function updateDualTemperatureUI() {
  const cold = AppState.currentTemp;
  const hot = AppState.currentHotTemp;

  if (DOM.heroTempVal) {
    DOM.heroTempVal.textContent = (cold !== null) ? cold.toFixed(1) : '-';
  }
  if (DOM.heroHotVal) {
    DOM.heroHotVal.textContent = (hot !== null) ? `${hot.toFixed(1)}°C` : '-';
  }

  if (cold !== null) {
    let cat = { label: 'Optimal Chill 🧊', cls: 'optimal' };
    if (cold <= 5) cat = { label: 'Sub-Zero Chill ❄️', cls: 'ice' };
    else if (cold <= 14) cat = { label: 'Optimal Chill 🧊', cls: 'optimal' };
    else if (cold <= 22) cat = { label: 'Cooling Active 🌀', cls: 'cool' };
    else if (cold <= 30) cat = { label: 'Moderate Warm 🌡️', cls: 'moderate' };
    else cat = { label: 'High Thermal Load 🔥', cls: 'hot' };

    if (DOM.heroStatusPill) DOM.heroStatusPill.className = `temp-status-pill ${cat.cls}`;
    if (DOM.heroStatusPillText) DOM.heroStatusPillText.textContent = cat.label;

    if (DOM.tempProgressBar) {
      const pct = Math.max(0, Math.min(100, (40 - cold) / 40 * 100));
      DOM.tempProgressBar.style.width = `${pct}%`;
    }
  }

  if (DOM.quickLowestTemp && AppState.lowestTemp !== null) {
    DOM.quickLowestTemp.textContent = `${AppState.lowestTemp.toFixed(1)}°C`;
  }
  if (DOM.statsLowestVal && AppState.lowestTemp !== null) {
    DOM.statsLowestVal.textContent = `${AppState.lowestTemp.toFixed(1)}°C`;
  }
  if (DOM.statsHighestVal && AppState.highestTemp !== null) {
    DOM.statsHighestVal.textContent = `${AppState.highestTemp.toFixed(1)}°C`;
  }

  // Push to chart data
  if (cold !== null) {
    AppState.tempHistory.push({
      timestamp: Date.now(),
      temp: cold,
      hotTemp: hot
    });
    if (AppState.tempHistory.length > 50) AppState.tempHistory.shift();
    renderAllCharts();
  }

  renderAdaptiveAiUI();
}

/* ==============================================================================
 * 8. LIVE CHART RENDERING
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
  if (rect.width === 0) return;

  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;
  ctx.scale(dpr, dpr);
  const w = rect.width;
  const h = rect.height;
  ctx.clearRect(0, 0, w, h);

  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  const labelColor = isDark ? '#94a3b8' : '#8c9cb0';
  const solidGridColor = isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(226, 232, 240, 0.75)';
  const dashedGridColor = isDark ? 'rgba(148, 163, 184, 0.32)' : 'rgba(203, 213, 225, 0.9)';

  // Chart coordinate layout matching user mockup
  const padLeft = 44;
  const padRight = 24;
  const padTop = 14;
  const padBottom = 26;
  const plotW = w - padLeft - padRight;
  const plotH = h - padTop - padBottom;

  const y30 = padTop;
  const y20 = padTop + plotH * 0.5;
  const y10 = padTop + plotH;

  // 1. Draw Y-Axis Labels & Horizontal Grid Lines
  ctx.font = '600 11.5px Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = labelColor;

  // 30°C: Label + Solid horizontal line
  ctx.fillText('30°C', 2, y30);
  ctx.strokeStyle = solidGridColor;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(padLeft, y30);
  ctx.lineTo(w - padRight, y30);
  ctx.stroke();

  // 20°C: Label + Dashed horizontal line (Signature aesthetic from mockup)
  ctx.fillText('20°C', 2, y20);
  ctx.strokeStyle = dashedGridColor;
  ctx.lineWidth = 1.2;
  ctx.setLineDash([5, 5]);
  ctx.beginPath();
  ctx.moveTo(padLeft, y20);
  ctx.lineTo(w - padRight, y20);
  ctx.stroke();
  ctx.setLineDash([]); // Reset line dash

  // 10°C: Label only (Mockup has NO horizontal line at 10°C)
  ctx.fillText('10°C', 2, y10);

  // 2. Draw Bottom X-Axis Time Markers (5 evenly spaced timestamps)
  const now = new Date();
  const timeLabels = [];
  for (let i = 4; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 60 * 1000);
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    timeLabels.push(`${hh}:${mm}`);
  }

  ctx.font = '600 11px Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ctx.fillStyle = labelColor;

  timeLabels.forEach((label, i) => {
    const x = (padLeft + 6) + (i / (timeLabels.length - 1)) * (plotW - 12);
    ctx.fillText(label, x, h - 2);
  });

  // 3. Draw Temperature Curve (If data points exist)
  const data = AppState.tempHistory;
  let targetBadgeY = y20; // Default middle Y (20°C)
  let latestTemp = AppState.currentTemp;

  function tempToY(t) {
    const clamped = Math.max(10, Math.min(30, t));
    return y30 + (1 - (clamped - 10) / 20) * plotH;
  }

  if (data && data.length > 0) {
    const lastPt = data[data.length - 1];
    latestTemp = (latestTemp !== null && latestTemp !== undefined) ? latestTemp : lastPt.temp;
    targetBadgeY = tempToY(latestTemp);

    if (data.length >= 2) {
      const pts = data.map((pt, i) => {
        const x = padLeft + (i / (data.length - 1)) * (plotW - 28);
        const y = tempToY(pt.temp);
        return { x, y };
      });

      // Subtle gradient fill under curve
      const grad = ctx.createLinearGradient(0, y30, 0, y10);
      grad.addColorStop(0, isDark ? 'rgba(0, 240, 255, 0.18)' : 'rgba(0, 102, 255, 0.12)');
      grad.addColorStop(1, isDark ? 'rgba(0, 240, 255, 0.0)' : 'rgba(0, 102, 255, 0.0)');

      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      for (let i = 0; i < pts.length - 1; i++) {
        const xc = (pts[i].x + pts[i + 1].x) / 2;
        const yc = (pts[i].y + pts[i + 1].y) / 2;
        ctx.quadraticCurveTo(pts[i].x, pts[i].y, xc, yc);
      }
      ctx.lineTo(pts[pts.length - 1].x, pts[pts.length - 1].y);
      ctx.lineTo(pts[pts.length - 1].x, y10);
      ctx.lineTo(pts[0].x, y10);
      ctx.closePath();
      ctx.fillStyle = grad;
      ctx.fill();

      // Main line stroke
      ctx.beginPath();
      ctx.strokeStyle = isDark ? '#00f0ff' : '#0066ff';
      ctx.lineWidth = 2.5;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.moveTo(pts[0].x, pts[0].y);
      for (let i = 0; i < pts.length - 1; i++) {
        const xc = (pts[i].x + pts[i + 1].x) / 2;
        const yc = (pts[i].y + pts[i + 1].y) / 2;
        ctx.quadraticCurveTo(pts[i].x, pts[i].y, xc, yc);
      }
      ctx.lineTo(pts[pts.length - 1].x, pts[pts.length - 1].y);
      ctx.stroke();

      // Glowing endpoint dot
      const lastPoint = pts[pts.length - 1];
      ctx.beginPath();
      ctx.arc(lastPoint.x, lastPoint.y, 4, 0, Math.PI * 2);
      ctx.fillStyle = isDark ? '#00f0ff' : '#0066ff';
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = isDark ? '#0f172a' : '#ffffff';
      ctx.stroke();
    }
  }

  // 4. Update Floating Circular Badge Position & Text
  if (DOM.chartLiveBadge) {
    if (latestTemp !== null && latestTemp !== undefined && !isNaN(latestTemp)) {
      DOM.chartLiveBadge.textContent = `${latestTemp.toFixed(1)}°`;
      DOM.chartLiveBadge.classList.add('has-val');
    } else {
      DOM.chartLiveBadge.textContent = '-';
      DOM.chartLiveBadge.classList.remove('has-val');
    }
    DOM.chartLiveBadge.style.top = `${targetBadgeY}px`;
  }
}

function renderStatsChart() {
  const canvas = DOM.statsChart;
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  if (rect.width === 0) return;

  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;
  ctx.scale(dpr, dpr);
  const w = rect.width;
  const h = rect.height;
  ctx.clearRect(0, 0, w, h);

  const data = AppState.tempHistory;
  if (data.length < 2) return;

  const padLeft = 32;
  const padRight = 12;
  const padTop = 12;
  const padBottom = 22;
  const plotW = w - padLeft - padRight;
  const plotH = h - padTop - padBottom;

  const minT = 0;
  const maxT = 50;

  // Cold Line (Blue)
  ctx.beginPath();
  ctx.strokeStyle = '#00b8ff';
  ctx.lineWidth = 2;
  data.forEach((pt, i) => {
    const x = padLeft + (i / (data.length - 1)) * plotW;
    const y = padTop + (1 - (pt.temp - minT) / (maxT - minT)) * plotH;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.stroke();

  // Hot Line (Orange/Red)
  ctx.beginPath();
  ctx.strokeStyle = '#ef4444';
  ctx.lineWidth = 2;
  data.forEach((pt, i) => {
    const x = padLeft + (i / (data.length - 1)) * plotW;
    const hot = pt.hotTemp || (pt.temp + 15);
    const y = padTop + (1 - (hot - minT) / (maxT - minT)) * plotH;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.stroke();

  if (DOM.statsChartBadge && data.length > 0) {
    const last = data[data.length - 1];
    DOM.statsChartBadge.textContent = `Cold: ${last.temp.toFixed(1)}° | Hot: ${(last.hotTemp || last.temp+15).toFixed(1)}°`;
  }
}

/* ==============================================================================
 * 9. WEB BLUETOOTH API ENGINE
 * ============================================================================== */
function setupBleControls() {
  const triggerConnect = () => {
    if (AppState.connected) disconnectBle();
    else connectBle();
  };

  if (DOM.btnConnectionStatus) DOM.btnConnectionStatus.addEventListener('click', triggerConnect);
  if (DOM.btnBleAction) DOM.btnBleAction.addEventListener('click', triggerConnect);
  if (DOM.btnSettingsBle) DOM.btnSettingsBle.addEventListener('click', triggerConnect);
}

async function connectBle() {
  if (!navigator.bluetooth) {
    showToast('Web Bluetooth tidak didukung browser ini. Gunakan Chrome di Android/PC.');
    return;
  }

  try {
    showToast('Mencari Maestro Cooler...');
    let device = null;
    try {
      device = await navigator.bluetooth.requestDevice({
        filters: [
          { name: BLE_CONFIG.DEVICE_NAME },
          { namePrefix: 'Maestro' },
          { services: [BLE_CONFIG.SERVICE_UUID.toLowerCase()] }
        ],
        optionalServices: [BLE_CONFIG.SERVICE_UUID.toLowerCase()]
      });
    } catch (filterErr) {
      if (filterErr.name === 'NotFoundError' && (filterErr.message.includes('User cancelled') || filterErr.message.includes('cancelled'))) {
        return;
      }
      console.warn('Filtered request failed, attempting acceptAllDevices:', filterErr);
      device = await navigator.bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: [BLE_CONFIG.SERVICE_UUID.toLowerCase()]
      });
    }

    if (!device) return;

    AppState.device = device;
    device.addEventListener('gattserverdisconnected', onBleDisconnected);

    showToast('Menghubungkan ke GATT...');
    const server = await device.gatt.connect();
    AppState.server = server;

    const service = await server.getPrimaryService(BLE_CONFIG.SERVICE_UUID.toLowerCase());
    AppState.commandChar = await service.getCharacteristic(BLE_CONFIG.CHAR_COMMAND_UUID.toLowerCase());
    AppState.telemetryChar = await service.getCharacteristic(BLE_CONFIG.CHAR_TELEMETRY_UUID.toLowerCase());

    await AppState.telemetryChar.startNotifications();
    AppState.telemetryChar.addEventListener('characteristicvaluechanged', onTelemetryReceived);

    setBleConnectedState(true);
    showToast('Terhubung ke Maestro Cooler ✓');

    try {
      const initialData = await AppState.telemetryChar.readValue();
      onTelemetryReceived({ target: { value: initialData } });
    } catch (e) {}

  } catch (error) {
    if (error.name === 'NotFoundError' && (error.message.includes('User cancelled') || error.message.includes('cancelled'))) return;
    showToast(`Koneksi gagal: ${error.message}`);
    console.error('BLE connection error:', error);
  }
}

function disconnectBle() {
  if (AppState.device && AppState.device.gatt.connected) {
    AppState.device.gatt.disconnect();
  }
  setBleConnectedState(false);
  showToast('Bluetooth terputus');
}

function onBleDisconnected() {
  setBleConnectedState(false);
  showToast('Koneksi Cooler terputus');
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
    resetDisconnectedUI();
    renderAllCharts();
  }
}

let bleWriteQueue = [];
let isBleWriting = false;

async function sendBleCommand(cmdString) {
  if (!AppState.connected || !AppState.commandChar) return;
  bleWriteQueue.push(cmdString);
  processBleWriteQueue();
}

async function processBleWriteQueue() {
  if (isBleWriting || bleWriteQueue.length === 0 || !AppState.commandChar) return;
  isBleWriting = true;
  const cmd = bleWriteQueue.shift();
  try {
    const encoder = new TextEncoder();
    const data = encoder.encode(cmd);
    if (AppState.commandChar.writeValueWithoutResponse) {
      await AppState.commandChar.writeValueWithoutResponse(data);
    } else {
      await AppState.commandChar.writeValue(data);
    }
  } catch (err) {
    console.warn('Error sending BLE command:', err);
  } finally {
    isBleWriting = false;
    if (bleWriteQueue.length > 0) {
      setTimeout(processBleWriteQueue, 20);
    }
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
        if (!isNaN(parsedCold) && parsedCold > -50) {
          AppState.currentTemp = parsedCold;
          if (AppState.lowestTemp === null || parsedCold < AppState.lowestTemp) AppState.lowestTemp = parsedCold;
          if (AppState.highestTemp === null || parsedCold > AppState.highestTemp) AppState.highestTemp = parsedCold;
        }
      }

      // 2. Hot Temperature (GPIO1)
      if (data.hotTemp !== null && data.hotTemp !== undefined) {
        const parsedHot = parseFloat(data.hotTemp);
        if (!isNaN(parsedHot) && parsedHot > -50) {
          AppState.currentHotTemp = parsedHot;
          if (AppState.lowestHotTemp === null || parsedHot < AppState.lowestHotTemp) AppState.lowestHotTemp = parsedHot;
          if (AppState.highestHotTemp === null || parsedHot > AppState.highestHotTemp) AppState.highestHotTemp = parsedHot;
        }
      }

      // 3. Thermal rates & session data
      if (data.coldTempRate !== undefined) AppState.coldTempRate = parseFloat(data.coldTempRate) || 0;
      if (data.hotTempRate !== undefined) AppState.hotTempRate = parseFloat(data.hotTempRate) || 0;
      if (data.fanPWM !== undefined) {
        let pwm = parseInt(data.fanPWM, 10);
        pwm = Math.max(35, Math.min(255, pwm)); // Enforce minimum 5V, never 0
        AppState.fanPWM = pwm;
        const pct = Math.max(15, Math.min(100, Math.round((pwm / 255) * 100)));
        AppState.fanPct = pct;
        if (!isSliderDragging) {
          const r = getRatioFromPct(pct);
          updateVisualsFromRatio(r, false);
          updateMiniFanSpeed();
        }
      }
      if (data.peltierPWM !== undefined) AppState.peltierPWM = parseInt(data.peltierPWM, 10);
      if (data.thermalLoad !== undefined) AppState.thermalLoad = parseFloat(data.thermalLoad) || 0.5;
      if (data.aiRecommendation) AppState.aiRecommendation = String(data.aiRecommendation);
      if (data.safetyState) AppState.safetyState = String(data.safetyState);

      // 4. Synchronized Mode Update (5, 9, 12)
      if (data.fanMode) {
        let m = String(data.fanMode).replace('V', '');
        let num = parseInt(m, 10);
        if ([5, 9, 12].includes(num)) {
          AppState.activeMode = num;
        }
      }

      // 5. Control Mode
      if (data.controlMode) {
        AppState.controlMode = data.controlMode;
        AppState.aiCoolingEnabled = (data.controlMode === 'AI');
        if (DOM.toggleAiCooling) DOM.toggleAiCooling.checked = AppState.aiCoolingEnabled;
        if (DOM.modeControlStateBadge) {
          DOM.modeControlStateBadge.textContent = AppState.aiCoolingEnabled ? 'AI ADAPTIVE ACTIVE' : 'MANUAL';
          DOM.modeControlStateBadge.classList.toggle('ai-active', AppState.aiCoolingEnabled);
        }
      }

      // 6. Update UI
      updateDualTemperatureUI();
    }
  } catch (err) {
    console.warn('Telemetry JSON parse error:', err, 'Raw:', raw);
  }
}

/* ==============================================================================
 * 10. STOPWATCH LIVE TIMER
 * ============================================================================== */
function startCoolingTimer() {
  stopCoolingTimer();
  AppState.coolingSeconds = 0;
  AppState.coolingTimerId = setInterval(() => {
    if (!AppState.connected) return;
    AppState.coolingSeconds++;
    const totalSec = AppState.coolingSeconds;
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    const str = `${m}m ${s}s`;
    if (DOM.quickCoolingTime) DOM.quickCoolingTime.textContent = str;
    if (DOM.statsCoolingTimeVal) DOM.statsCoolingTimeVal.textContent = str;
  }, 1000);
}

function stopCoolingTimer() {
  if (AppState.coolingTimerId) clearInterval(AppState.coolingTimerId);
  AppState.coolingTimerId = null;
  AppState.coolingSeconds = 0;
}

/* ==============================================================================
 * 11. TOAST HELPER
 * ============================================================================== */
let toastTimeout = null;
function showToast(message) {
  if (!DOM.toast || !DOM.toastMsg) return;
  DOM.toastMsg.textContent = message;
  DOM.toast.classList.add('show');
  if (toastTimeout) clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => DOM.toast.classList.remove('show'), 2400);
}

/* ==============================================================================
 * APPLICATION BOOT
 * ============================================================================== */
window.addEventListener('DOMContentLoaded', () => initApp());
window.addEventListener('resize', () => {
  if (AppState.fanPct !== undefined) {
    const r = getRatioFromPct(AppState.fanPct);
    updateVisualsFromRatio(r, false);
  } else {
    updateSynchronizedModeUI(AppState.activeMode);
  }
  renderAllCharts();
});

// Expose MaestroCooler API for debugging
window.MaestroCooler = {
  AppState,
  connectBle,
  disconnectBle,
  setSynchronizedMode,
  sendBleCommand
};
