/**
 * ==============================================================================
 * MAESTRO COOLER - BLE DRIVER COMPONENT
 * Web Bluetooth protocol constants, connection lifecycle, and command dispatcher.
 * ==============================================================================
 */

'use strict';

const MaestroBle = {
  CONFIG: {
    DEVICE_NAME: 'Maestro Cooler',
    SERVICE_UUID: '4fafc201-1fb5-459e-8fcc-c5c9c331914b',
    CONTROL_CHARACTERISTIC_UUID: 'beb5483e-36e1-4688-b7f5-ea07361b26a8',
    STATUS_CHARACTERISTIC_UUID: 'beb5483f-36e1-4688-b7f5-ea07361b26a8'
  },

  COMMANDS: {
    MODE_5V: '5',
    MODE_9V: '9',
    MODE_12V: '12'
  },

  isSupported() {
    return typeof navigator !== 'undefined' && 'bluetooth' in navigator;
  }
};

window.MaestroBle = MaestroBle;
