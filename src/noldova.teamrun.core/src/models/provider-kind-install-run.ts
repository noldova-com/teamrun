/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { ProviderKindInstallation } from "@noldova/teamrun.protocol";

export class ProviderKindInstallRun {
  public readonly controller: AbortController = new AbortController();
  public received: number = 0;
  public total: number = 0;
  public cancellable: boolean = true;
  public done: Promise<ProviderKindInstallation> | null = null;
}
