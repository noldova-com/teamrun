/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { nameof } from "@noldova/teamrun-foundation-core";
import { ArgumentException } from "@noldova/teamrun-foundation-exceptions";

export class TestDataEntry {
  public readonly values: readonly unknown[];

  public constructor(values: readonly unknown[]) {
    ArgumentException.throwIfEmpty(values, nameof<TestDataEntry>(t => t.values));
    this.values = [...values];
  }
}
