/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Exception } from "@noldova/teamrun-foundation-exceptions";

import type { RuntimeLock } from "../models/runtime-lock.js";
import { Resources } from "../resources.js";

export class RuntimeAlreadyRunningException extends Exception {
  public readonly lock: RuntimeLock;

  public constructor(lock: RuntimeLock) {
    super(Resources.formatAlreadyRunning(lock.processId, lock.endpoint.describe()));

    this.lock = lock;
  }
}
