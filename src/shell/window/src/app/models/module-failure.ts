/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { ModuleState } from "@noldova/teamrun-shell-protocol";

export class ModuleFailure {
  public readonly moduleId: string;
  public readonly displayName: string;
  public readonly state: ModuleState;
  public readonly cause: string | null;
  public readonly viewNames: readonly string[];

  public constructor(moduleId: string, displayName: string, state: ModuleState, cause: string | null, viewNames: readonly string[]) {
    this.moduleId = moduleId;
    this.displayName = displayName;
    this.state = state;
    this.cause = cause;
    this.viewNames = [...viewNames];
  }
}
