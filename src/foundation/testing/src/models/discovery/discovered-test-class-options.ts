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

import type { IDiscoveredTestClassOptions } from "../../interfaces/discovery/i-discovered-test-class-options.js";

export class DiscoveredTestClassOptions implements IDiscoveredTestClassOptions {
  public readonly skipReason?: string;
  public readonly categories: readonly string[];

  public constructor(options: IDiscoveredTestClassOptions = {}) {
    const categories = options.categories ?? [];
    for (const category of categories)
      ArgumentException.throwIfNullOrWhitespace(category, nameof<DiscoveredTestClassOptions>(t => t.categories));

    if (!Object.isUndefined(options.skipReason)) {
      ArgumentException.throwIfNullOrWhitespace(options.skipReason, nameof<DiscoveredTestClassOptions>(t => t.skipReason));
      this.skipReason = options.skipReason;
    }

    this.categories = [...new Set(categories)];
  }
}
