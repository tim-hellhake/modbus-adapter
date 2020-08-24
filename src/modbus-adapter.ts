/**
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.*
 */

'use strict';

import { Adapter } from 'gateway-addon';

import { RTUAdapter } from './config';

import { ModbusDevice } from './modbus-device';
import ModbusRTU from 'modbus-serial';

export class ModbusAdapter extends Adapter {
  private deviceByAddress: { [address: string]: ModbusDevice } = {};

  constructor(addonManager: any, private rtuAdapter: RTUAdapter, private pollInterval: number) {
    super(addonManager, `Modbus RTU ${rtuAdapter.serialPort}`, rtuAdapter.id as string);
    addonManager.addAdapter(this);
    this.connect();
  }

  private async connect() {
    const client = new ModbusRTU();
    const { serialPort, baudRate } = this.rtuAdapter;

    console.log(`Connecting to RTU adapter at ${serialPort} with ${baudRate} baud`);

    await client.connectRTUBuffered(serialPort, { baudRate: baudRate });

    if (this.rtuAdapter.devices) {
      for (const rtuDevice of this.rtuAdapter.devices) {
        const { address } = rtuDevice;
        console.log(`Creating device for address ${address} at ${serialPort}`);
        const device = new ModbusDevice(this, client, rtuDevice);
        this.handleDeviceAdded(device);
        this.deviceByAddress[address] = device;
      }

      setInterval(() => this.poll(), (this.pollInterval || 2) * 1000);
    }
  }

  public async poll() {
    if (this.rtuAdapter.devices) {
      for (const rtuDevice of this.rtuAdapter.devices) {
        const { address } = rtuDevice;
        const device = this.deviceByAddress[address];

        if (device) {
          await device.poll();
        } else {
          console.log(`No device found for address ${address}`);
        }
      }
    }
  }
}
