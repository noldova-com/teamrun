/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Exception } from "@noldova/teamrun-foundation-exceptions";
import type { FailureCode } from "@noldova/teamrun-shell-protocol";

export class SettingException extends Exception {
  public readonly code: FailureCode;

  public constructor(message: string, code: FailureCode) {
    super(message);

    this.code = code;
  }
}
