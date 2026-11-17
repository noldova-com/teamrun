/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ProvidersException } from "./providers.exception.js";

export class AppServerUnavailableException extends ProvidersException {
  public override readonly name: string = "AppServerUnavailableException";

  public constructor(message: string) {
    super(message);
  }
}
