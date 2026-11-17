/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ProviderAbility, type ProviderKind, type ProviderMode } from "@noldova/teamrun.protocol";

import { Resources } from "../../resources";
import { AbilityRefusal } from "./ability-refusal";

export class RefusedMode {
  public constructor(public readonly name: string, public readonly reason: string, public readonly unrestricted: boolean) {
  }

  public static of(kind: ProviderKind | undefined, modes: readonly ProviderMode[] | undefined): readonly RefusedMode[] {
    const offered = modes ?? [];
    const readOnly = offered.some(t => t.readOnly) ? null : AbilityRefusal.of(kind, ProviderAbility.ReadOnlyMode, Resources.useReadOnlyModeAction);
    const unrestricted = offered.some(t => t.unrestricted) ? null : AbilityRefusal.of(kind, ProviderAbility.UnrestrictedMode, Resources.useUnrestrictedModeAction);
    return [
      ...Object.isNull(readOnly) ? [] : [new RefusedMode(Resources.readOnlyModeLabel, readOnly, false)],
      ...Object.isNull(unrestricted) ? [] : [new RefusedMode(Resources.unrestrictedModeLabel, unrestricted, true)]
    ];
  }
}
