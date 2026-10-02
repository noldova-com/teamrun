/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/teamrun-foundation-core";

import { nameof } from "@noldova/teamrun-foundation-core";
import { ArgumentException, ArgumentOutOfRangeException } from "@noldova/teamrun-foundation-exceptions";

import { Resources } from "../../resources.js";

export class TestDataRow {
  public readonly index: number;
  public readonly values: readonly unknown[];

  public constructor(index: number, values: readonly unknown[]) {
    if (!Number.isInteger(index) || index < 0)
      throw new ArgumentOutOfRangeException(nameof<TestDataRow>(t => t.index), index, Resources.testDataIndexInvalid);

    ArgumentException.throwIfEmpty(values, nameof<TestDataRow>(t => t.values));
    this.index = index;
    this.values = [...values];
  }
}
