/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/teamrun-foundation-core";
import { ArgumentException } from "@noldova/teamrun-foundation-exceptions";

import { Resources } from "../resources.js";

export class ProcessExit {
  public readonly code: number | null;
  public readonly signal: NodeJS.Signals | null;

  public constructor(code: number | null, signal: NodeJS.Signals | null) {
    if (Object.isNull(code) === Object.isNull(signal))
      throw new ArgumentException(Resources.processExitInvalid, Resources.codeParameterName);

    this.code = code;
    this.signal = signal;
  }

  public get isClean(): boolean {
    return this.code === 0;
  }
}
