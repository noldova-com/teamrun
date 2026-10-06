/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Exception } from "@noldova/teamrun-foundation-exceptions";

export class ModuleLoadException extends Exception {
  public override readonly name: string = "ModuleLoadException";

  public constructor(message: string) {
    super(message);
  }
}
