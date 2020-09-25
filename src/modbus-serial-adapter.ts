/**
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.*
 */

'use strict';

import { ModbusAdapter } from './modbus-adapter';

import { RTUAdapter } from './config';

import { ModbusDevice } from './modbus-device';

import ModbusRTU from 'modbus-serial';

export class ModbusSerialAdapter extends ModbusAdapter {
  constructor(addonManager: any, packageName: string, private modbusAdapter: RTUAdapter, private pollInterval: number) {
    super(addonManager, modbusAdapter.id as string, packageName);
    this.connect();
  }

  private async connect() {
    const client = new ModbusRTU();
    const { serialPort, baudRate, devices } = this.modbusAdapter;

    console.log(`Connecting to modbus adapter at ${serialPort} with ${baudRate} baud`);

    await client.connectRTUBuffered(serialPort, { baudRate: baudRate });

    if (devices) {
      for (const modbusDevice of devices) {
        const { address } = modbusDevice;
        console.log(`Creating device for address ${address} at ${serialPort}`);
        const device = new ModbusDevice(this, client, modbusDevice);
        this.handleDeviceAdded(device);
        this.devices.push(device);
      }

      setInterval(() => this.poll(), (this.pollInterval || 2) * 1000);
    }
  }
}
