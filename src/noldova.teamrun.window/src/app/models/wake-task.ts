/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class WakeTask {
  public constructor(public readonly kind: string, public readonly name: string | null, public readonly ending: string | null, public readonly text: string | null) {
  }
}
