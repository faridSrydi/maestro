/**
 * ==============================================================================
 * MAESTRO COOLER - BLE PROTOCOL (v2.0)
 * Encodes commands to the ESP32 and validates incoming JSON telemetry.
 * ==============================================================================
 */

import { CONFIG } from './config.js';

export class Protocol {
  /**
   * Validate and encode a fan & peltier synchronized mode command.
   * Allows "5", "9", "15" (or legacy "12"). Strictly disallows "OFF".
   * @param {string} mode 
   * @returns {Uint8Array}
   */
  static encodeCommand(mode) {
    const cleanMode = String(mode).trim();
    let target = cleanMode;

    const validModes = ['5', '9', '12', '15'];
    if (!validModes.includes(target)) {
      throw new Error(`Invalid mode command: "${cleanMode}". Only "5", "9", "12", "15" are permitted.`);
    }

    const encoder = new TextEncoder();
    return encoder.encode(`MODE:${target}`);
  }

  /**
   * Encode Control Mode switch (AI vs MANUAL).
   * @param {'AI'|'MANUAL'} controlMode 
   * @returns {Uint8Array}
   */
  static encodeControlMode(controlMode) {
    const encoder = new TextEncoder();
    return encoder.encode(`CONTROL:${controlMode}`);
  }

  /**
   * Encode LED Effect command.
   * @param {string} effect 
   * @returns {Uint8Array}
   */
  static encodeLedEffect(effect) {
    const encoder = new TextEncoder();
    return encoder.encode(`LED:EFFECT:${effect.toUpperCase()}`);
  }

  /**
   * Encode LED Color command (HEX or RGB).
   * @param {string} hexColor 
   * @returns {Uint8Array}
   */
  static encodeLedColor(hexColor) {
    const encoder = new TextEncoder();
    return encoder.encode(`LED:COLOR:${hexColor}`);
  }

  /**
   * Encode LED Brightness (0-100%).
   * @param {number} percent 
   * @returns {Uint8Array}
   */
  static encodeLedBrightness(percent) {
    const val = Math.round(Math.min(100, Math.max(0, percent)) * 2.55);
    const encoder = new TextEncoder();
    return encoder.encode(`LED:BRIGHT:${val}`);
  }

  /**
   * Encode LED Animation Speed (ms duration).
   * @param {number} speedMs 
   * @returns {Uint8Array}
   */
  static encodeLedSpeed(speedMs) {
    const encoder = new TextEncoder();
    return encoder.encode(`LED:SPEED:${speedMs}`);
  }

  /**
   * Decode and parse raw BLE status characteristic data into a structured status object.
   * @param {DataView} dataView 
   * @returns {Object|null}
   */
  static parseStatus(dataView) {
    const decoder = new TextDecoder('utf-8');
    const jsonString = decoder.decode(dataView).trim();

    try {
      const data = JSON.parse(jsonString);

      // Validate fanMode ("5", "9", "15")
      let fanMode = String(data.fanMode || '').trim();
      if (fanMode === '12') fanMode = '15';
      const validModes = ['5', '9', '15'];
      const sanitizedMode = validModes.includes(fanMode) ? fanMode : '15';

      // Validate PWMs
      const fanPWM = typeof data.fanPWM === 'number' ? Math.min(255, Math.max(0, data.fanPWM)) : (data.pwm || 255);
      const peltierPWM = typeof data.peltierPWM === 'number' ? Math.min(255, Math.max(0, data.peltierPWM)) : 250;

      // Validate Temperatures
      let coldTemp = null;
      if (typeof data.coldTemp === 'number' && !isNaN(data.coldTemp) && data.coldTemp > -30 && data.coldTemp < 100) {
        coldTemp = parseFloat(data.coldTemp.toFixed(1));
      }

      let hotTemp = null;
      if (typeof data.hotTemp === 'number' && !isNaN(data.hotTemp) && data.hotTemp > -30 && data.hotTemp < 110) {
        hotTemp = parseFloat(data.hotTemp.toFixed(1));
      }

      const coldTempRate = typeof data.coldTempRate === 'number' ? parseFloat(data.coldTempRate.toFixed(2)) : 0.0;
      const hotTempRate = typeof data.hotTempRate === 'number' ? parseFloat(data.hotTempRate.toFixed(2)) : 0.0;

      // Modes and AI states
      const controlMode = (data.controlMode === 'AI' || data.controlMode === 'MANUAL') ? data.controlMode : 'AI';
      const thermalLoad = typeof data.thermalLoad === 'number' ? Math.min(1.0, Math.max(0.0, data.thermalLoad)) : 0.50;
      const aiRecommendation = String(data.aiRecommendation || 'MAINTAIN');
      const safetyState = String(data.safetyState || 'NORMAL');
      const ledMode = String(data.ledMode || 'AI');
      const coolingDuration = typeof data.coolingDuration === 'number' ? data.coolingDuration : 0;

      return {
        fanMode: sanitizedMode,
        fanPWM,
        peltierPWM,
        coldTemp,
        hotTemp,
        coldTempRate,
        hotTempRate,
        controlMode,
        thermalLoad,
        aiRecommendation,
        safetyState,
        ledMode,
        coolingDuration,
        rawJson: jsonString
      };
    } catch (err) {
      console.warn('[Protocol] Failed to parse JSON payload:', jsonString, err);
      return null;
    }
  }

  /**
   * Return qualitative cooling category based on cold plate temperature.
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
    if (temp <= 14.0) {
      return {
        label: 'Optimal Chill 🧊',
        badgeClass: 'badge-optimal',
        color: '#00c3ff'
      };
    }
    if (temp <= 22.0) {
      return {
        label: 'Cooling Active 🌀',
        badgeClass: 'badge-cool',
        color: '#00ff9d'
      };
    }
    if (temp <= 30.0) {
      return {
        label: 'Moderate Warm 🌡️',
        badgeClass: 'badge-moderate',
        color: '#ffb300'
      };
    }
    return {
      label: 'High Thermal Load 🔥',
      badgeClass: 'badge-hot',
      color: '#ff3b30'
    };
  }
}
