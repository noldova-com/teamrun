/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { ArgumentException } from "@noldova/context.exceptions";

import { Resources } from "../resources.js";

export class AcpPermissionSwitch {
  public readonly optionId: string;
  public readonly mode: string;
  public readonly onValue: string;
  public readonly offValue: string;

  public constructor(optionId: string, mode: string, onValue: string, offValue: string) {
    ArgumentException.throwIfNullOrWhitespace(optionId, Resources.optionIdParameterName);
    ArgumentException.throwIfNullOrWhitespace(mode, Resources.modeParameterName);
    ArgumentException.throwIfNullOrWhitespace(onValue, Resources.onValueParameterName);
    ArgumentException.throwIfNullOrWhitespace(offValue, Resources.offValueParameterName);

    this.optionId = optionId;
    this.mode = mode;
    this.onValue = onValue;
    this.offValue = offValue;
  }
}
