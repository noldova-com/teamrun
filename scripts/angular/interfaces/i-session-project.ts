/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { ISessionBrowser } from "./i-session-browser.ts";

export interface ISessionProject {
  readonly browser?: ISessionBrowser;
}
