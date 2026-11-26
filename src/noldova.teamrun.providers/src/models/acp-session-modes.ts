/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { ProviderMode } from "@noldova/teamrun.protocol";

export class AcpSessionModes {
  public readonly modes: readonly ProviderMode[];
  public readonly current: string | null;

  public constructor(modes: readonly ProviderMode[], current: string | null) {
    this.modes = modes;
    this.current = current;
  }
}
