/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

import electronUpdater, { type CancellationToken, type NsisUpdater, type ProgressInfo } from "electron-updater";
import { app } from "electron";

import "@noldova/teamrun-foundation-core";

import type { IUpdateBackend } from "../interfaces/i-update-backend.js";
import type { UpdateSettings } from "../models/update-settings.js";
import { Resources } from "../resources.js";

export class ElectronUpdateBackend implements IUpdateBackend {
  private readonly settings: UpdateSettings;
  private readonly dataDirectory: string;
  private updater: NsisUpdater | null = null;
  private cancellation: CancellationToken | null = null;
  private disposed: boolean = false;

  public constructor(settings: UpdateSettings, dataDirectory: string) {
    this.settings = settings;
    this.dataDirectory = dataDirectory;
  }

  public async check(): Promise<string | null> {
    const updater = await this.getUpdater();
    const result = await updater.checkForUpdates();
    if (Object.isNull(result))
      throw new Error(Resources.updateCheckFailed);
    return result.isUpdateAvailable && !Resources.updatePrereleasePattern.test(result.updateInfo.version) ? result.updateInfo.version : null;
  }

  public async download(progress: (percent: number) => void): Promise<void> {
    const updater = await this.getUpdater();
    const token = new electronUpdater.CancellationToken();
    this.cancellation = token;
    const listener = (value: ProgressInfo): void => progress(value.percent);
    updater.on(Resources.updateProgressEvent, listener);
    try {
      await updater.downloadUpdate(token);
    }
    finally {
      updater.removeListener(Resources.updateProgressEvent, listener);
      this.cancellation = null;
    }
  }

  public dispose(): void {
    this.disposed = true;
    this.cancellation?.cancel();
  }

  public async install(): Promise<void> {
    if (!this.settings.allowInstallation)
      throw new Error(Resources.updateInstallDeferred);
    const updater = await this.getUpdater();
    return new Promise((resolve, reject) => {
      const cleanup = (): void => {
        clearTimeout(timer);
        updater.removeListener(Resources.updateErrorEvent, failed);
        app.removeListener(Resources.beforeQuitEvent, quitting);
      };
      const failed = (): void => { cleanup(); reject(new Error(Resources.updateInstallerFailed)); };
      const quitting = (): void => { cleanup(); resolve(); };
      const timer = setTimeout(failed, Resources.updateExitMilliseconds);
      updater.once(Resources.updateErrorEvent, failed);
      app.once(Resources.beforeQuitEvent, quitting);
      try {
        updater.installDirectory = dirname(process.execPath);
        updater.quitAndInstall(true, true);
      }
      catch {
        failed();
      }
    });
  }

  private async getUpdater(): Promise<NsisUpdater> {
    if (this.disposed || Object.isNull(this.settings.feedUrl))
      throw new Error(Resources.updatesFeedMissing);
    if (!Object.isNull(this.updater))
      return this.updater;

    const directory = join(this.dataDirectory, Resources.electronDirectoryName);
    const path = join(directory, Resources.updateConfigFileName);
    const cacheId = createHash(Resources.updateHashAlgorithm).update(this.dataDirectory).digest(Resources.updateHashEncoding);
    const config = { provider: Resources.updateProvider, url: this.settings.feedUrl, updaterCacheDirName: `${Resources.updateCachePrefix}${cacheId}` };
    await mkdir(directory, { recursive: true });
    await writeFile(path, JSON.stringify(config), Resources.utf8Encoding);
    if (this.disposed)
      throw new Error(Resources.updatesFeedMissing);

    const updater = new electronUpdater.NsisUpdater();
    updater.logger = null;
    updater.autoDownload = false;
    updater.autoInstallOnAppQuit = false;
    updater.allowPrerelease = false;
    updater.allowDowngrade = false;
    updater.disableWebInstaller = true;
    updater.updateConfigPath = path;
    this.updater = updater;
    return updater;
  }
}
