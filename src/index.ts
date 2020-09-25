/**
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.*
 */

'use strict';

import { randomBytes } from 'crypto';

import { Database } from 'gateway-addon';

import { Config, RTUAdapter, TCPAdapter } from './config';

import { ModbusSerialAdapter } from './modbus-serial-adapter';

import { ModbusTcpAdapter } from './modbus-tcp-adapter';

export = (addonManager: any, manifest: any) => {
    load(addonManager, manifest);
};

async function load(addonManager: any, manifest: any) {
    const db = new Database(manifest.name);
    await db.open();
    const config = await db.loadConfig() as Config;

    const {
        rtuAdapter,
        tcpAdapter
    } = config;

    if (rtuAdapter) {
        generateIds(rtuAdapter);

        for (const adapter of rtuAdapter) {
            const {
                pollInterval
            } = adapter;

            new ModbusSerialAdapter(addonManager, manifest.id, adapter, pollInterval);
        }
    }

    if (tcpAdapter) {
        generateIds(tcpAdapter);

        for (const adapter of tcpAdapter) {
            const {
                pollInterval
            } = adapter;

            new ModbusTcpAdapter(addonManager, manifest.id, adapter, pollInterval);
        }
    }

    await db.saveConfig(config);

    return config;
}

function generateIds(adapters: (RTUAdapter | TCPAdapter)[]) {
    for (const adapter of adapters) {
        if (!adapter.id) {
            adapter.id = `${randomBytes(16).toString('hex')}`;
        }

        const {
            devices
        } = adapter;

        if (devices) {
            for (const device of devices) {
                if (!device.id) {
                    device.id = `${randomBytes(16).toString('hex')}`;
                }

                const {
                    registers
                } = device;

                if (registers) {
                    for (const register of registers) {
                        if (!register.id) {
                            register.id = `${randomBytes(16).toString('hex')}`;
                        }
                    }
                }
            }
        }
    }
}
