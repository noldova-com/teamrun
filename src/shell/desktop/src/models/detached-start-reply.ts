/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/teamrun-foundation-core";
import { ArgumentException, ExceptionOptions } from "@noldova/teamrun-foundation-exceptions";
import { JsonException, type JsonObject, JsonReader } from "@noldova/teamrun-foundation-json";
import { LaunchException } from "@noldova/teamrun-shell-runtime";

import { Resources } from "../resources.js";

export class DetachedStartReply {
  public readonly processId: number | null;
  public readonly failure: string | null;

  private constructor(processId: number | null, failure: string | null) {
    if (Object.isNull(processId) === Object.isNull(failure))
      throw new ArgumentException(Resources.replyNeedsOneOutcome, Resources.processIdField);

    this.processId = processId;
    this.failure = failure;
  }

  public static started(processId: number): DetachedStartReply {
    return new DetachedStartReply(processId, null);
  }

  public static failed(failure: string): DetachedStartReply {
    return new DetachedStartReply(null, failure);
  }

  public static fromJson(value: unknown): DetachedStartReply {
    const json = JsonReader.fromValue(value);
    const processId = json.readNullableInteger(Resources.processIdField);
    const failure = json.readNullableString(Resources.failureField);
    try {
      return new DetachedStartReply(processId, failure);
    }
    catch (error) {
      throw new JsonException(Resources.replyNeedsOneOutcome, json.path, new ExceptionOptions(error));
    }
  }

  public requireProcessId(): number {
    if (Object.isNull(this.processId))
      throw new LaunchException(Resources.formatStarterFailed(String(this.failure)));
    return this.processId;
  }

  public toJson(): JsonObject {
    return {
      [Resources.processIdField]: this.processId,
      [Resources.failureField]: this.failure
    };
  }
}
