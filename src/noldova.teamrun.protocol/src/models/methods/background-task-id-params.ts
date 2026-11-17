/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ArgumentException } from "@noldova/context.exceptions";
import { JsonReader, type JsonObject } from "@noldova/context.json";

import { Resources } from "../../resources.js";

export class BackgroundTaskIdParams {
  public readonly taskId: string;

  public constructor(taskId: string) {
    ArgumentException.throwIfNullOrWhitespace(taskId, Resources.taskIdField);

    this.taskId = taskId;
  }

  public static fromJson(value: unknown, path?: string): BackgroundTaskIdParams {
    return new BackgroundTaskIdParams(JsonReader.fromValue(value, path).readNonBlankString(Resources.taskIdField));
  }

  public toJson(): JsonObject {
    return { [Resources.taskIdField]: this.taskId };
  }
}
