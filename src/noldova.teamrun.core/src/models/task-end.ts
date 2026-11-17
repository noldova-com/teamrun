/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { ArgumentException } from "@noldova/context.exceptions";
import { BackgroundTaskStatus } from "@noldova/teamrun.protocol";

import { Resources } from "../resources.js";

export class TaskEnd {
  public readonly taskId: string;
  public readonly status: BackgroundTaskStatus;
  public readonly exitCode: number | null;

  public constructor(taskId: string, status: BackgroundTaskStatus, exitCode: number | null = null) {
    ArgumentException.throwIfNullOrWhitespace(taskId, Resources.taskIdParameterName);
    if (status === BackgroundTaskStatus.Running)
      throw new ArgumentException(Resources.taskEndRunning, Resources.statusParameterName);

    this.taskId = taskId;
    this.status = status;
    this.exitCode = exitCode;
  }
}
