/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { ModuleStatus } from "@noldova/teamrun-shell-protocol";

import { Resources } from "../../../resources";
import { ContributionGroup } from "./contribution-group";
import { ContributionRow } from "./contribution-row";

export class ModuleOverview {
  public readonly modules: readonly ModuleStatus[];

  public constructor(modules: readonly ModuleStatus[]) {
    this.modules = [...modules];
  }

  public select(id: string | null): ModuleStatus | null {
    return this.modules.find(t => t.id === id) ?? this.modules[0] ?? null;
  }

  public listDependencies(module: ModuleStatus): readonly ModuleStatus[] {
    return module.dependencies.flatMap(t => this.modules.filter(u => u.id === t));
  }

  public listDependents(module: ModuleStatus): readonly ModuleStatus[] {
    return this.modules.filter(t => t.dependencies.includes(module.id));
  }

  public static listContributions(module: ModuleStatus, titleOf: (kind: string, name: string) => string | null): readonly ContributionGroup[] {
    return Resources.moduleContributionKinds
      .map(([kind, title]) => new ContributionGroup(kind, title, module.listContributions(kind).map(t => new ContributionRow(t, titleOf(kind, t)))))
      .filter(t => t.rows.length > 0);
  }
}
