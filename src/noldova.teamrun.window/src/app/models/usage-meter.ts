/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { UsageLevel } from "../enums/usage-level";

export class UsageMeter {
  public readonly label: string;
  public readonly percent: number | null;
  public readonly text: string;
  public readonly level: UsageLevel;
  public readonly description: string;

  public constructor(label: string, percent: number | null, text: string, level: UsageLevel, description: string) {
    this.label = label;
    this.percent = percent;
    this.text = text;
    this.level = level;
    this.description = description;
  }
}
