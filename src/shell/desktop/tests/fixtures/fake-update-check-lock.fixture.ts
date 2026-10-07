/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { IUpdateCheckLock } from "@noldova/teamrun-shell-desktop";

export class FakeUpdateCheckLock implements IUpdateCheckLock {
  public acquires: number = 0;
  public releases: number = 0;
  public acquire: () => Promise<boolean> = () => Promise.resolve(true);
  public release: () => Promise<void> = () => Promise.resolve();

  public tryAcquireAsync(): Promise<boolean> {
    this.acquires++;
    return this.acquire();
  }

  public releaseAsync(): Promise<void> {
    this.releases++;
    return this.release();
  }
}
