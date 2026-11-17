/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { ProviderKindInstallation } from "@noldova/teamrun.protocol";

import type { ProviderFoundRow } from "./provider-found-row";
import type { ProviderRow } from "./provider-row";

export class ProviderListGroup {
  public readonly kind: string;
  public readonly name: string;
  public readonly rows: readonly ProviderRow[];
  public readonly found: readonly ProviderFoundRow[];
  public readonly note: string | null;
  public readonly installation: ProviderKindInstallation | null;

  public constructor(kind: string, name: string, rows: readonly ProviderRow[], found: readonly ProviderFoundRow[], note: string | null = null,
    installation: ProviderKindInstallation | null = null) {
    this.kind = kind;
    this.name = name;
    this.rows = rows;
    this.found = found;
    this.note = note;
    this.installation = installation;
  }

  public get count(): number {
    return this.rows.length + this.found.length;
  }
}
