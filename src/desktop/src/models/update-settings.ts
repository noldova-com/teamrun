/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/teamrun-foundation-core";

import { Resources } from "../resources.js";

export class UpdateSettings {
  public readonly feedUrl: string | null;
  public readonly disabledReason: string | null;
  public readonly allowInstallation: boolean;
  public readonly isTestFeed: boolean;

  private constructor(feedUrl: string | null, disabledReason: string | null, allowInstallation: boolean = false, isTestFeed: boolean = false) {
    this.feedUrl = feedUrl;
    this.disabledReason = disabledReason;
    this.allowInstallation = allowInstallation;
    this.isTestFeed = isTestFeed;
  }

  public static fromEnvironment(environment: NodeJS.ProcessEnv, isPackaged: boolean, platform: string, architecture: string): UpdateSettings {
    if (!isPackaged)
      return new UpdateSettings(null, Resources.updatesDevelopmentDisabled);
    const value = environment[Resources.updateTestFeedVariable];
    if (Object.isUndefined(value) || String.isNullOrWhitespace(value))
      return platform === Resources.windowsPlatform && architecture === Resources.publicUpdateArchitecture
        ? new UpdateSettings(Resources.publicUpdateFeed, null, true)
        : new UpdateSettings(null, Resources.updatesPlatformDisabled);
    if (platform !== Resources.windowsPlatform || !Resources.updateArchitectures.includes(architecture))
      return new UpdateSettings(null, Resources.updatesPlatformDisabled);
    try {
      const url = new URL(value);
      if (url.protocol !== Resources.httpProtocol || !Resources.updateLoopbackHosts.includes(url.hostname)
        || !String.isNullOrEmpty(url.username) || !String.isNullOrEmpty(url.password)
        || !String.isNullOrEmpty(url.search) || !String.isNullOrEmpty(url.hash))
        return new UpdateSettings(null, Resources.updatesFeedInvalid);
      url.pathname = `${url.pathname.replace(Resources.updateTrailingSlashes, String.empty)}/${Resources.formatUpdateTarget(architecture)}/`;
      return new UpdateSettings(url.href, null, environment[Resources.updateTestInstallVariable] === Resources.enabledValue, true);
    }
    catch {
      return new UpdateSettings(null, Resources.updatesFeedInvalid);
    }
  }
}
