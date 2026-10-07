/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export default class UpdateFeed {
  public static readonly OPTION: string = "--update-feed";
  private static readonly SECURE_PROTOCOL: string = "https:";
  private static readonly LOCAL_PROTOCOL: string = "http:";
  private static readonly LOCAL_HOSTS: ReadonlySet<string> = new Set(["localhost", "127.0.0.1", "[::1]"]);
  private static readonly SEPARATOR: string = "/";

  public static isValid(feed: string): boolean {
    if (!URL.canParse(feed) || !feed.endsWith(UpdateFeed.SEPARATOR))
      return false;
    const url = new URL(feed);
    return url.protocol === UpdateFeed.SECURE_PROTOCOL || (url.protocol === UpdateFeed.LOCAL_PROTOCOL && UpdateFeed.LOCAL_HOSTS.has(url.hostname));
  }

  public static ofRepository(repository: string): string {
    return `https://github.com/${repository}/releases/latest/download/`;
  }
}
