/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Failure, type FailureCode } from "@noldova/teamrun-shell-protocol";

import { MethodFailureException } from "./method-failure.exception.js";

export class SettingException extends MethodFailureException {
  public override readonly name: string = "SettingException";

  public constructor(message: string, code: FailureCode) {
    super(new Failure(code, message));
  }
}
