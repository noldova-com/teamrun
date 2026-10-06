/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/teamrun-foundation-core";
import { Exception } from "@noldova/teamrun-foundation-exceptions";
import type { JsonObject } from "@noldova/teamrun-foundation-json";

import { Resources } from "../resources.js";

export class ModuleNotActiveException extends Exception {
  public override readonly name: string = "ModuleNotActiveException";
  public readonly moduleId: string;
  public readonly reason: string;
  public readonly blockedBy: string | null;

  public constructor(moduleId: string, reason: string, blockedBy: string | null = null) {
    super(Resources.formatModuleNotActive(moduleId, reason));
    this.moduleId = moduleId;
    this.reason = reason;
    this.blockedBy = blockedBy;
  }

  public toJson(): JsonObject {
    return Object.isNull(this.blockedBy)
      ? { module: this.moduleId, cause: this.reason }
      : { module: this.moduleId, cause: this.reason, blockedBy: this.blockedBy };
  }
}
