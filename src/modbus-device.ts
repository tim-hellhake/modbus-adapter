/**
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.*
 */

'use strict';

import ModbusRTU from 'modbus-serial';

import { Adapter, Device, Property } from 'gateway-addon';

import { RTUDevice, TCPDevice, TheEncodingOfTheValue } from './config';
import { WritableProperty } from './writable-property';
import { ReadCoilResult } from 'modbus-serial/ModbusRTU';

export class ModbusDevice extends Device {
    private propertyByAddress: { [address: string]: Property } = {};

    constructor(adapter: Adapter, private client: ModbusRTU, private device: RTUDevice | TCPDevice) {
        super(adapter, device.id as string);
        this['@context'] = 'https://iot.mozilla.org/schemas/';
        this['@type'] = [];
        this.name = device.name;

        const { bits, registers } = device;

        if (bits) {
            for (const bit of bits) {
                const { name, address, type } = bit;

                console.log(`Creating property for ${name} at ${address}`);

                switch (type) {
                    case 'DiscreteInput':
                        this.addProperty(address, new Property(this, `${address}`, {
                            type: 'boolean',
                            readOnly: true,
                            title: name
                        }));
                        break;
                    case 'Coil':
                        const addressNumber = parseInt(`0x${address}`);

                        this.addProperty(address, new WritableProperty(this, `${address}`, {
                            type: 'boolean',
                            title: name
                        }, value => client.writeCoil(addressNumber, value)));
                        break;
                }
            }
        }

        if (registers) {
            for (const register of registers) {
                const { name, address } = register;

                console.log(`Creating property for ${name} at ${address}`);

                this.addProperty(address, new Property(this, `${address}`, {
                    type: 'number',
                    readOnly: true,
                    title: name
                }));
            }
        }
    }

    private addProperty(address: string, property: Property) {
        this.propertyByAddress[address] = property;
        this.properties.set(property.name, property);
    }

    public async poll() {
        const { bits, registers } = this.device;

        if (bits) {
            for (const bit of bits) {
                const { address, type } = bit;
                const property = this.propertyByAddress[address];

                if (property) {
                    const deviceAddressNumber = parseInt(`0x${this.device.address}`);
                    this.client.setID(deviceAddressNumber);

                    const addressNumber = parseInt(`0x${address}`);
                    let result: ReadCoilResult;

                    switch (type) {
                        case 'DiscreteInput':
                            result = await this.client.readDiscreteInputs(addressNumber, 1);
                            break;
                        case 'Coil':
                            result = await this.client.readCoils(addressNumber, 1);
                            break;
                    }

                    const { data } = result;

                    if (data.length == 0) {
                        console.log('Response did not contain any bits');
                        continue;
                    }

                    if (data.length != 1) {
                        console.log(`Expected 1 bit but got ${data.length}}`);
                    }

                    property.setCachedValueAndNotify(data[0]);
                }
            }
        }

        if (registers) {
            for (const register of registers) {
                const { address, encoding } = register;
                const property = this.propertyByAddress[address];

                if (property) {
                    const count = this.getRegisterCountFromEncoding(encoding);

                    const deviceAddressNumber = parseInt(`0x${this.device.address}`);
                    this.client.setID(deviceAddressNumber);

                    const addressNumber = parseInt(`0x${address}`);
                    const { data } = await this.client.readInputRegisters(addressNumber, count);

                    const value = this.decode(data, encoding);
                    property.setCachedValueAndNotify(value);
                }
            }
        }
    }

    private getRegisterCountFromEncoding(encoding: TheEncodingOfTheValue) {
        switch (encoding) {
            case 'Int16':
                return 1;
            case 'Float32':
                return 2;
        }

        return 1;
    }

    private decode(array: number[], encoding: TheEncodingOfTheValue) {
        switch (encoding) {
            case 'Int16':
                return array[0];
            case 'Float32':
                const [h, l] = array;

                const bytes = [
                    h >> 8,
                    h & 0xFF,
                    l >> 8,
                    l & 0xFF,
                ];

                const buff = Buffer.from(bytes);

                return buff.readFloatBE(0);
        }

        return 1;
    }
}
