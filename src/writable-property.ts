/**
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

import { Device, Property } from "gateway-addon";

export class WritableProperty<T, R> extends Property {

    constructor(device: Device, name: string, propertyDescr: {}, private setter: (value: T) => Promise<R>) {
        super(device, name, propertyDescr);
    }

    public async setValue(value: T): Promise<void> {
        await this.setter(value);
    }
}
