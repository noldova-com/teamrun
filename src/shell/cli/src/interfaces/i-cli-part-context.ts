/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { JsonValue } from "@noldova/teamrun-foundation-json";

import type { ICliCommandHandler } from "./i-cli-command-handler.js";

export interface ICliPartContext {
  readonly moduleId: string;

  registerCommand(name: string, handler: ICliCommandHandler): void;

  requestAsync(method: string, payload: JsonValue, signal: AbortSignal): Promise<JsonValue>;
}
