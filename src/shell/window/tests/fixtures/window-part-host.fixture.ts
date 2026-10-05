/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { type Provider, type WritableSignal, signal } from "@angular/core";

import type { ContributionMatch } from "../../src/app/models/contribution-match";
import type { Tab } from "../../src/app/models/layout/tab";
import type { ModuleFailure } from "../../src/app/models/module-failure";
import { WindowPartHostService } from "../../src/app/services/window-part-host.service";

export class WindowPartHostFixture {
  public readonly generation: WritableSignal<number> = signal(0);
  public readonly failures: WritableSignal<readonly ModuleFailure[]> = signal([]);
  public readonly contributions: Map<string, ContributionMatch> = new Map();

  public static provide(): Provider {
    return { provide: WindowPartHostService, useValue: new WindowPartHostFixture() };
  }

  public findContribution(tab: Tab): ContributionMatch | null {
    return this.contributions.get(tab.key) ?? null;
  }

  public findFailure(): ModuleFailure | null {
    return null;
  }

  public revisionOf(): number {
    return 0;
  }
}
