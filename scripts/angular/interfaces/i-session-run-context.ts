/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { ISessionRun } from "./i-session-run.ts";

export interface ISessionRunContext {
  readonly vitest: ISessionRun;
}
