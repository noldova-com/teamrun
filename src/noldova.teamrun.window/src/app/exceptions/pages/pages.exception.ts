/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { WindowException } from "../window.exception";

export abstract class PagesException extends WindowException {
  protected constructor(message: string) {
    super(message);
  }
}
