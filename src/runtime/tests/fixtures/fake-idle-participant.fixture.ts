/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { IIdleParticipant } from "@noldova/teamrun-runtime";

export class FakeIdleParticipant implements IIdleParticipant {
  public isIdle: boolean = false;
  public idleCount: number = 0;

  public handleIdle(): void {
    this.idleCount += 1;
  }
}
