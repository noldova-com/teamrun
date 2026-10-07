/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { URL } from "node:url";

import { Provider, type ResolvedUpdateFileInfo, type UpdateFileInfo, type UpdateInfo } from "electron-updater";
import { type ProviderRuntimeOptions, parseUpdateInfo } from "electron-updater/out/providers/Provider.js";

import "@noldova/teamrun-foundation-core";
import { ArgumentException, ExceptionOptions } from "@noldova/teamrun-foundation-exceptions";

import { UpdateException } from "../exceptions/update.exception.js";
import { FeedSource } from "../models/feed-source.js";
import { Resources } from "../resources.js";

export class FeedProvider extends Provider<UpdateInfo> {
  private readonly source: FeedSource;
  private base: URL | null = null;

  public constructor(options: Readonly<Record<string, unknown>>, _updater: unknown, runtimeOptions: ProviderRuntimeOptions) {
    super(runtimeOptions);
    const source = options[Resources.feedSourceOption];
    if (!(source instanceof FeedSource))
      throw new ArgumentException(Resources.feedSourceMissing, Resources.feedSourceOption);
    this.source = source;
  }

  public async getLatestVersion(): Promise<UpdateInfo> {
    const requested = new URL(this.source.channelFile, this.source.feed);
    const signal = AbortSignal.timeout(Resources.updateFeedTimeout);
    const response = await FeedProvider.reach(this.source.fetchAsync(requested.href, signal));
    if (!response.ok)
      throw new UpdateException(Resources.formatUpdateFeedRefused(response.status));
    const url = response.url.length > 0 ? new URL(response.url) : requested;
    if (url.protocol !== requested.protocol)
      throw new UpdateException(Resources.updateFeedRedirected);
    const info = FeedProvider.parse(await FeedProvider.reach(response.text()), this.source.channelFile, url);
    if (!FeedProvider.isUpdateInfo(info) || Object.isUndefined(FeedProvider.findPackage(info, this.source.packageFile)))
      throw new UpdateException(Resources.updateInfoInvalid);
    this.base = url;
    return info;
  }

  public resolveFiles(updateInfo: UpdateInfo): ResolvedUpdateFileInfo[] {
    const file = FeedProvider.findPackage(updateInfo, this.source.packageFile);
    if (Object.isNull(this.base) || Object.isUndefined(file))
      throw new UpdateException(Resources.updateInfoInvalid);
    return [{ url: new URL(this.source.packageFile, this.base), info: file }];
  }

  private static async reach<T>(operation: Promise<T>): Promise<T> {
    try {
      return await operation;
    }
    catch (error) {
      throw new UpdateException(Resources.updateFeedUnreachable, new ExceptionOptions(error));
    }
  }

  private static parse(text: string, channelFile: string, url: URL): unknown {
    try {
      return parseUpdateInfo(text, channelFile, url);
    }
    catch (error) {
      throw new UpdateException(Resources.updateInfoInvalid, new ExceptionOptions(error));
    }
  }

  private static isUpdateInfo(value: unknown): value is UpdateInfo {
    return Object.isObject(value) && Object.isString(Reflect.get(value, Resources.updateVersionField)) && Array.isArray(Reflect.get(value, Resources.updateFilesField));
  }

  private static findPackage(info: UpdateInfo, packageFile: string): UpdateFileInfo | undefined {
    return info.files.find(t => Object.isObject(t) && t.url === packageFile && Object.isString(t.sha512) && t.sha512.length > 0 && Number.isInteger(t.size) && Number(t.size) > 0);
  }
}
