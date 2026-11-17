/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { type ProviderAbility, type ProviderKind, Resources as ProtocolResources } from "@noldova/teamrun.protocol";

export class AbilityRefusal {
  public static of(kind: ProviderKind | undefined, ability: ProviderAbility, action: string): string | null {
    if (Object.isUndefined(kind))
      return null;
    const reason = kind.reasonAgainst(ability);
    return Object.isNull(reason) ? null : ProtocolResources.formatAbilityRefused(kind.displayName, action, reason);
  }
}
