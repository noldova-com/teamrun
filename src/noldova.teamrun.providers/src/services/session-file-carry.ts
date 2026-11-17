/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { copyFile, mkdir, rename, rm, stat } from "node:fs/promises";
import { dirname, join, relative } from "node:path";

import "@noldova/context.core";

import { Resources } from "../resources.js";

export class SessionFileCarry {
  public static async copy(from: string, to: string, file: string): Promise<boolean> {
    const target = join(to, relative(from, file));
    const temporary = target + Resources.sessionCopyExtension;
    await mkdir(dirname(target), { recursive: true });
    try {
      await copyFile(file, temporary);
      const [source, copy] = await Promise.all([stat(file), stat(temporary)]);
      return source.size === copy.size && await rename(temporary, target).then(() => true);
    }
    finally {
      await rm(temporary, { force: true });
    }
  }
}
