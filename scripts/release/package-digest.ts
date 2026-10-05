/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { finished } from "node:stream/promises";

export default class PackageDigest {
  private static readonly SHA256: string = "sha256";
  private static readonly SHA512: string = "sha512";

  public readonly sha256: string;
  public readonly sha512: string;
  public readonly size: number;

  public constructor(sha256: string, sha512: string, size: number) {
    this.sha256 = sha256;
    this.sha512 = sha512;
    this.size = size;
  }

  public static async readAsync(file: string): Promise<PackageDigest> {
    const sha256 = createHash(PackageDigest.SHA256);
    const sha512 = createHash(PackageDigest.SHA512);
    let size = 0;
    const stream = createReadStream(file);
    stream.on("data", (t: Buffer) => {
      sha256.update(t);
      sha512.update(t);
      size += t.length;
    });
    await finished(stream);
    return new PackageDigest(sha256.digest("hex"), sha512.digest("base64"), size);
  }
}
