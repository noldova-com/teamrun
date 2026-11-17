/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */
import type { ProviderKindInstallation } from "@noldova/teamrun.protocol";

import type { ProviderRow } from "./provider-row";

export class ProviderGroup {
  public readonly kind: string;
  public readonly name: string;
  public readonly rows: readonly ProviderRow[];
  public readonly installation: ProviderKindInstallation | null;

  public constructor(kind: string, name: string, rows: readonly ProviderRow[], installation: ProviderKindInstallation | null) {
    this.kind = kind;
    this.name = name;
    this.rows = rows;
    this.installation = installation;
  }
}
