/**
 * ==============================================================================
 * MAESTRO COOLER - STATISTICS & ANALYTICS HELPER
 * Computes thermal extremes, running averages, and AI decision distributions.
 * ==============================================================================
 */

'use strict';

const MaestroStatistics = {
  /**
   * Compute min, max, and average from a sequence of numbers
   * @param {Array<number>} values 
   * @returns {Object}
   */
  computeMetrics(values) {
    if (!values || values.length === 0) {
      return { min: null, max: null, avg: null };
    }
    const min = Math.min(...values);
    const max = Math.max(...values);
    const sum = values.reduce((acc, v) => acc + v, 0);
    const avg = Number((sum / values.length).toFixed(1));
    return { min, max, avg };
  },

  /**
   * Calculate percentage breakdown of fan mode decisions
   * @param {Object} counts { 5: number, 9: number, 12: number }
   * @returns {Object} { pct5: number, pct9: number, pct12: number, total: number }
   */
  computeDistribution(counts) {
    const c5 = counts[5] || 0;
    const c9 = counts[9] || 0;
    const c12 = counts[12] || 0;
    const total = c5 + c9 + c12;
    if (total === 0) {
      return { pct5: 0, pct9: 0, pct12: 0, total: 0 };
    }
    return {
      pct5: Math.round((c5 / total) * 100),
      pct9: Math.round((c9 / total) * 100),
      pct12: Math.round((c12 / total) * 100),
      total
    };
  }
};

window.MaestroStatistics = MaestroStatistics;
