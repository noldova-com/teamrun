/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { ProviderModel } from "@noldova/teamrun-protocol";
import "@noldova/teamrun-foundation-core";

export class ModelCatalog {
  public readonly models: readonly ProviderModel[];
  public readonly fetchedAt: number;
  public readonly failed: boolean;

  public constructor(models: readonly ProviderModel[], fetchedAt: number, failed: boolean) {
    this.models = [...models];
    this.fetchedAt = fetchedAt;
    this.failed = failed;
  }

  public resolveModel(model: string | null): string | null {
    return Object.isNull(model) || this.models.some(t => t.matches(model)) ? model : null;
  }

  public resolveEffort(model: string | null, effort: string | null): string | null {
    const levels = this.models.find(t => t.matches(model))?.effortLevels;
    return Object.isNull(effort) || Object.isNullOrUndefined(levels) || levels.includes(effort) ? effort : null;
  }
}
