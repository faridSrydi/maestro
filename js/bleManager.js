/**
 * ==============================================================================
 * MAESTRO COOLER - BLE MANAGER
 * Pure Web Bluetooth API interface for Maestro Cooler ESP32-C3 SuperMini.
 * Zero backend requirement. Works in Secure Context (HTTPS or localhost).
 * ==============================================================================
 */

import { CONFIG } from './config.js';
import { Protocol } from './protocol.js';

export class BleManager {
  constructor() {
    this.device = null;
    this.server = null;
    this.service = null;
    this.controlCharacteristic = null;
    this.statusCharacteristic = null;

    this.isConnected = false;
    this.isConnecting = false;

    // Event callbacks
    this.onStateChange = null;       // (connected: boolean, deviceName: string) => void
    this.onStatusReceived = null;    // (statusObj: object) => void
    this.onError = null;             // (errorMessage: string, isFatal: boolean) => void

    this._boundOnDisconnected = this._handleDisconnected.bind(this);
    this._boundOnStatusNotification = this._handleStatusNotification.bind(this);
  }

  /**
   * Check if the host browser supports the Web Bluetooth API.
   * @returns {boolean}
   */
  static isSupported() {
    return typeof navigator !== 'undefined' && 'bluetooth' in navigator;
  }

  /**
   * Check if current window is in a secure context (required for Web Bluetooth).
   * @returns {boolean}
   */
  static isSecureContext() {
    return window.isSecureContext === true;
  }

  /**
   * Request Bluetooth device pair and connect GATT services.
   */
  async connect() {
    if (!BleManager.isSupported()) {
      const errorMsg = 'Bluetooth tidak tersedia di browser ini. Gunakan Google Chrome di Android/PC atau Bluefy Browser di iPhone/iPad.';
      if (this.onError) this.onError(errorMsg, true);
      throw new Error(errorMsg);
    }

    if (!BleManager.isSecureContext() && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
      const errorMsg = 'Web Bluetooth memerlukan HTTPS jika diakses melalui jaringan lokal atau HP.';
      if (this.onError) this.onError(errorMsg, true);
      throw new Error(errorMsg);
    }

    try {
      this.isConnecting = true;
      this._emitState();

      console.log(`[BLE] Requesting device "${CONFIG.DEVICE.NAME}"...`);

      // 1. Request device with targeted name filter and service UUID
      this.device = await navigator.bluetooth.requestDevice({
        filters: [
          { name: CONFIG.DEVICE.NAME }
        ],
        optionalServices: [
          CONFIG.BLE.SERVICE_UUID.toLowerCase()
        ]
      });

      console.log('[BLE] Device selected:', this.device.name);

      // Listen for disconnect events
      this.device.addEventListener('gattserverdisconnected', this._boundOnDisconnected);

      // 2. Connect GATT Server
      console.log('[BLE] Connecting to GATT Server...');
      this.server = await this.device.gatt.connect();

      // 3. Get Primary Service
      console.log('[BLE] Accessing Primary Service...');
      this.service = await this.server.getPrimaryService(CONFIG.BLE.SERVICE_UUID.toLowerCase());

      // 4. Get Control Characteristic (Write)
      console.log('[BLE] Accessing Control Characteristic...');
      this.controlCharacteristic = await this.service.getCharacteristic(
        CONFIG.BLE.CONTROL_CHARACTERISTIC_UUID.toLowerCase()
      );

      // 5. Get Status Characteristic (Notify + Read)
      console.log('[BLE] Accessing Status Characteristic...');
      this.statusCharacteristic = await this.service.getCharacteristic(
        CONFIG.BLE.STATUS_CHARACTERISTIC_UUID.toLowerCase()
      );

      // 6. Start Notifications for realtime telemetry
      console.log('[BLE] Subscribing to telemetry notifications...');
      await this.statusCharacteristic.startNotifications();
      this.statusCharacteristic.addEventListener(
        'characteristicvaluechanged',
        this._boundOnStatusNotification
      );

      // 7. Initial read of status if available
      try {
        const initialValue = await this.statusCharacteristic.readValue();
        const parsed = Protocol.parseStatus(initialValue);
        if (parsed && this.onStatusReceived) {
          this.onStatusReceived(parsed);
        }
      } catch (readErr) {
        console.warn('[BLE] Could not perform initial status read, waiting for notification:', readErr);
      }

      this.isConnected = true;
      this.isConnecting = false;
      this._emitState();
      console.log('[BLE] Successfully connected to Maestro Cooler!');

      return true;
    } catch (err) {
      this.isConnecting = false;
      this.isConnected = false;
      this._emitState();

      console.error('[BLE Error]', err);

      let userMessage = 'Failed to connect to Maestro Cooler.';
      if (err.name === 'NotFoundError') {
        userMessage = 'Device search cancelled or cooler not found.';
      } else if (err.name === 'SecurityError') {
        userMessage = 'Bluetooth permission required.';
      } else if (err.message && err.message.includes('User cancelled')) {
        userMessage = 'Connection cancelled by user.';
      } else {
        userMessage = err.message || 'Failed to connect';
      }

      if (this.onError) {
        this.onError(userMessage, false);
      }
      throw err;
    }
  }

  /**
   * Send fan mode command ("5", "9", "12") to ESP32.
   * @param {string} mode 
   */
  async sendFanMode(mode) {
    if (!this.isConnected || !this.controlCharacteristic) {
      throw new Error('Cooler disconnected. Please connect first.');
    }

    try {
      const payload = Protocol.encodeCommand(mode);

      // Try writeValueWithResponse, fallback to writeValueWithoutResponse if needed
      if (this.controlCharacteristic.writeValueWithResponse) {
        await this.controlCharacteristic.writeValueWithResponse(payload);
      } else if (this.controlCharacteristic.writeValue) {
        await this.controlCharacteristic.writeValue(payload);
      } else {
        await this.controlCharacteristic.writeValueWithoutResponse(payload);
      }

      console.log(`[BLE] Mode "${mode}" command successfully written to ESP32.`);
      return true;
    } catch (err) {
      console.error('[BLE Write Error]', err);
      if (this.onError) {
        this.onError('Failed to send mode command to cooler.', false);
      }
      throw err;
    }
  }

  /**
   * Disconnect from current BLE device.
   */
  disconnect() {
    if (this.device && this.device.gatt && this.device.gatt.connected) {
      console.log('[BLE] Disconnecting from device...');
      this.device.gatt.disconnect();
    } else {
      this._handleDisconnected();
    }
  }

  /**
   * Internal handler for status characteristic notifications.
   */
  _handleStatusNotification(event) {
    const value = event.target.value;
    const parsed = Protocol.parseStatus(value);
    if (parsed && this.onStatusReceived) {
      this.onStatusReceived(parsed);
    }
  }

  /**
   * Internal handler for unexpected or manual disconnects.
   */
  _handleDisconnected() {
    console.warn('[BLE] Cooler disconnected');
    this.isConnected = false;
    this.isConnecting = false;
    this.controlCharacteristic = null;
    this.statusCharacteristic = null;
    this._emitState();

    if (this.onError) {
      this.onError('Cooler disconnected', false);
    }
  }

  /**
   * Emit connection state changes to subscribers.
   */
  _emitState() {
    if (this.onStateChange) {
      this.onStateChange({
        isConnected: this.isConnected,
        isConnecting: this.isConnecting,
        deviceName: this.device ? (this.device.name || CONFIG.DEVICE.NAME) : null
      });
    }
  }
}
