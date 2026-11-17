/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { SignInCheck } from "@noldova/teamrun.core";
import { ProviderIdentity } from "@noldova/teamrun.protocol";

import { Resources } from "../../resources.js";

export class CursorAboutReader {
  public static read(text: string, check: SignInCheck): SignInCheck {
    const fields = new Map<string, string>();
    for (const line of text.split(Resources.lineSeparator)) {
      const field = Resources.cursorAboutLinePattern.exec(line.trim());
      if (!Object.isNull(field))
        fields.set(field[1]!, field[2]!.trim());
    }
    const email = fields.get(Resources.cursorAboutEmailLabel);
    const plan = fields.get(Resources.cursorAboutPlanLabel);
    const identity = Object.isUndefined(email) && Object.isUndefined(plan) ? check.identity : new ProviderIdentity(email, plan);
    return new SignInCheck(check.authStatus, identity, fields.get(Resources.cursorAboutVersionLabel) ?? check.harnessVersion, check.error);
  }
}
