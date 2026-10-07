/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { mkdir, rm, writeFile } from "node:fs/promises";
import { basename, dirname, join } from "node:path";

import { CancellationToken, type ProgressInfo } from "electron-updater";

import "@noldova/teamrun-foundation-core";
import { ExceptionOptions } from "@noldova/teamrun-foundation-exceptions";

import { UpdateException } from "../exceptions/update.exception.js";
import type { IAppUpdater } from "../interfaces/i-app-updater.js";
import type { IUpdater } from "../interfaces/i-updater.js";
import type { FeedSource } from "../models/feed-source.js";
import { Resources } from "../resources.js";
import { FeedProvider } from "./feed-provider.js";

export class FeedUpdater implements IUpdater {
  private readonly updater: IAppUpdater;
  private readonly source: FeedSource;
  private readonly configFile: string;
  private readonly configuration: string;
  private readonly verifyAsync: ((file: string) => Promise<string | null>) | null;
  private readonly log: (text: string) => void;
  private cancellation: CancellationToken | null = null;
  private isConfigured: boolean = false;
  private downloaded: string | null = null;

  public readonly packagePath: string;

  public constructor(
    updater: IAppUpdater,
    source: FeedSource,
    installationFolder: string,
    cacheRoot: string,
    productSlug: string,
    verifyAsync: ((file: string) => Promise<string | null>) | null,
    log: (text: string) => void) {
    const cacheFolder = Resources.formatUpdateCacheFolder(productSlug, basename(installationFolder));
    this.updater = updater;
    this.source = source;
    this.configFile = join(installationFolder, Resources.updateConfigFile);
    this.configuration = JSON.stringify({ [Resources.updaterCacheFolderField]: cacheFolder });
    this.verifyAsync = verifyAsync;
    this.log = log;
    this.packagePath = join(cacheRoot, cacheFolder, Resources.pendingUpdateFolder, source.packageFile);
    updater.autoDownload = false;
    updater.autoInstallOnAppQuit = false;
    updater.allowDowngrade = false;
    updater.allowPrerelease = false;
    updater.disableDifferentialDownload = true;
    updater.disableWebInstaller = true;
    updater.logger = { info: () => undefined, warn: (message: unknown) => log(Resources.formatUpdaterMessage(String(message))), error: (message: unknown) => log(Resources.formatUpdaterMessage(String(message))) };
    updater.isUpdateSupported = info => !info.version.includes(Resources.prereleaseSeparator);
  }

  public get downloadedFile(): string | null {
    return this.downloaded;
  }

  public async checkAsync(): Promise<string | null> {
    try {
      await this.configureAsync();
      const result = await this.updater.checkForUpdates();
      return Object.isNull(result) || !result.isUpdateAvailable ? null : result.updateInfo.version;
    }
    catch (error) {
      throw FeedUpdater.explain(error, Resources.updateFailedUnexpectedly);
    }
  }

  public async downloadAsync(onProgress: (percent: number) => void): Promise<string> {
    const listener = (info: ProgressInfo): void => onProgress(Math.floor(info.percent));
    const cancellation = new CancellationToken();
    this.cancellation = cancellation;
    this.downloaded = null;
    this.updater.on(Resources.downloadProgressEvent, listener);
    try {
      const [file] = await this.updater.downloadUpdate(cancellation);
      if (Object.isUndefined(file))
        throw new UpdateException(Resources.updateDownloadInterrupted);
      if (file !== this.packagePath)
        throw new UpdateException(Resources.updateFailedUnexpectedly);
      await this.verifyPublisherAsync(file);
      this.downloaded = file;
      return file;
    }
    catch (error) {
      throw FeedUpdater.explain(error, Resources.updateDownloadInterrupted);
    }
    finally {
      this.updater.removeListener(Resources.downloadProgressEvent, listener);
      this.cancellation = null;
    }
  }

  public cancel(): void {
    this.cancellation?.cancel();
  }

  private async verifyPublisherAsync(file: string): Promise<void> {
    if (Object.isNull(this.verifyAsync) || Object.isNull(await this.verifyAsync(file)))
      return;
    await rm(file, { force: true }).catch((error: unknown) => this.log(Resources.formatUpdateNotDeleted(String(error))));
    throw new UpdateException(Resources.updateNotSigned);
  }

  private static explain(error: unknown, otherwise: string): UpdateException {
    if (error instanceof UpdateException)
      return error;
    const code = Object.isObject(error) ? Reflect.get(error, Resources.errorCodeField) : undefined;
    return new UpdateException(Resources.updateFailureReasons.get(String(code)) ?? otherwise, new ExceptionOptions(error));
  }

  private async configureAsync(): Promise<void> {
    if (this.isConfigured)
      return;
    await mkdir(dirname(this.configFile), { recursive: true });
    await writeFile(this.configFile, this.configuration, Resources.textEncoding);
    this.updater.updateConfigPath = this.configFile;
    this.updater.setFeedURL({ provider: Resources.customProvider, updateProvider: FeedProvider, source: this.source });
    this.isConfigured = true;
  }
}
