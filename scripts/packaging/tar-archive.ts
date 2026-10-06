/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { gunzipSync } from "node:zlib";

export default class TarArchive {
  private static readonly BLOCK_SIZE: number = 512;
  private static readonly NAME_END: number = 100;
  private static readonly SIZE_START: number = 124;
  private static readonly SIZE_END: number = 136;
  private static readonly TYPE_START: number = 156;
  private static readonly PREFIX_START: number = 345;
  private static readonly PREFIX_END: number = 500;
  private static readonly OCTAL: number = 8;
  private static readonly NUL: string = String.fromCharCode(0);
  private static readonly FILE_TYPES: readonly string[] = ["0", ""];
  private static readonly SEPARATOR: string = "/";
  private static readonly TOP_LEVEL_FILE: RegExp = /^[^/]+\/([^/]+)$/;

  public readonly topLevelFiles: ReadonlyMap<string, Buffer>;

  private constructor(topLevelFiles: ReadonlyMap<string, Buffer>) {
    this.topLevelFiles = topLevelFiles;
  }

  public static fromGzip(data: Buffer): TarArchive {
    const archive = gunzipSync(data);
    const files = new Map<string, Buffer>();
    let offset = 0;
    while (offset + TarArchive.BLOCK_SIZE <= archive.length && archive[offset] !== 0) {
      const header = archive.subarray(offset, offset + TarArchive.BLOCK_SIZE);
      const size = Number.parseInt(TarArchive.readText(header, TarArchive.SIZE_START, TarArchive.SIZE_END).trim(), TarArchive.OCTAL);
      const start = offset + TarArchive.BLOCK_SIZE;
      const name = [TarArchive.readText(header, TarArchive.PREFIX_START, TarArchive.PREFIX_END), TarArchive.readText(header, 0, TarArchive.NAME_END)]
        .filter(t => t.length > 0).join(TarArchive.SEPARATOR);
      const topLevel = TarArchive.TOP_LEVEL_FILE.exec(name);
      if (topLevel !== null && TarArchive.FILE_TYPES.includes(TarArchive.readText(header, TarArchive.TYPE_START, TarArchive.TYPE_START + 1)))
        files.set(String(topLevel[1]), archive.subarray(start, start + size));
      offset = start + Math.ceil(size / TarArchive.BLOCK_SIZE) * TarArchive.BLOCK_SIZE;
    }
    return new TarArchive(files);
  }

  private static readText(header: Buffer, start: number, end: number): string {
    return header.subarray(start, end).toString("utf8").split(TarArchive.NUL, 1).join("");
  }
}
