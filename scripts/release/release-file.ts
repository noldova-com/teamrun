/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { lstat } from "node:fs/promises";
import path from "node:path";

import PackageException from "../packaging/package.exception.ts";

export default class ReleaseFile {
  public readonly path: string;
  public readonly name: string;
  public readonly size: number;
  public readonly sha256: string;
  public readonly sha512: string;

  private constructor(filename: string, size: number, sha256: string, sha512: string) {
    this.path = filename;
    this.name = path.basename(filename);
    this.size = size;
    this.sha256 = sha256;
    this.sha512 = sha512;
  }

  public static async read(filename: string): Promise<ReleaseFile> {
    const stat = await lstat(filename);
    if (!stat.isFile() || stat.size === 0)
      throw new PackageException(`Release asset must be a non-empty regular file: ${filename}`);
    const sha256 = createHash("sha256");
    const sha512 = createHash("sha512");
    for await (const chunk of createReadStream(filename)) {
      sha256.update(chunk);
      sha512.update(chunk);
    }
    return new ReleaseFile(filename, stat.size, sha256.digest("hex"), sha512.digest("base64"));
  }
}
