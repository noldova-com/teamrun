/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/teamrun-foundation-core";

import { Resources } from "../resources.js";

export class LinkPolicy {
  public static findAllowed(url: unknown): string | null {
    if (!Object.isString(url) || url.length > Resources.linkLimit || !URL.canParse(url))
      return null;
    const parsed = new URL(url);
    if (!Resources.linkProtocols.includes(parsed.protocol) || parsed.username.length > 0 || parsed.password.length > 0)
      return null;
    return parsed.href;
  }
}
