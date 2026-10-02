/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { JsonReader, type JsonObject } from "@noldova/teamrun-foundation-json";

import { Resources } from "../resources.js";
import { WireContract } from "../services/wire-contract.js";
import { ModuleStatus } from "./module-status.js";

export class ModuleStatusList {
  public readonly modules: readonly ModuleStatus[];

  public constructor(modules: readonly ModuleStatus[]) {
    this.modules = [...modules];
  }

  public static fromJson(value: unknown, path?: string): ModuleStatusList {
    const reader = JsonReader.fromValue(value, path);
    return WireContract.create(reader, () => new ModuleStatusList(reader.readObjectArray(Resources.modulesField).map(t => ModuleStatus.fromJson(t.toJson(), t.path))));
  }

  public toJson(): JsonObject {
    return { [Resources.modulesField]: this.modules.map(t => t.toJson()) };
  }
}
