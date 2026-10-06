/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { readFile } from "node:fs/promises";
import path from "node:path";

import ReleaseException from "./release.exception.ts";

export default class ReleaseSettings {
  public static readonly FILE_NAME: string = "package.json";

  public static async readAsync(root: string, name: string, invalid: string): Promise<unknown> {
    let manifest: unknown;
    try {
      manifest = JSON.parse(await readFile(path.join(root, ReleaseSettings.FILE_NAME), "utf8"));
    }
    catch (error) {
      throw new ReleaseException(invalid, { cause: error });
    }
    if (typeof manifest !== "object" || manifest === null || !("teamrun" in manifest))
      throw new ReleaseException(invalid);
    const settings = manifest.teamrun;
    if (typeof settings !== "object" || settings === null)
      throw new ReleaseException(invalid);
    return name in settings ? Reflect.get(settings, name) : [];
  }
}
