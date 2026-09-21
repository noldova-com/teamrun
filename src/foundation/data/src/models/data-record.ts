/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/teamrun-foundation-core";

import { DataException } from "../exceptions/data.exception.js";
import { Resources } from "../resources.js";
import type { DataValue } from "../types/data-value.js";

export class DataRecord {
  private readonly values: ReadonlyMap<string, DataValue>;

  public constructor(values: ReadonlyMap<string, DataValue>) {
    this.values = new Map(values);
  }

  public hasField(name: string): boolean {
    return this.values.has(name);
  }

  public readString(name: string): string {
    const value = this.readValue(name);
    if (!Object.isString(value))
      throw new DataException(Resources.formatFieldNotText(name));

    return value;
  }

  public readNullableString(name: string): string | null {
    return Object.isNull(this.readValue(name)) ? null : this.readString(name);
  }

  public readInteger(name: string): number {
    const value = this.readValue(name);
    if (!Object.isNumber(value) || !Number.isInteger(value))
      throw new DataException(Resources.formatFieldNotInteger(name));

    return value;
  }

  public readNullableInteger(name: string): number | null {
    return Object.isNull(this.readValue(name)) ? null : this.readInteger(name);
  }

  public readValue(name: string): DataValue {
    const value = this.values.get(name);
    if (Object.isUndefined(value))
      throw new DataException(Resources.formatFieldMissing(name));

    return value;
  }
}
