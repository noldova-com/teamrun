/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { IToolUpdateChecks } from "@noldova/teamrun.core";

export class FakeToolUpdateChecks implements IToolUpdateChecks {
  public allows: boolean;
  private readonly listeners: (() => void)[] = [];

  public constructor(allows: boolean) {
    this.allows = allows;
  }

  public takeCheck(): boolean {
    return this.allows;
  }

  public onAllowed(listener: () => void): void {
    this.listeners.push(listener);
  }

  public allow(): void {
    this.allows = true;
    for (const listener of this.listeners)
      listener();
  }
}
