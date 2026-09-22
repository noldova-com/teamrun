/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { IUpdateBackend } from "@noldova/teamrun-desktop";

export class FakeUpdateBackend implements IUpdateBackend {
  public checks: number = 0;
  public downloads: number = 0;
  public disposals: number = 0;
  public installs: number = 0;

  public install(): Promise<void> {
    this.installs += 1;
    return Promise.resolve();
  }
  public checkResult: () => Promise<string | null> = () => Promise.resolve("0.0.2");
  public downloadResult: (progress: (percent: number) => void) => Promise<void> = () => Promise.resolve();

  public check(): Promise<string | null> {
    this.checks += 1;
    return this.checkResult();
  }

  public download(progress: (percent: number) => void): Promise<void> {
    this.downloads += 1;
    return this.downloadResult(progress);
  }

  public dispose(): void {
    this.disposals += 1;
  }
}
