/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { readFile } from "node:fs/promises";
import path from "node:path";

import PackageTarget from "../packaging/package-target.ts";
import ReleaseException from "./release.exception.ts";

export default class SupportedTargets {
  private static readonly FILE_NAME: string = "package.json";

  public static async readAsync(root: string): Promise<readonly PackageTarget[]> {
    let manifest: unknown;
    try {
      manifest = JSON.parse(await readFile(path.join(root, SupportedTargets.FILE_NAME), "utf8"));
    }
    catch (error) {
      throw new ReleaseException(SupportedTargets.formatInvalid(), { cause: error });
    }
    if (typeof manifest !== "object" || manifest === null || !("teamrun" in manifest))
      throw new ReleaseException(SupportedTargets.formatInvalid());
    const settings = manifest.teamrun;
    if (typeof settings !== "object" || settings === null)
      throw new ReleaseException(SupportedTargets.formatInvalid());
    return SupportedTargets.parse("supportedTargets" in settings ? settings.supportedTargets : []);
  }

  private static parse(value: unknown): readonly PackageTarget[] {
    const targets = PackageTarget.listAll();
    if (!Array.isArray(value) || new Set(value).size !== value.length || !value.every(t => targets.some(target => target.id === t)))
      throw new ReleaseException(SupportedTargets.formatInvalid());
    return targets.filter(t => value.includes(t.id));
  }

  private static formatInvalid(): string {
    return `The root ${SupportedTargets.FILE_NAME}'s teamrun.supportedTargets must list distinct targets among `
      + `${PackageTarget.listAll().map(t => t.id).join(", ")}.`;
  }
}
