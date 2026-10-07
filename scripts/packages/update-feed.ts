/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export default class UpdateFeed {
  public static readonly OPTION: string = "--update-feed";
  private static readonly PROTOCOLS: ReadonlySet<string> = new Set(["http:", "https:"]);
  private static readonly SEPARATOR: string = "/";

  public static isValid(feed: string): boolean {
    return URL.canParse(feed) && UpdateFeed.PROTOCOLS.has(new URL(feed).protocol) && feed.endsWith(UpdateFeed.SEPARATOR);
  }

  public static ofRepository(repository: string): string {
    return `https://github.com/${repository}/releases/latest/download/`;
  }
}
