/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { CoreException } from "./core.exception.js";

export class TimeoutException extends CoreException {
  public override readonly name: string = "TimeoutException";

  public constructor(message: string) {
    super(message);
  }
}
