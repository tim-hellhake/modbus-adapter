/**
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.*
 */

'use strict';

import { Adapter } from 'gateway-addon';

import { ModbusDevice } from './modbus-device';

export abstract class ModbusAdapter extends Adapter {
  protected devices: ModbusDevice[] = [];

  constructor(addonManager: any, id: string, packageName: string) {
    super(addonManager, id, packageName);
    addonManager.addAdapter(this);
  }

  public async poll() {
    if (this.devices) {
      for (const device of this.devices) {
        await device.poll();
      }
    }
  }
}
