/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class FailureDescriber {
  public static describe(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }
}
