/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { NotificationPost } from "@noldova/teamrun-shell-protocol";

import type { EventChannel } from "../models/event-channel.js";
import type { NotificationHandle } from "../models/notification-handle.js";
import type { OwnedProcess } from "../models/owned-process.js";
import type { ProcessRequest } from "../models/process-request.js";
import type { RuntimeCommand } from "../models/runtime-command.js";
import type { WorkItem } from "../models/work-item.js";
import type { IMethodHandler } from "./i-method-handler.js";
import type { IModuleDatabase } from "./i-module-database.js";
import type { IModuleLog } from "./i-module-log.js";
import type { IModuleSettings } from "./i-module-settings.js";

export interface IRuntimePartContext {
  readonly moduleId: string;
  readonly moduleFolder: string;
  readonly database: IModuleDatabase;

  readonly settings: IModuleSettings;

  readonly log: IModuleLog;

  getWorkFolderAsync(): Promise<string>;

  beginWork(description: string): WorkItem;

  startProcessAsync(request: ProcessRequest): Promise<OwnedProcess>;

  registerMethod(name: string, handler: IMethodHandler): void;

  declareEvent(name: string): EventChannel;

  registerCommand(command: RuntimeCommand): void;

  postNotification(post: NotificationPost): NotificationHandle;

  publishService(name: string, service: object): void;

  getService<T extends object>(name: string, type: abstract new (...args: never[]) => T): T;
}
