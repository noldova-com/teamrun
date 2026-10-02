/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { JsonValue } from "@noldova/teamrun-foundation-json";
import { Failure, FailureCode, RunningWork, StopPolicy, StopRequest } from "@noldova/teamrun-shell-protocol";

import { MethodFailureException } from "../../exceptions/method-failure.exception.js";
import type { IMethodHandler } from "../../interfaces/method-handler.js";
import type { RequestContext } from "../../models/request-context.js";
import { Resources } from "../../resources.js";
import type { WorkTracker } from "../work/work-tracker.js";

export class StopMethod implements IMethodHandler {
  private readonly work: WorkTracker;
  private readonly stop: (reason: string) => void;

  public constructor(work: WorkTracker, stop: (reason: string) => void) {
    this.work = work;
    this.stop = stop;
  }

  public handleAsync(context: RequestContext): Promise<JsonValue> {
    const request = StopRequest.fromJson(context.payload);
    if (request.policy === StopPolicy.IfIdle && !this.work.isEmpty)
      return Promise.reject(new MethodFailureException(new Failure(FailureCode.Conflict, Resources.workInProgress, new RunningWork(this.work.descriptions).toJson())));

    this.work.cancelAll();
    setImmediate(() => this.stop(Resources.stoppedByRequest));
    return Promise.resolve(null);
  }
}
