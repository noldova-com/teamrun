/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Exception, type ExceptionOptions } from "@noldova/teamrun-foundation-exceptions";

export class SampleException extends Exception {
  public constructor(message: string, options?: ExceptionOptions) {
    super(message, options);
  }
}
