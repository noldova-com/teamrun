/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export default class ApiException extends Error {
  public constructor(message: string, options?: ErrorOptions) {
    super(message, options);

    this.name = ApiException.name;
  }

  public static describe(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }
}
