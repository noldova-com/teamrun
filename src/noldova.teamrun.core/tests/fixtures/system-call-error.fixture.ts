/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";

import { CodedError } from "./coded-error.fixture.js";

export class SystemCallError extends CodedError {
  public readonly syscall: unknown;

  public constructor(message: string, code: string, syscall: unknown) {
    super(message, code);
    this.syscall = syscall;
  }
}
