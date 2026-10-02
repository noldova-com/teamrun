/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { IRuntimeConnection } from "@noldova/teamrun-shell-desktop";

export class FakeRuntimeConnection implements IRuntimeConnection {
  public isClosed: boolean = false;

  public close(): void {
    this.isClosed = true;
  }
}
