/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";

import { Resources } from "../resources.js";

export class ProviderKindVersions {
  public static readonly unknown: ProviderKindVersions = new ProviderKindVersions(null, null);

  public readonly installed: string | null;
  public readonly latest: string | null;

  public constructor(installed: string | null, latest: string | null) {
    this.installed = installed;
    this.latest = latest;
  }

  public get update(): string | null {
    if (Object.isNull(this.installed) || Object.isNull(this.latest))
      return this.latest;
    const installed = ProviderKindVersions.parts(this.installed);
    const latest = ProviderKindVersions.parts(this.latest);
    for (let index = 0; index < Math.max(installed.length, latest.length); index++) {
      const difference = (latest[index] ?? 0) - (installed[index] ?? 0);
      if (difference !== 0)
        return difference > 0 ? this.latest : null;
    }
    return null;
  }

  private static parts(version: string): readonly number[] {
    return version.split(Resources.versionSeparator).map(t => Number.parseInt(t, 10) || 0);
  }
}
