/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";

export class NumberCodedError extends Error {
  public readonly code: number;

  public constructor(message: string, code: number) {
    super(message);
    this.code = code;
  }
}
