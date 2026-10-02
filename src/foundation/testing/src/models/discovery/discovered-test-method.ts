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

import { DiscoveredTestMethodOptions } from "./discovered-test-method-options.js";
import type { TestDataRow } from "./test-data-row.js";

export class DiscoveredTestMethod {
  public readonly methodName: string;
  public readonly testDataRow?: TestDataRow;
  public readonly skipReason?: string;
  public readonly categories: readonly string[];
  public readonly displayName: string;

  public constructor(methodName: string, options: DiscoveredTestMethodOptions = new DiscoveredTestMethodOptions()) {
    ArgumentException.throwIfNullOrWhitespace(methodName, nameof<DiscoveredTestMethod>(t => t.methodName));

    this.methodName = methodName;
    if (!Object.isUndefined(options.testDataRow))
      this.testDataRow = options.testDataRow;
    if (!Object.isUndefined(options.skipReason))
      this.skipReason = options.skipReason;
    this.categories = options.categories;
    this.displayName = Object.isUndefined(options.testDataRow) ? methodName : `${methodName}[${options.testDataRow.index}]`;
  }
}
