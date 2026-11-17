/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { JsonReader } from "@noldova/context.json";
import { SqlQuery } from "@noldova/context.data.sql";
import { BackgroundTask, BackgroundTaskStatus } from "@noldova/teamrun.protocol";

import type { ILog } from "../../interfaces/i-log.js";
import { Resources } from "../../resources.js";
import type { DatabaseContext } from "../database-context.js";

export class BackgroundTaskStore {
  private readonly context: DatabaseContext;
  private readonly log: ILog | null;

  public constructor(context: DatabaseContext, log: ILog | null) {
    this.context = context;
    this.log = log;
  }

  public async saveAsync(task: BackgroundTask): Promise<void> {
    try {
      await this.context.database.connection.executeAsync(new SqlQuery(Resources.saveBackgroundTask,
        [task.id, task.chatId, JSON.stringify(task.withoutOutput().toJson()), task.output]));
    }
    catch (error) {
      this.log?.write(Resources.formatBackgroundTaskNotSaved(task.id, Resources.formatFailureKind(error)));
    }
  }

  public async listAsync(chatId: string): Promise<readonly BackgroundTask[]> {
    return (await this.context.database.connection.queryAsync(new SqlQuery(Resources.selectBackgroundTasks, [chatId]))).flatMap(t => {
      try {
        const task = BackgroundTask.fromJson(JsonReader.parse(t.readString(Resources.jsonColumn)).toJson());
        return [task.isRunning ? task.withEnd(BackgroundTaskStatus.Stopped, null, task.startedAt) : task];
      }
      catch (error) {
        this.log?.write(Resources.formatBackgroundTaskSkipped(t.readString(Resources.idColumn), Resources.formatFailureKind(error)));
        return [];
      }
    });
  }

  public async readAsync(task: BackgroundTask): Promise<BackgroundTask> {
    const [row] = await this.context.database.connection.queryAsync(new SqlQuery(Resources.selectBackgroundTaskOutput, [task.id]));
    return new BackgroundTask(task.id, task.chatId, task.messageId, task.kind, task.command, task.status, task.exitCode, task.startedAt, task.endedAt,
      row?.readString(Resources.outputColumn) ?? String.empty, task.subAgentId);
  }

  public async deleteAsync(taskIds: readonly string[]): Promise<void> {
    try {
      await this.context.database.connection.runInTransactionAsync(async transaction => {
        for (const taskId of taskIds)
          await transaction.executeAsync(new SqlQuery(Resources.deleteBackgroundTask, [taskId]));
      });
    }
    catch (error) {
      this.log?.write(Resources.formatBackgroundTasksNotDeleted(Resources.formatFailureKind(error)));
    }
  }
}
