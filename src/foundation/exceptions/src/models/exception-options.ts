/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class ExceptionOptions implements ErrorOptions {
  public readonly cause: unknown;

  public constructor(cause?: unknown) {
    this.cause = cause;
  }
}
