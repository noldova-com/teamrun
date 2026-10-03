/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { EventChannel } from "../models/event-channel.js";
import type { RuntimeCommand } from "../models/runtime-command.js";
import type { IMethodHandler } from "./method-handler.js";
import type { IModuleDatabase } from "./module-database.js";

export interface IRuntimePartContext {
  readonly moduleId: string;
  readonly moduleFolder: string;
  readonly database: IModuleDatabase;

  registerMethod(name: string, handler: IMethodHandler): void;

  declareEvent(name: string): EventChannel;

  registerCommand(command: RuntimeCommand): void;

  publishService(name: string, service: object): void;

  getService<T extends object>(name: string, type: abstract new (...args: never[]) => T): T;
}
