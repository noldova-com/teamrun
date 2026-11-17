/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { JsonObject } from "@noldova/context.json";
import { Resources as ProtocolResources } from "@noldova/teamrun.protocol";

export class WriteTargets {
  public readonly files: readonly string[];
  public readonly unnamedIn: readonly string[];

  public constructor(files: readonly string[], unnamedIn: readonly string[]) {
    this.files = files;
    this.unnamedIn = unnamedIn;
  }

  public toJson(): JsonObject {
    return { [ProtocolResources.writesField]: [...this.files], [ProtocolResources.unnamedWritesField]: [...this.unnamedIn] };
  }
}
