/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/teamrun-foundation-core";

import { nameof } from "@noldova/teamrun-foundation-core";
import { ArgumentException } from "@noldova/teamrun-foundation-exceptions";

import type { ITestMethodResultOptions } from "../../interfaces/results/i-test-method-result-options.js";
import type { TestDataRow } from "../discovery/test-data-row.js";

export class TestMethodResultOptions implements ITestMethodResultOptions {
  public readonly testDataRow?: TestDataRow;
  public readonly failure?: unknown;
  public readonly skipReason?: string;

  public constructor(options: ITestMethodResultOptions = {}) {
    if (!Object.isUndefined(options.testDataRow))
      this.testDataRow = options.testDataRow;
    if (!Object.isUndefined(options.failure))
      this.failure = options.failure;
    if (!Object.isUndefined(options.skipReason)) {
      ArgumentException.throwIfNullOrWhitespace(options.skipReason, nameof<TestMethodResultOptions>(t => t.skipReason));
      this.skipReason = options.skipReason;
    }
  }
}
