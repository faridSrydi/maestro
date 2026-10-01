/**
 * ==============================================================================
 * MAESTRO COOLER - THERMAL DATA LOGGER & CSV EXPORTER
 * Captures real-time dual NTC telemetry for Random Forest dataset creation.
 * Stores data locally in browser (IndexedDB / memory). Zero cloud backend.
 * ==============================================================================
 */

'use strict';

class ThermalDataLogger {
  constructor() {
    this.isRecording = false;
    this.recordedSamples = [];
    this.dbName = 'MaestroCoolerDB';
    this.storeName = 'telemetry_dataset';
    this.db = null;
    this.onSampleLogged = null; // Callback: (sampleCount: number) => void

    this._initIndexedDb();
  }

  /**
   * Initialize local IndexedDB for persistent storage across browser refreshes
   */
  async _initIndexedDb() {
    if (!('indexedDB' in window)) {
      console.warn('[DataLogger] IndexedDB not supported, falling back to in-memory array.');
      return;
    }

    try {
      const request = indexedDB.open(this.dbName, 1);
      request.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(this.storeName)) {
          db.createObjectStore(this.storeName, { keyPath: 'id', autoIncrement: true });
        }
      };
      request.onsuccess = (e) => {
        this.db = e.target.result;
        this._loadStoredSampleCount();
      };
      request.onerror = (e) => {
        console.warn('[DataLogger] IndexedDB open error:', e);
      };
    } catch (err) {
      console.warn('[DataLogger] IndexedDB init error:', err);
    }
  }

  /**
   * Count existing stored samples in IndexedDB
   */
  async _loadStoredSampleCount() {
    if (!this.db) return;
    try {
      const tx = this.db.transaction(this.storeName, 'readonly');
      const store = tx.objectStore(this.storeName);
      const countReq = store.count();
      countReq.onsuccess = () => {
        if (this.onSampleLogged) {
          this.onSampleLogged(countReq.result);
        }
      };
    } catch (err) {
      console.warn('[DataLogger] Error counting stored samples:', err);
    }
  }

  /**
   * Start collecting thermal data samples
   */
  start() {
    this.isRecording = true;
    console.log('[DataLogger] Recording started.');
  }

  /**
   * Stop collecting thermal data
   */
  stop() {
    this.isRecording = false;
    console.log('[DataLogger] Recording stopped. Total session samples:', this.recordedSamples.length);
  }

  /**
   * Record a single telemetry tick from ESP32 BLE
   * @param {Object} telemetry Telemetry object from ESP32
   * @param {number|null} targetLabel Optional manual override label (5, 9, 12). If omitted, uses currentFanMode.
   */
  logSample(telemetry, targetLabel = null) {
    if (!this.isRecording || !telemetry) return;

    // Validate sensor values: coldTemp must be present
    if (telemetry.coldTemp === null || telemetry.coldTemp === undefined) return;

    const sample = {
      timestamp: new Date().toISOString(),
      coldTemp: Number(Number(telemetry.coldTemp).toFixed(2)),
      hotTemp: telemetry.hotTemp !== null && telemetry.hotTemp !== undefined ? Number(Number(telemetry.hotTemp).toFixed(2)) : Number(Number(telemetry.coldTemp + 15.0).toFixed(2)),
      coldTempRate: Number(Number(telemetry.coldTempRate || 0).toFixed(3)),
      hotTempRate: Number(Number(telemetry.hotTempRate || 0).toFixed(3)),
      currentFanMode: Number(telemetry.fanMode || 12),
      coolingDuration: Number(telemetry.coolingDuration || 0),
      previousColdTemp: telemetry.previousColdTemp !== null && telemetry.previousColdTemp !== undefined ? Number(Number(telemetry.previousColdTemp).toFixed(2)) : Number(Number(telemetry.coldTemp).toFixed(2)),
      previousHotTemp: telemetry.previousHotTemp !== null && telemetry.previousHotTemp !== undefined ? Number(Number(telemetry.previousHotTemp).toFixed(2)) : Number(Number(telemetry.hotTemp || telemetry.coldTemp + 15.0).toFixed(2)),
      recommendedFan: targetLabel !== null ? Number(targetLabel) : Number(telemetry.fanMode || 12)
    };

    this.recordedSamples.push(sample);

    // Save to IndexedDB if available
    if (this.db) {
      try {
        const tx = this.db.transaction(this.storeName, 'readwrite');
        const store = tx.objectStore(this.storeName);
        store.add(sample);
      } catch (err) {
        console.warn('[DataLogger] Error saving sample to IndexedDB:', err);
      }
    }

    if (this.onSampleLogged) {
      this.onSampleLogged(this.recordedSamples.length);
    }
  }

  /**
   * Export all recorded data as a standard CSV file formatted for ai/train_model.py
   */
  async exportCsv() {
    let allSamples = [...this.recordedSamples];

    // Read full historical samples from IndexedDB if present
    if (this.db) {
      try {
        const dbSamples = await new Promise((resolve, reject) => {
          const tx = this.db.transaction(this.storeName, 'readonly');
          const store = tx.objectStore(this.storeName);
          const req = store.getAll();
          req.onsuccess = () => resolve(req.result || []);
          req.onerror = () => reject(req.error);
        });

        if (dbSamples && dbSamples.length > 0) {
          allSamples = dbSamples;
        }
      } catch (err) {
        console.warn('[DataLogger] Could not read from IndexedDB, using session samples:', err);
      }
    }

    if (allSamples.length === 0) {
      alert('No telemetry data recorded yet. Please click "Start Data Collection" while the cooler is active.');
      return false;
    }

    // Build CSV Headers matching specifications:
    // timestamp,coldTemp,hotTemp,coldTempRate,hotTempRate,currentFanMode,coolingDuration,previousColdTemp,previousHotTemp,recommendedFan
    const headers = [
      'timestamp',
      'coldTemp',
      'hotTemp',
      'coldTempRate',
      'hotTempRate',
      'currentFanMode',
      'coolingDuration',
      'previousColdTemp',
      'previousHotTemp',
      'recommendedFan'
    ];

    let csvContent = headers.join(',') + '\n';

    allSamples.forEach(row => {
      const line = [
        row.timestamp,
        row.coldTemp,
        row.hotTemp,
        row.coldTempRate,
        row.hotTempRate,
        row.currentFanMode,
        row.coolingDuration,
        row.previousColdTemp,
        row.previousHotTemp,
        row.recommendedFan
      ].join(',');
      csvContent += line + '\n';
    });

    // Create browser download link
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', 'maestro_dataset.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    return true;
  }

  /**
   * Clear all recorded samples from memory & IndexedDB
   */
  async clearData() {
    this.recordedSamples = [];
    if (this.db) {
      try {
        const tx = this.db.transaction(this.storeName, 'readwrite');
        const store = tx.objectStore(this.storeName);
        store.clear();
      } catch (err) {
        console.warn('[DataLogger] Error clearing IndexedDB:', err);
      }
    }
    if (this.onSampleLogged) {
      this.onSampleLogged(0);
    }
  }

  getSampleCount() {
    return this.recordedSamples.length;
  }
}

// Global Singleton for easy app integration
window.thermalLogger = new ThermalDataLogger();
