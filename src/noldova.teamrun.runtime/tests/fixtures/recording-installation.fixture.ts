/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { type IProviderKindInstallation, ProviderKindVersions } from "@noldova/teamrun.core";

export class RecordingInstallation implements IProviderKindInstallation {
  public readonly unavailable: string | null = null;
  public readonly missingTool: string | null = null;
  public readonly isInstalled: boolean = true;
  public readonly checks: boolean[] = [];
  public read: Promise<ProviderKindVersions> = Promise.resolve(ProviderKindVersions.unknown);

  public readVersions(checksLatest: boolean): Promise<ProviderKindVersions> {
    this.checks.push(checksLatest);
    this.read = Promise.resolve(new ProviderKindVersions("1.0.0", checksLatest ? "1.0.1" : null));
    return this.read;
  }

  public install(_progress: (received: number, total: number) => void, _signal: AbortSignal, _commit: () => void): Promise<string> {
    return Promise.reject(new Error("The fixture installs nothing."));
  }
}
