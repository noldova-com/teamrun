/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { createHash } from "node:crypto";

import { Resources } from "../resources.js";

export class WorkFolder {
  public readonly id: string;
  public readonly path: string;

  public constructor(id: string, path: string) {
    this.id = id;
    this.path = path;
  }

  public static attached(path: string): WorkFolder {
    const key = process.platform === "win32" ? path.toLowerCase() : path;
    return new WorkFolder(Resources.formatAttachedFolderId(createHash("sha256").update(key).digest("hex").slice(0, 32)), path);
  }
}
