/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { ArgumentException } from "@noldova/context.exceptions";

import { Resources } from "../resources.js";

export class TaskStart {
  public readonly taskId: string;
  public readonly command: string;
  public readonly stop: () => Promise<void>;
  public readonly subAgentId: string | null;
  public readonly hasOwnStop: boolean;

  public constructor(taskId: string, command: string, stop: () => Promise<void>, subAgentId: string | null = null, hasOwnStop: boolean = true) {
    ArgumentException.throwIfNullOrWhitespace(taskId, Resources.taskIdParameterName);
    ArgumentException.throwIfNullOrWhitespace(command, Resources.commandParameterName);

    this.taskId = taskId;
    this.command = command;
    this.stop = stop;
    this.subAgentId = String.isNullOrWhitespace(subAgentId) ? null : subAgentId;
    this.hasOwnStop = hasOwnStop;
  }
}
