/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { ProviderModel } from "@noldova/teamrun.protocol";

import type { CodexModelDefaults } from "../services/codex/codex-model-defaults.js";

export class CodexCatalog {
  public readonly models: readonly ProviderModel[];
  public readonly defaults: CodexModelDefaults | null;

  public constructor(models: readonly ProviderModel[], defaults: CodexModelDefaults | null) {
    this.models = models;
    this.defaults = defaults;
  }
}
