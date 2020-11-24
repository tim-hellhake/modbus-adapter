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
import { ReadRegisterResult } from 'modbus-serial/ModbusRTU';

export class ModbusDevice extends Device {
    private propertyByAddress: { [address: string]: Property } = {};

    constructor(adapter: Adapter, private client: ModbusRTU, private device: RTUDevice | TCPDevice) {
        super(adapter, device.id as string);
        this['@context'] = 'https://iot.mozilla.org/schemas/';
        this['@type'] = [];
        this.name = device.name;

        const { bits, registers, capabilities } = device;

        if (capabilities) {
            this['@type'] = capabilities;
        }

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
                const { name, address, type, propertyType, unit, minimum, maximum, encoding } = register;

                const additionalProperties: Record<string, unknown> = {};

                if (propertyType) {
                    additionalProperties['@type'] = propertyType;
                }

                if (unit) {
                    additionalProperties.unit = unit;
                }

                if (minimum) {
                    additionalProperties.minimum = minimum;
                }

                if (maximum) {
                    additionalProperties.maximum = maximum;
                }

                console.log(`Creating property for ${name} at ${address}`);

                switch (type) {
                    case 'Input':
                        this.addProperty(address, new Property(this, `${address}`, {
                            type: this.getPropertyType(encoding),
                            readOnly: true,
                            title: name,
                            ...additionalProperties
                        }));
                        break;
                    case 'Holding':
                        const addressNumber = parseInt(`0x${address}`);

                        this.addProperty(address, new WritableProperty(this, `${address}`, {
                            type: this.getPropertyType(encoding),
                            title: name,
                            ...additionalProperties
                        }, value => client.writeRegister(addressNumber, value)));
                        break;
                }
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
                const { address, encoding, type, divisor } = register;
                const property = this.propertyByAddress[address];

                if (property) {
                    const count = this.getRegisterCountFromEncoding(encoding);

                    const deviceAddressNumber = parseInt(`0x${this.device.address}`);
                    this.client.setID(deviceAddressNumber);

                    const addressNumber = parseInt(`0x${address}`);

                    let result: ReadRegisterResult;

                    console.log(`Reading ${type} ${addressNumber}`)

                    switch (type) {
                        case 'Input':
                            result = await this.client.readInputRegisters(addressNumber, count);
                            break;
                        case 'Holding':
                            result = await this.client.readHoldingRegisters(addressNumber, count);
                            break;
                    }

                    console.log(`Result ${addressNumber} ${JSON.stringify(result)}`)

                    const { data } = result;
                    const value = this.decode(data, encoding) / (divisor || 1);
                    property.setCachedValueAndNotify(value);
                }
            }
        }
    }

    private getPropertyType(encoding: TheEncodingOfTheValue) {
        switch (encoding) {
            case 'Int16':
            case 'UInt32':
            case 'Int32':
                return 'integer';
            case 'Float32':
                return 'number';
        }

        return 'number';
    }

    private getRegisterCountFromEncoding(encoding: TheEncodingOfTheValue) {
        switch (encoding) {
            case 'Int16':
                return 1;
            case 'UInt32':
            case 'Int32':
                return 2;
            case 'Float32':
                return 2;
        }

        return 1;
    }

    private static read32BitBuffer(array: number[]) {
        if (array.length < 2) {
            throw new Error("2 registers are needed for 32 bit values");
        }
        const [h, l] = array;

        const bytes = [
            h >> 8,
            h & 0xFF,
            l >> 8,
            l & 0xFF,
        ];

        return Buffer.from(bytes);
    }

    private decode(array: number[], encoding: TheEncodingOfTheValue) {
        switch (encoding) {
            case 'Int16':
                return array[0];
            case 'UInt32':
                return ModbusDevice.read32BitBuffer(array).readUInt32BE(0);
            case 'Int32':
                return ModbusDevice.read32BitBuffer(array).readInt32BE(0);
            case 'Float32':
                return ModbusDevice.read32BitBuffer(array).readFloatBE(0);
        }

        return 1;
    }
}
