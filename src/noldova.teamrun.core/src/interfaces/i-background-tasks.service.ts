/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type {
  BackgroundTask,
  BackgroundTaskIdParams,
  BackgroundTaskListParams,
  BackgroundTaskPage,
  BackgroundTasksClearedPayload,
  ConversationIdParams
} from "@noldova/teamrun.protocol";

import type { TaskEnd } from "../models/task-end.js";
import type { TaskStart } from "../models/task-start.js";

export interface IBackgroundTasksService {
  startAsync(conversationId: string, messageId: string, kind: string, start: TaskStart, teammateId?: string | null): Promise<BackgroundTask | null>;
  write(messageId: string, taskId: string, text: string): void;
  endAsync(messageId: string, end: TaskEnd): Promise<void>;
  listAsync(params: ConversationIdParams): Promise<readonly BackgroundTask[]>;
  pageAsync(params: BackgroundTaskListParams): Promise<BackgroundTaskPage>;
  readAsync(params: BackgroundTaskIdParams): Promise<BackgroundTask>;
  stop(params: BackgroundTaskIdParams): Promise<BackgroundTask>;
  clearFinishedAsync(params: ConversationIdParams): Promise<BackgroundTasksClearedPayload>;
  forget(conversationIds: readonly string[]): void;
  stopTeammate(teammateId: string, conversationId: string | null): void;
}
