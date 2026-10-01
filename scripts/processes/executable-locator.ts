/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { accessSync, constants, statSync } from "node:fs";
import path from "node:path";

export default class ExecutableLocator {
  private static readonly WINDOWS_PLATFORM: string = "win32";

  public static locate(name: string, platform: string = process.platform, searchPath: string = process.env["PATH"] ?? ""): string {
    if (platform === ExecutableLocator.WINDOWS_PLATFORM)
      return name;
    for (const directory of searchPath.split(path.delimiter)) {
      const candidate = path.join(directory, name);
      if (path.isAbsolute(directory) && ExecutableLocator.isExecutableFile(candidate))
        return candidate;
    }
    return name;
  }

  private static isExecutableFile(candidate: string): boolean {
    try {
      accessSync(candidate, constants.X_OK);
      return statSync(candidate).isFile();
    }
    catch {
      return false;
    }
  }
}
