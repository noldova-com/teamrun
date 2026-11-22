/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { ProviderAbility } from "@noldova/teamrun.protocol";

export class AbilityRow {
  public constructor(public readonly ability: ProviderAbility, public readonly settingId: string, public readonly name: string, public readonly answer: string,
    public readonly works: boolean, public readonly description: string | null) {
  }
}
