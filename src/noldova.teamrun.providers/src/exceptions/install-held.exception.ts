/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ProvidersException } from "./providers.exception.js";

export class InstallHeldException extends ProvidersException {
  public override readonly name: string = "InstallHeldException";

  public readonly code: string;

  public constructor(message: string, code: string, cause: unknown) {
    super(message, cause);

    this.code = code;
  }
}
