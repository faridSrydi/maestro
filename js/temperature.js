/**
 * ==============================================================================
 * MAESTRO COOLER - THERMAL PROCESSING MODULE
 * Steinhart-Hart calculation, multi-sample filtering, and derivative rate helpers.
 * ==============================================================================
 */

'use strict';

const MaestroTemperature = {
  // NTC 10K B3950 Constants
  NTC_R_REF: 10000.0,
  NTC_T_REF: 298.15,
  NTC_BETA: 3950.0,
  FIXED_RESISTOR: 10000.0,
  ADC_MAX: 4095.0,

  /**
   * Convert 12-bit ADC raw reading to Celsius using Beta equation
   * @param {number} rawAdc 
   * @returns {number|null}
   */
  rawAdcToCelsius(rawAdc) {
    if (rawAdc < 35 || rawAdc > 4060) return null;
    const rNtc = this.FIXED_RESISTOR * ((this.ADC_MAX / rawAdc) - 1.0);
    if (rNtc <= 0) return null;

    let steinhart = rNtc / this.NTC_R_REF;
    steinhart = Math.log(steinhart);
    steinhart /= this.NTC_BETA;
    steinhart += 1.0 / this.NTC_T_REF;
    steinhart = 1.0 / steinhart;
    return Number((steinhart - 273.15).toFixed(2));
  },

  /**
   * Calculate thermal rate of change in °C per minute
   * @param {number} currentTemp 
   * @param {number} previousTemp 
   * @param {number} deltaTimeMinutes 
   * @returns {number}
   */
  calculateRate(currentTemp, previousTemp, deltaTimeMinutes) {
    if (!deltaTimeMinutes || deltaTimeMinutes <= 0) return 0.0;
    return Number(((currentTemp - previousTemp) / deltaTimeMinutes).toFixed(3));
  }
};

window.MaestroTemperature = MaestroTemperature;
