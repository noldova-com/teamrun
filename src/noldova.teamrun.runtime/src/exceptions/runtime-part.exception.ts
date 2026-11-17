/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { RuntimeException } from "./runtime.exception.js";

export class RuntimePartException extends RuntimeException {
  public override readonly name: string = "RuntimePartException";

  public constructor(message: string) {
    super(message);
  }
}
