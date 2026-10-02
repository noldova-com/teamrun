/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/teamrun-foundation-core";
import type { JsonObject } from "@noldova/teamrun-foundation-json";

import { Resources } from "../../../resources";
import { Tab } from "./tab";
import type { ViewRegistry } from "./view-registry";

export class DocumentTab extends Tab {
  public constructor(name: string, instance?: string) {
    super(Resources.documentField, name, instance);
  }

  public override get isMovable(): boolean {
    return false;
  }

  public override isAvailable(registry: ViewRegistry): boolean {
    return registry.hasDocument(this.name);
  }

  public override toJson(): JsonObject {
    return Object.isUndefined(this.instance)
      ? { [Resources.documentField]: this.name }
      : { [Resources.documentField]: this.name, [Resources.instanceField]: this.instance };
  }
}
