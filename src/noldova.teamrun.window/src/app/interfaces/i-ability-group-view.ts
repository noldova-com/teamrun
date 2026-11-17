/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { IAbilityRow } from "./i-ability-row";

export interface IAbilityGroupView {
  readonly title: string;
  readonly rows: readonly IAbilityRow[];
}
