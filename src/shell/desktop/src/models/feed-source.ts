/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/teamrun-foundation-core";

import type { IFeedResponse } from "../interfaces/i-feed-response.js";
import { Resources } from "../resources.js";

export class FeedSource {
  public readonly feed: string;
  public readonly channelFile: string;
  public readonly packageFile: string;
  public readonly fetchAsync: (url: string) => Promise<IFeedResponse>;

  public constructor(feed: string, channelFile: string, packageFile: string, fetchAsync: (url: string) => Promise<IFeedResponse>) {
    this.feed = feed;
    this.channelFile = channelFile;
    this.packageFile = packageFile;
    this.fetchAsync = fetchAsync;
  }

  public static create(feed: string | null, productName: string, platform: string, architecture: string, fetchAsync: (url: string) => Promise<IFeedResponse>): FeedSource | null {
    const target = Resources.updateTargets.get(platform);
    if (Object.isNull(feed) || Object.isUndefined(target) || !Resources.updateArchitectures.includes(architecture))
      return null;
    const [name, extension] = target;
    return new FeedSource(feed, Resources.formatChannelFile(name, architecture), Resources.formatPackageFile(productName, name, architecture, extension), fetchAsync);
  }
}
