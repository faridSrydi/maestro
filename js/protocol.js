/**
 * ==============================================================================
 * MAESTRO COOLER - BLE PROTOCOL
 * Encodes commands to the ESP32 and validates incoming JSON telemetry.
 * ==============================================================================
 */

import { CONFIG } from './config.js';

export class Protocol {
  /**
   * Validate and encode a fan mode command into Uint8Array for BLE transmission.
   * Only allows "5", "9", "12". Strictly disallows "OFF" or anything else.
   * @param {string} mode 
   * @returns {Uint8Array}
   */
  static encodeCommand(mode) {
    const validModes = ['5', '9', '12'];
    const cleanMode = String(mode).trim();

    if (!validModes.includes(cleanMode)) {
      throw new Error(`Invalid fan mode command: "${cleanMode}". Only "5", "9", "12" are permitted.`);
    }

    const encoder = new TextEncoder();
    return encoder.encode(cleanMode);
  }

  /**
   * Decode and parse raw BLE status characteristic data into a structured status object.
   * Expected format: {"fanMode":"12","pwm":255,"coldTemp":12.45}
   * @param {DataView} dataView 
   * @returns {{ fanMode: string, pwm: number, coldTemp: number|null, rawJson: string }}
   */
  static parseStatus(dataView) {
    const decoder = new TextDecoder('utf-8');
    const jsonString = decoder.decode(dataView).trim();

    try {
      const data = JSON.parse(jsonString);

      // Validate fanMode
      const fanMode = String(data.fanMode || '').trim();
      const validModes = ['5', '9', '12'];
      const sanitizedMode = validModes.includes(fanMode) ? fanMode : '12';

      // Validate PWM
      const pwm = typeof data.pwm === 'number' ? Math.min(255, Math.max(0, data.pwm)) : CONFIG.FAN_MODES[sanitizedMode].duty;

      // Validate Temperature
      let coldTemp = null;
      if (typeof data.coldTemp === 'number' && !isNaN(data.coldTemp) && data.coldTemp > -30 && data.coldTemp < 90) {
        coldTemp = parseFloat(data.coldTemp.toFixed(2));
      }

      return {
        fanMode: sanitizedMode,
        pwm,
        coldTemp,
        rawJson: jsonString
      };
    } catch (err) {
      console.warn('[Protocol] Failed to parse JSON payload:', jsonString, err);
      return null;
    }
  }

  /**
   * Return qualitative cooling category based strictly on cold plate temperature.
   * @param {number|null} temp 
   * @returns {{ label: string, badgeClass: string, color: string }}
   */
  static getTemperatureCategory(temp) {
    if (temp === null || temp === undefined) {
      return {
        label: 'Sensors Offline',
        badgeClass: 'badge-offline',
        color: '#718096'
      };
    }
    if (temp <= 5.0) {
      return {
        label: 'Sub-Zero Chill ❄️',
        badgeClass: 'badge-ice',
        color: '#00f0ff'
      };
    }
    if (temp <= 15.0) {
      return {
        label: 'Optimal Chill 🧊',
        badgeClass: 'badge-optimal',
        color: '#00c3ff'
      };
    }
    if (temp <= 25.0) {
      return {
        label: 'Cooling Active 🌀',
        badgeClass: 'badge-cool',
        color: '#00ff9d'
      };
    }
    return {
      label: 'Ambient Temp ⚡',
      badgeClass: 'badge-ambient',
      color: '#ffaa00'
    };
  }
}
