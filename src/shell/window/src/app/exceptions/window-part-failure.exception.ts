/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Exception } from "@noldova/teamrun-foundation-exceptions";

export class WindowPartFailureException extends Exception {
  public override readonly name: string = "WindowPartFailureException";
  public readonly moduleId: string;

  public constructor(moduleId: string, message: string, cause: unknown) {
    super(message, { cause });

    this.moduleId = moduleId;
  }
}
