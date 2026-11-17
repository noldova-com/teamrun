/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { ProviderAbility } from "@noldova/teamrun.protocol";

export interface IAbilityRow {
  readonly ability: ProviderAbility;
  readonly settingId: string;
  readonly name: string;
  readonly answer: string;
  readonly works: boolean;
  readonly description: string | null;
}
