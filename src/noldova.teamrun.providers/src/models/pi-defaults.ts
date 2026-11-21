/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class PiDefaults {
  public static readonly none: PiDefaults = new PiDefaults(null, null, null);

  public readonly model: string | null;
  public readonly thinkingLevel: string | null;
  public readonly settingsTime: number | null;

  public constructor(model: string | null, thinkingLevel: string | null, settingsTime: number | null) {
    this.model = model;
    this.thinkingLevel = thinkingLevel;
    this.settingsTime = settingsTime;
  }
}
