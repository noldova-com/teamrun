/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ArgumentOutOfRangeException } from "@noldova/teamrun-foundation-exceptions";

import { Resources } from "../resources.js";

export class ProcessSettings {
  public readonly graceMilliseconds: number;
  public readonly endMilliseconds: number;
  public readonly seenMilliseconds: number;

  public constructor(
    graceMilliseconds: number = Resources.processGraceMilliseconds,
    endMilliseconds: number = Resources.processEndMilliseconds,
    seenMilliseconds: number = Resources.processSeenMilliseconds) {
    ArgumentOutOfRangeException.throwIfNotPositiveInteger(graceMilliseconds, Resources.graceMillisecondsParameterName);
    ArgumentOutOfRangeException.throwIfNotPositiveInteger(endMilliseconds, Resources.endMillisecondsParameterName);
    ArgumentOutOfRangeException.throwIfNotPositiveInteger(seenMilliseconds, Resources.seenMillisecondsParameterName);

    this.graceMilliseconds = graceMilliseconds;
    this.endMilliseconds = endMilliseconds;
    this.seenMilliseconds = seenMilliseconds;
  }
}
