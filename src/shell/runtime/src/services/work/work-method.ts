/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { JsonValue } from "@noldova/teamrun-foundation-json";

import type { IMethodHandler } from "../../interfaces/method-handler.js";
import type { RequestContext } from "../../models/request-context.js";
import type { WorkTracker } from "./work-tracker.js";

export class WorkMethod implements IMethodHandler {
  private readonly work: WorkTracker;

  public constructor(work: WorkTracker) {
    this.work = work;
  }

  public handleAsync(_context: RequestContext): Promise<JsonValue> {
    return Promise.resolve(this.work.report.toJson());
  }
}
