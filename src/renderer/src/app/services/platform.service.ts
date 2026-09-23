/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { DOCUMENT } from "@angular/common";
import { Injectable, inject } from "@angular/core";

import "@noldova/teamrun-foundation-core";

import { Resources } from "../resources";
import { BridgeService } from "./bridge.service";

@Injectable({ providedIn: "root" })
export class PlatformService {
  private readonly document: Document = inject(DOCUMENT);
  private readonly bridge: BridgeService = inject(BridgeService);

  public readonly ready: Promise<void> = this.bridge.describe().then(info => {
    if (!Object.isNull(info) && info.platform === Resources.macPlatform)
      this.document.documentElement.classList.add(Resources.macClass);
  });
}
