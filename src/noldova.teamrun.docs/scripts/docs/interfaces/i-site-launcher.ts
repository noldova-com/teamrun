/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { ISiteBrowser } from "./i-site-browser.ts";

export interface ISiteLauncher {
  launch(): Promise<ISiteBrowser>;
}
