/**
 * ==============================================================================
 * MAESTRO COOLER - CONFIGURATION
 * Single source of truth for BLE UUIDs, fan & peltier modes, and RGB lighting.
 * ==============================================================================
 */

export const CONFIG = {
  DEVICE: {
    NAME: 'Maestro Cooler',
    FIRMWARE_VERSION: '2.0.0',
    MCU: 'ESP32-C3 SuperMini'
  },

  // Bluetooth Low Energy Custom UUIDs
  BLE: {
    SERVICE_UUID: '4fafc201-1fb5-459e-8fcc-c5c9c331914b',
    CONTROL_CHARACTERISTIC_UUID: 'beb5483e-36e1-4688-b7f5-ea07361b26a8',
    STATUS_CHARACTERISTIC_UUID: 'beb5483f-36e1-4688-b7f5-ea07361b26a8'
  },

  // Synchronized Voltage Modes (Fan + Peltier)
  // Powered by 15V Rail. PWM adjusts average power equivalent to 5V, 9V, 15V.
  // STRICTLY NO OFF MODE.
  FAN_MODES: {
    '5': {
      label: '5V',
      duty: 90,
      peltierDuty: 75,
      percent: 35,
      animationDuration: '1.2s',
      description: 'Silent Chill (5V)',
      glowColor: 'rgba(0, 184, 255, 0.4)'
    },
    '9': {
      label: '9V',
      duty: 155,
      peltierDuty: 150,
      percent: 60,
      animationDuration: '0.75s',
      description: 'Balanced (9V)',
      glowColor: 'rgba(16, 79, 237, 0.6)'
    },
    '12': {
      label: '12V',
      duty: 205,
      peltierDuty: 200,
      percent: 80,
      animationDuration: '0.45s',
      description: 'Gaming Pro (12V)',
      glowColor: 'rgba(0, 210, 255, 0.75)'
    },
    '15': {
      label: '15V',
      duty: 255,
      peltierDuty: 250,
      percent: 100,
      animationDuration: '0.28s',
      description: 'Turbofreeze (15V)',
      glowColor: 'rgba(0, 240, 255, 0.95)'
    }
  },

  // RGB LED Studio Configuration
  LED: {
    EFFECTS: [
      { id: 'BREATH', name: 'Breathing', desc: 'Denyut bernapas lembut', icon: 'pulse' },
      { id: 'SPIN', name: 'Turbine Spin', desc: 'Muter-muter mengelilingi kipas', icon: 'spin' },
      { id: 'RAINBOW', name: 'Rainbow Wave', desc: 'Spektrum pelangi mengalir', icon: 'rainbow' },
      { id: 'STROBE', name: 'Strobe Flash', desc: 'Kedip energik klip-klip', icon: 'flash' },
      { id: 'STATIC', name: 'Static Glow', desc: 'Warna solid mantap', icon: 'solid' },
      { id: 'AI', name: 'Thermal Sync', desc: 'Warna dinamis mengikuti suhu HP', icon: 'ai' },
      { id: 'OFF', name: 'Lights Off', desc: 'Matikan lampu LED', icon: 'off' }
    ],
    PRESET_COLORS: [
      { name: 'Glacier Cyan', hex: '#00f0ff' },
      { name: 'Cyber Blue', hex: '#0066ff' },
      { name: 'Neon Purple', hex: '#a855f7' },
      { name: 'Emerald Green', hex: '#10b981' },
      { name: 'Sunset Gold', hex: '#f59e0b' },
      { name: 'Flame Red', hex: '#ef4444' },
      { name: 'Pure White', hex: '#ffffff' }
    ],
    DEFAULT_COLOR: '#00c3ff',
    DEFAULT_EFFECT: 'AI',
    DEFAULT_BRIGHTNESS: 80, // %
    DEFAULT_SPEED: 'NORMAL' // SLOW, NORMAL, FAST
  },

  // Hardware Specifications
  HARDWARE: {
    FAN: {
      SUPPLY: '15V DC via AO3400A Low-side MOSFET',
      PWM_FREQ: '25 kHz (Silent)',
      PIN_PWM: 'GPIO5'
    },
    PELTIER: {
      MODEL: 'TEC1-12702 Senior (Vmax: 15.4V, ~2A)',
      SUPPLY: '15V DC via Logic Power N-MOSFET',
      PWM_FREQ: '20 kHz',
      PIN_PWM: 'GPIO4'
    },
    LED_STRIP: {
      TYPE: 'WS2812B Addressable LED (8 Pixels)',
      DATA_PIN: 'GPIO6'
    },
    TEMPERATURE: {
      COLD_PIN: 'GPIO3 (ADC1_CH3)',
      HOT_PIN: 'GPIO1 (ADC1_CH1)',
      TYPE: 'NTC 10K B3950 (Steinhart-Hart)'
    },
    SAFETY: {
      CRITICAL_TEMP: '65 °C (Auto Throttle Peltier & 100% Fan)',
      WARNING_TEMP: '55 °C'
    }
  }
};
