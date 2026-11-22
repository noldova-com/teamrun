/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { AbilityRow } from "./ability-row";

export class AbilityGroupView {
  public constructor(public readonly title: string, public readonly rows: readonly AbilityRow[]) {
  }
}
