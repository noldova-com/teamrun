/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class SustainHandover {
  public constructor(public readonly carried: readonly string[], public readonly reads: string | null) {
  }
}
