/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Exception } from "@noldova/context.exceptions";

export abstract class WindowException extends Exception {
  protected constructor(message: string) {
    super(message);
  }
}
