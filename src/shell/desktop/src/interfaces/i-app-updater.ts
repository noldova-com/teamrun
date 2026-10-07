/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { Logger, ProgressInfo, UpdateInfo } from "electron-updater";

import type { FeedSource } from "../models/feed-source.js";
import type { FeedProvider } from "../services/feed-provider.js";

export interface IAppUpdater {
  autoDownload: boolean;
  autoInstallOnAppQuit: boolean;
  allowDowngrade: boolean;
  allowPrerelease: boolean;
  disableDifferentialDownload: boolean;
  disableWebInstaller: boolean;
  logger: Logger | null;
  updateConfigPath: string | null;
  isUpdateSupported: (info: UpdateInfo) => boolean | Promise<boolean>;
  setFeedURL(options: { readonly provider: "custom"; readonly updateProvider: typeof FeedProvider; readonly source: FeedSource }): void;
  checkForUpdates(): Promise<{ readonly isUpdateAvailable: boolean; readonly updateInfo: UpdateInfo } | null>;
  downloadUpdate(): Promise<string[]>;
  on(event: "download-progress", listener: (info: ProgressInfo) => void): unknown;
  removeListener(event: "download-progress", listener: (info: ProgressInfo) => void): unknown;
}
