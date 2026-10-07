/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { IUpdater } from "@noldova/teamrun-shell-desktop";

export class FakeUpdater implements IUpdater {
  public static readonly FILE: string = "/downloads/TeamRun-linux-x64.AppImage";

  public checks: number = 0;
  public downloads: number = 0;
  public check: () => Promise<string | null> = () => Promise.resolve(null);
  public download: (onProgress: (percent: number) => void) => Promise<string> = () => Promise.resolve(FakeUpdater.FILE);

  public checkAsync(): Promise<string | null> {
    this.checks++;
    return this.check();
  }

  public downloadAsync(onProgress: (percent: number) => void): Promise<string> {
    this.downloads++;
    return this.download(onProgress);
  }
}
