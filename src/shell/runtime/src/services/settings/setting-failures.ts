/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Failure } from "@noldova/teamrun-shell-protocol";

import { MethodFailureException } from "../../exceptions/method-failure.exception.js";
import { SettingException } from "../../exceptions/setting.exception.js";

export class SettingFailures {
  public static translate<T>(action: () => T): T {
    try {
      return action();
    }
    catch (error) {
      if (error instanceof SettingException)
        throw new MethodFailureException(new Failure(error.code, error.message));
      throw error;
    }
  }
}
