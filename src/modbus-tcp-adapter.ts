/**
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.*
 */

'use strict';

import { ModbusAdapter } from './modbus-adapter';

import { TCPAdapter } from './config';

import { ModbusDevice } from './modbus-device';

import ModbusRTU from 'modbus-serial';

export class ModbusTcpAdapter extends ModbusAdapter {
  constructor(addonManager: any, packageName: string, private modbusAdapter: TCPAdapter, private pollInterval: number) {
    super(addonManager, modbusAdapter.id as string, packageName);
    this.connect();
  }

  private async connect() {
    const client = new ModbusRTU();
    const { host, port, devices } = this.modbusAdapter;

    console.log(`Connecting to modbus adapter at ${host}`);

    await client.connectTcpRTUBuffered(host, { port });

    if (devices) {
      for (const modbusDevice of devices) {
        const { address } = modbusDevice;
        console.log(`Creating device for address ${address} at ${host}`);
        const device = new ModbusDevice(this, client, modbusDevice);
        this.handleDeviceAdded(device);
        this.devices.push(device);
      }

      setInterval(() => this.poll(), (this.pollInterval || 2) * 1000);
    }
  }
}
