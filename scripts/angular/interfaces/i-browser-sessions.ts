/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { IBrowserSession } from "./i-browser-session.ts";
import type { ISessionProject } from "./i-session-project.ts";

export interface IBrowserSessions {
  createSession(sessionId: string, project: ISessionProject, ...rest: unknown[]): Promise<void>;
  getSession(sessionId: string): IBrowserSession | undefined;
}
