/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { IBrowserSessions } from "./i-browser-sessions.ts";
import type { IVitestLogger } from "./i-vitest-logger.ts";

export interface ISessionRun {
  readonly logger: IVitestLogger;
  readonly _browserSessions?: IBrowserSessions;
}
