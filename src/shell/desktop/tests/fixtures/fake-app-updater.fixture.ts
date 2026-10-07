/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { Logger, ProgressInfo, UpdateInfo } from "electron-updater";

import type { FeedProvider, FeedSource, IAppUpdater } from "@noldova/teamrun-shell-desktop";

export class FakeAppUpdater implements IAppUpdater {
  public autoDownload: boolean = true;
  public autoInstallOnAppQuit: boolean = true;
  public allowDowngrade: boolean = true;
  public allowPrerelease: boolean = true;
  public disableDifferentialDownload: boolean = false;
  public disableWebInstaller: boolean = false;
  public logger: Logger | null = null;
  public isUpdateSupported: (info: UpdateInfo) => boolean | Promise<boolean> = () => true;
  public feed: { readonly provider: "custom"; readonly updateProvider: typeof FeedProvider; readonly source: FeedSource } | null = null;
  public listener: ((info: ProgressInfo) => void) | null = null;
  public configWhenChecked: string | null = null;
  private configPath: string | null = null;
  public check: () => Promise<{ readonly isUpdateAvailable: boolean; readonly updateInfo: UpdateInfo } | null> = () => Promise.resolve(null);
  public download: () => Promise<string[]> = () => Promise.resolve([]);

  public get updateConfigPath(): string | null {
    return this.configPath;
  }

  public set updateConfigPath(value: string | null) {
    this.configPath = value;
    this.feed = null;
  }

  public setFeedURL(options: { readonly provider: "custom"; readonly updateProvider: typeof FeedProvider; readonly source: FeedSource }): void {
    this.feed = options;
  }

  public checkForUpdates(): Promise<{ readonly isUpdateAvailable: boolean; readonly updateInfo: UpdateInfo } | null> {
    this.configWhenChecked = this.configPath;
    return Object.isNull(this.feed) ? Promise.reject(new Error("Unsupported provider: undefined")) : this.check();
  }

  public downloadUpdate(): Promise<string[]> {
    return this.download();
  }

  public on(_event: "download-progress", listener: (info: ProgressInfo) => void): unknown {
    this.listener = listener;
    return this;
  }

  public removeListener(_event: "download-progress", listener: (info: ProgressInfo) => void): unknown {
    if (this.listener === listener)
      this.listener = null;
    return this;
  }

  public static info(version: string): UpdateInfo {
    return { version, files: [], path: "TeamRun-linux-x64.AppImage", sha512: "c2hh", releaseDate: "2026-10-06T00:00:00.000Z" };
  }

  public static progress(percent: number): ProgressInfo {
    return { total: 1000, delta: 10, transferred: percent * 10, percent, bytesPerSecond: 100 };
  }
}
