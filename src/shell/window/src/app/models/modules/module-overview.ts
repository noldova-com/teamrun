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
import { ModuleReference } from "./module-reference";

export class ModuleOverview {
  public readonly modules: readonly ModuleStatus[];

  public constructor(modules: readonly ModuleStatus[]) {
    this.modules = [...modules];
  }

  public select(id: string | null): ModuleStatus | null {
    return this.modules.find(t => t.id === id) ?? this.modules[0] ?? null;
  }

  public listDependencies(module: ModuleStatus): readonly ModuleReference[] {
    return module.dependencies.map(t => this.refer(t));
  }

  public listDependents(module: ModuleStatus): readonly ModuleReference[] {
    return this.modules.filter(t => t.dependencies.includes(module.id)).map(t => new ModuleReference(t.id, t));
  }

  public findBlocker(module: ModuleStatus): ModuleReference | null {
    return Object.isNull(module.blockedBy) ? null : this.refer(module.blockedBy);
  }

  private refer(id: string): ModuleReference {
    return new ModuleReference(id, this.modules.find(t => t.id === id) ?? null);
  }

  public static listContributions(module: ModuleStatus, titleOf: (kind: string, name: string) => string | null): readonly ContributionGroup[] {
    return Resources.moduleContributionKinds
      .map(([kind, title]) => new ContributionGroup(kind, title, module.listContributions(kind).map(t => new ContributionRow(t, titleOf(kind, t)))))
      .filter(t => t.rows.length > 0);
  }
}
