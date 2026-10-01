/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

export default class ContentHash {
  private static readonly ALGORITHM: string = "sha256";
  private static readonly ENCODING: "hex" = "hex";
  private static readonly DEPENDENCY_FOLDER: string = "node_modules";
  private static readonly SEPARATOR: string = "\0";

  public static ofParts(parts: readonly string[]): string {
    const hash = createHash(ContentHash.ALGORITHM);
    for (const part of parts)
      hash.update(part).update(ContentHash.SEPARATOR);
    return hash.digest(ContentHash.ENCODING);
  }

  public static async ofFileAsync(file: string): Promise<string> {
    return createHash(ContentHash.ALGORITHM).update(await readFile(file)).digest(ContentHash.ENCODING);
  }

  public static async ofTreeAsync(directory: string): Promise<string> {
    const files = (await readdir(directory, { recursive: true, withFileTypes: true }))
      .filter(t => t.isFile())
      .map(t => path.relative(directory, path.join(t.parentPath, t.name)).split(path.sep).join("/"))
      .filter(t => !t.split("/").includes(ContentHash.DEPENDENCY_FOLDER))
      .sort();
    const parts: string[] = [];
    for (const file of files)
      parts.push(file, await ContentHash.ofFileAsync(path.join(directory, file)));
    return ContentHash.ofParts(parts);
  }
}
