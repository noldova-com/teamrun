/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import PackageTarget from "../packaging/package-target.ts";
import ReleaseException from "./release.exception.ts";
import ReleaseSettings from "./release-settings.ts";

export default class SupportedTargets {
  public static async readAsync(root: string): Promise<readonly PackageTarget[]> {
    const settings = await ReleaseSettings.readAsync(root, SupportedTargets.formatInvalid());
    return SupportedTargets.parse("supportedTargets" in settings ? settings.supportedTargets : []);
  }

  private static parse(value: unknown): readonly PackageTarget[] {
    if (!Array.isArray(value))
      throw new ReleaseException(SupportedTargets.formatInvalid());
    const ids: readonly unknown[] = value;
    const targets = PackageTarget.listAll();
    if (new Set(ids).size !== ids.length || !ids.every(t => typeof t === "string" && targets.some(target => target.id === t)))
      throw new ReleaseException(SupportedTargets.formatInvalid());
    return targets.filter(t => ids.includes(t.id));
  }

  private static formatInvalid(): string {
    return `The root ${ReleaseSettings.FILE_NAME}'s teamrun.supportedTargets must list distinct targets among `
      + `${PackageTarget.listAll().map(t => t.id).join(", ")}.`;
  }
}
