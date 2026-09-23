/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/teamrun-foundation-core";

import type { DesktopSettings } from "../models/desktop-settings.js";
import type { SenderInfo } from "../models/sender-info.js";
import { Resources } from "../resources.js";

export class SenderPolicy {
  private readonly settings: DesktopSettings;

  public constructor(settings: DesktopSettings) {
    this.settings = settings;
  }

  public isTrusted(sender: SenderInfo): boolean {
    if (!sender.isTopLevel)
      return false;

    const origin = this.settings.rendererOrigin;
    if (this.settings.usesDevelopmentServer) {
      const url = URL.parse(sender.frameUrl);
      return !Object.isNull(url)
        && (url.protocol === Resources.httpProtocol || url.protocol === Resources.httpsProtocol)
        && url.origin === origin;
    }

    return sender.frameUrl === origin
      || sender.frameUrl.startsWith(`${origin}${Resources.hashPrefix}`)
      || sender.frameUrl.startsWith(`${origin}${Resources.queryPrefix}`);
  }

  public allowsPermission(sender: SenderInfo, permission: string): boolean {
    return permission === Resources.clipboardWritePermission && this.isTrusted(sender);
  }
}
