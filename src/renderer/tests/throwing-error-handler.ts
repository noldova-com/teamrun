/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ErrorHandler } from "@angular/core";

export class ThrowingErrorHandler extends ErrorHandler {
  public override handleError(error: unknown): never {
    throw error;
  }
}
