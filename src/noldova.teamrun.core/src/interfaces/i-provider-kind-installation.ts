/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { ProviderKindVersions } from "../models/provider-kind-versions.js";

export interface IProviderKindInstallation {
  readonly unavailable: string | null;
  readonly missingTool: string | null;
  readonly isInstalled: boolean;
  readonly foundPath?: string | null;
  readonly notInstalledReason?: string | null;

  readVersions(checksLatest: boolean): Promise<ProviderKindVersions>;
  install(progress: (received: number, total: number) => void, signal: AbortSignal, commit: () => void): Promise<string>;
}
