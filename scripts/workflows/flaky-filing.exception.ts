/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export default class FlakyFilingException extends Error {
  public readonly filed: readonly string[];

  public constructor(filed: readonly string[], cause: Error) {
    super(`Filing the flaky tests stopped: ${cause.message}`, { cause });

    this.name = FlakyFilingException.name;
    this.filed = filed;
  }
}
