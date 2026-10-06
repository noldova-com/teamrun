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
  private static readonly SETTING: string = "supportedTargets";

  public static async readAsync(root: string): Promise<readonly PackageTarget[]> {
    return SupportedTargets.parse(await ReleaseSettings.readAsync(root, SupportedTargets.SETTING, SupportedTargets.formatInvalid()));
  }

  private static parse(value: unknown): readonly PackageTarget[] {
    const targets = PackageTarget.listAll();
    if (!Array.isArray(value) || new Set(value).size !== value.length || !value.every(t => targets.some(target => target.id === t)))
      throw new ReleaseException(SupportedTargets.formatInvalid());
    return targets.filter(t => value.includes(t.id));
  }

  private static formatInvalid(): string {
    return `The root ${ReleaseSettings.FILE_NAME}'s teamrun.${SupportedTargets.SETTING} must list distinct targets among `
      + `${PackageTarget.listAll().map(t => t.id).join(", ")}.`;
  }
}
