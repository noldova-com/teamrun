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

import type { IDiscoveredTestMethodOptions } from "../../interfaces/discovery/i-discovered-test-method-options.js";
import type { TestDataRow } from "./test-data-row.js";

export class DiscoveredTestMethodOptions implements IDiscoveredTestMethodOptions {
  public readonly testDataRow?: TestDataRow;
  public readonly skipReason?: string;
  public readonly categories: readonly string[];

  public constructor(options: IDiscoveredTestMethodOptions = {}) {
    const categories = options.categories ?? [];
    for (const category of categories)
      ArgumentException.throwIfNullOrWhitespace(category, nameof<DiscoveredTestMethodOptions>(t => t.categories));

    if (!Object.isUndefined(options.testDataRow))
      this.testDataRow = options.testDataRow;
    if (!Object.isUndefined(options.skipReason)) {
      ArgumentException.throwIfNullOrWhitespace(options.skipReason, nameof<DiscoveredTestMethodOptions>(t => t.skipReason));
      this.skipReason = options.skipReason;
    }

    this.categories = [...new Set(categories)];
  }
}
