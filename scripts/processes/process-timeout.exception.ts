/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import ProcessException from "./process.exception.ts";

export default class ProcessTimeoutException extends ProcessException {
  public constructor(message: string) {
    super(message);

    this.name = ProcessTimeoutException.name;
  }
}
