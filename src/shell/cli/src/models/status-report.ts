/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { JsonObject } from "@noldova/teamrun-foundation-json";
import type { BuildIdentity, ModuleStatusList, WorkReport } from "@noldova/teamrun-shell-protocol";

export class StatusReport {
  public readonly identity: BuildIdentity;
  public readonly dataDirectory: string;
  public readonly modules: ModuleStatusList;
  public readonly work: WorkReport;

  public constructor(identity: BuildIdentity, dataDirectory: string, modules: ModuleStatusList, work: WorkReport) {
    this.identity = identity;
    this.dataDirectory = dataDirectory;
    this.modules = modules;
    this.work = work;
  }

  public toJson(): JsonObject {
    return {
      build: this.identity.toJson(),
      dataDirectory: this.dataDirectory,
      modules: this.modules.toJson()["modules"] ?? [],
      work: [...this.work.descriptions]
    };
  }
}
