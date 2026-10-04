/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { TestBed } from "@angular/core/testing";

import { ModuleState, ModuleStatus } from "@noldova/teamrun-shell-protocol";

import { ModuleStatusService } from "../../src/app/services/module-status.service";
import { Resources } from "../../src/resources";

export class ModuleStatusFixture {
  public static create(id: string, displayName: string, notificationKinds: readonly string[] = []): ModuleStatus {
    return new ModuleStatus(id, displayName, `${displayName} for the specs.`, [], new Map([[Resources.notificationsKind, notificationKinds]]), ModuleState.Active, null);
  }

  public static report(...modules: readonly ModuleStatus[]): void {
    TestBed.inject(ModuleStatusService).set(modules);
  }
}
