/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { EnvironmentInjector } from "@angular/core";

import type { IEmbeddedTerminal } from "./i-embedded-terminal";

export interface IEmbeddedTerminalOpener {
  open(sessionId: string, injector: EnvironmentInjector, maximumRows: number): IEmbeddedTerminal;
}
