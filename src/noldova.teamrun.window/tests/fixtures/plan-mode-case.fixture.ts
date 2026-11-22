/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { ComposerSettings } from "../../src/app/models/composer-settings";

export class PlanModeCase {
  public readonly kind: string;
  public readonly settings: ComposerSettings;
  public readonly planMode: string | null;
  public readonly mode: string;

  public constructor(kind: string, settings: ComposerSettings, planMode: string | null, mode: string) {
    this.kind = kind;
    this.settings = settings;
    this.planMode = planMode;
    this.mode = mode;
  }
}
