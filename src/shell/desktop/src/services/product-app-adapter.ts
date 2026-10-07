/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ElectronAppAdapter } from "electron-updater/out/ElectronAppAdapter.js";

import { RuntimeBuild } from "@noldova/teamrun-shell-runtime";

export class ProductAppAdapter extends ElectronAppAdapter {
  public override get version(): string {
    return RuntimeBuild.identity.productVersion;
  }
}
