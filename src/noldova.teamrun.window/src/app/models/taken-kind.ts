/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { Provider, ProviderKind } from "@noldova/teamrun.protocol";

export class TakenKind {
  public static reasons(kinds: readonly ProviderKind[], providers: readonly Provider[]): ReadonlyMap<string, string> {
    return new Map(kinds.flatMap(t => Object.isNull(t.singleAccount) || !providers.some(u => u.kind === t.id) ? [] : [[t.id, t.singleAccount] as const]));
  }

  public static firstFree(taken: ReadonlyMap<string, string>, candidates: readonly (string | null | undefined)[], last: string): string {
    return candidates.find((t): t is string => !Object.isNullOrUndefined(t) && !taken.has(t)) ?? last;
  }
}
