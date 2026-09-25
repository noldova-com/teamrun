/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import electronUpdater, { type ResolvedUpdateFileInfo, type UpdateInfo } from "electron-updater";
import type { ProviderRuntimeOptions } from "electron-updater/out/providers/Provider.js";

import "@noldova/teamrun-foundation-core";

import { ReleaseUpdateInfo } from "../models/release-update-info.js";
import { Resources } from "../resources.js";

export class ReleaseUpdateProvider extends electronUpdater.Provider<UpdateInfo> {
  private readonly feedUrl: URL;
  private readonly target: string;

  // electron-updater constructs this provider from the options given to setFeedURL, typed only as a string-keyed record.
  public constructor(options: Readonly<Record<string, unknown>>, _updater: unknown, runtimeOptions: ProviderRuntimeOptions) {
    super(runtimeOptions);
    const url = options[Resources.releaseFeedUrlKey];
    const target = options[Resources.releaseFeedTargetKey];
    if (!Object.isString(url) || !Object.isString(target))
      throw new Error(Resources.updatesFeedMissing);

    this.feedUrl = new URL(url);
    this.target = target;
  }

  public async getLatestVersion(): Promise<UpdateInfo> {
    const text = await this.httpRequest(new URL(Resources.formatUpdateInfoName(this.target), this.feedUrl));
    if (Object.isNull(text))
      throw new Error(Resources.updateInfoInvalid);
    const info = ReleaseUpdateInfo.parse(text);
    return { version: info.version, files: [{ url: info.url, sha512: info.sha512, size: info.size }], path: info.url, sha512: info.sha512,
      releaseDate: info.releaseDate };
  }

  public resolveFiles(updateInfo: UpdateInfo): ResolvedUpdateFileInfo[] {
    return updateInfo.files.map(t => ({ url: new URL(t.url, this.feedUrl), info: t }));
  }
}
