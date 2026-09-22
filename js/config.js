/**
 * ==============================================================================
 * MAESTRO COOLER - CONFIGURATION
 * Single source of truth for BLE UUIDs, fan modes, and hardware parameters.
 * ==============================================================================
 */

export const CONFIG = {
  DEVICE: {
    NAME: 'Maestro Cooler',
    FIRMWARE_VERSION: '1.0.0',
    MCU: 'ESP32-C3 SuperMini'
  },

  // Bluetooth Low Energy Custom UUIDs
  // Centralized here to make updates straightforward
  BLE: {
    SERVICE_UUID: '4fafc201-1fb5-459e-8fcc-c5c9c331914b',
    CONTROL_CHARACTERISTIC_UUID: 'beb5483e-36e1-4688-b7f5-ea07361b26a8',
    STATUS_CHARACTERISTIC_UUID: 'beb5483f-36e1-4688-b7f5-ea07361b26a8'
  },

  // Fan Mode Definitions
  // NOTE: Fan is supplied by 12V DC. 5V/9V/12V are simulated speed modes using PWM.
  // There is NO OFF MODE.
  FAN_MODES: {
    '5': {
      label: '5V',
      duty: 89,
      maxDuty: 255,
      percent: 35,
      animationDuration: '1.1s',
      description: 'Quiet Chill (~35%)',
      glowColor: 'rgba(0, 184, 255, 0.4)'
    },
    '9': {
      label: '9V',
      duty: 191,
      maxDuty: 255,
      percent: 75,
      animationDuration: '0.6s',
      description: 'Balanced Performance (~75%)',
      glowColor: 'rgba(16, 79, 237, 0.55)'
    },
    '12': {
      label: '12V',
      duty: 255,
      maxDuty: 255,
      percent: 100,
      animationDuration: '0.32s',
      description: 'Max Turbine Chill (100%)',
      glowColor: 'rgba(0, 184, 255, 0.85)'
    }
  },

  // Hardware Specifications for Settings display
  HARDWARE: {
    FAN: {
      SWITCH_TYPE: 'AO3400 N-MOSFET (Low-Side)',
      PWM_FREQ: '25 kHz',
      PWM_RESOLUTION: '8-bit (0 - 255)',
      PIN_PWM: 'GPIO5'
    },
    TEMPERATURE: {
      SENSOR_MODEL: 'Cold Plate Thermal Sensor',
      ADC_PIN: 'GPIO3 (ADC1_CH3)',
      BETA_COEFFICIENT: '3950K',
      FIXED_RESISTOR: '10 kΩ 1% to GND',
      REFERENCE_TEMP: '25 °C'
    },
    BUTTON: {
      PIN: 'GPIO2',
      MODE: 'INPUT_PULLUP',
      DEBOUNCE: '250 ms'
    },
    PELTIER: {
      SUPPLY: '12V Fixed DC',
      STATUS: 'Hardware Fixed (Web Control Reserved for v2)'
    }
  }
};
