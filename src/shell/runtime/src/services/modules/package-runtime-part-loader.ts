/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/teamrun-foundation-core";

import { ModuleLoadException } from "../../exceptions/module-load.exception.js";
import type { IRuntimePart } from "../../interfaces/runtime-part.js";
import type { IRuntimePartLoader } from "../../interfaces/runtime-part-loader.js";
import { Resources } from "../../resources.js";

export class PackageRuntimePartLoader implements IRuntimePartLoader {
  public async loadAsync(packageName: string): Promise<IRuntimePart> {
    const exports: object = await import(packageName);
    const type = Resources.runtimePartExport in exports ? exports[Resources.runtimePartExport] : undefined;
    if (!Object.isFunction(type))
      throw new ModuleLoadException(Resources.runtimePartMissing);

    const part: unknown = Reflect.construct(type, []);
    if (!PackageRuntimePartLoader.isRuntimePart(part))
      throw new ModuleLoadException(Resources.runtimePartMissing);
    return part;
  }

  private static isRuntimePart(value: unknown): value is IRuntimePart {
    return Object.isObject(value)
      && Resources.activateMember in value
      && Object.isFunction(value[Resources.activateMember])
      && Resources.deactivateMember in value
      && Object.isFunction(value[Resources.deactivateMember]);
  }
}
