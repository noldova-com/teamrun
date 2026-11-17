/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ArgumentOutOfRangeException } from "@noldova/context.exceptions";
import { JsonReader, type JsonObject } from "@noldova/context.json";

import { Resources } from "../../resources.js";
import { BackgroundTask } from "../background-task.js";

export class BackgroundTaskPage {
  public readonly tasks: readonly BackgroundTask[];
  public readonly hasLater: boolean;
  public readonly count: number;

  public constructor(tasks: readonly BackgroundTask[], hasLater: boolean, count: number) {
    if (!Number.isInteger(count) || count < 0)
      throw new ArgumentOutOfRangeException(Resources.countField, count);

    this.tasks = [...tasks];
    this.hasLater = hasLater;
    this.count = count;
  }

  public static fromJson(value: unknown, path?: string): BackgroundTaskPage {
    const reader = JsonReader.fromValue(value, path);
    return new BackgroundTaskPage(reader.readObjectArray(Resources.tasksField).map(t => BackgroundTask.fromJson(t.toJson(), t.path)),
      reader.readBoolean(Resources.hasLaterField), reader.readInteger(Resources.countField));
  }

  public toJson(): JsonObject {
    return {
      [Resources.tasksField]: this.tasks.map(t => t.toJson()),
      [Resources.hasLaterField]: this.hasLater,
      [Resources.countField]: this.count
    };
  }
}
