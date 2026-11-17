/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ArgumentOutOfRangeException } from "@noldova/context.exceptions";

import { CanvasResources } from "./canvas-resources.js";

export class CanvasChecks {
  public static requireFinite(name: string, value: number): void {
    if (!Number.isFinite(value))
      throw new ArgumentOutOfRangeException(name, value);
  }

  public static requireLength(name: string, value: string): void {
    if ([...value].length > CanvasResources.maximumTextLength)
      throw new ArgumentOutOfRangeException(name, value);
  }

  public static requirePositive(name: string, value: number): void {
    if (!Number.isFinite(value) || value <= 0)
      throw new ArgumentOutOfRangeException(name, value);
  }
}
