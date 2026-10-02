/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/teamrun-foundation-core";
import { ArgumentException } from "@noldova/teamrun-foundation-exceptions";

import type { SenderInfo } from "../models/sender-info.js";
import { Resources } from "../resources.js";

export class SenderPolicy {
  private readonly windowUrl: string;

  public constructor(windowUrl: string) {
    ArgumentException.throwIfNullOrWhitespace(windowUrl, Resources.windowUrlParameter);

    this.windowUrl = windowUrl;
  }

  public isTrusted(sender: SenderInfo): boolean {
    return sender.isTopLevel && this.isWindowUrl(sender.frameUrl);
  }

  public isWindowUrl(url: string): boolean {
    return url === this.windowUrl || url.startsWith(`${this.windowUrl}${Resources.hashPrefix}`) || url.startsWith(`${this.windowUrl}${Resources.queryPrefix}`);
  }
}
