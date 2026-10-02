/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Injectable, inject } from "@angular/core";

import type { JsonObject, JsonValue } from "@noldova/teamrun-foundation-json";

import { Resources } from "../../resources";
import { DesktopBridgeException } from "../exceptions/desktop-bridge.exception";
import type { ILayoutStore } from "../interfaces/i-layout-store";
import { DesktopBridgeService } from "./desktop-bridge.service";

@Injectable({ providedIn: "root" })
export class LayoutStoreService implements ILayoutStore {
  private readonly bridge: DesktopBridgeService = inject(DesktopBridgeService);

  public readAsync(): Promise<JsonValue | null> {
    return this.bridge.readLayoutAsync();
  }

  public async writeAsync(layout: JsonObject): Promise<void> {
    if (!await this.bridge.writeLayoutAsync(layout))
      throw new DesktopBridgeException(Resources.layoutNotKept);
  }
}
