/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { readFile } from "node:fs/promises";
import zlib from "node:zlib";

import { PackageException } from "./package.exception.ts";

export class ArchiveReader {
  private static readonly BLOCK: number = 512;
  private static readonly NAME_END: number = 100;
  private static readonly SIZE_START: number = 124;
  private static readonly SIZE_END: number = 136;
  private static readonly TYPE_AT: number = 156;
  private static readonly PREFIX_START: number = 345;
  private static readonly PREFIX_END: number = 500;
  private static readonly SIZE_RADIX: number = 8;
  private static readonly FILE_TYPES: readonly string[] = ["0", "\0"];
  private static readonly EXTENDED_TYPE: string = "x";
  private static readonly PATH_RECORD: RegExp = /^\d+ path=(.*)$/m;
  private static readonly FIELD_END: RegExp = /\0.*$/s;

  public async readAsync(archive: string): Promise<ReadonlyMap<string, Buffer>> {
    let tar: Buffer;
    try {
      tar = zlib.gunzipSync(await readFile(archive));
    }
    catch (error) {
      throw new PackageException(`${archive} could not be read as a gzipped archive.`, { cause: error });
    }

    const files = new Map<string, Buffer>();
    let extendedName: string | null = null;
    for (let offset = 0; offset + ArchiveReader.BLOCK <= tar.length && tar[offset] !== 0;) {
      const header = tar.subarray(offset, offset + ArchiveReader.BLOCK);
      const size = Number.parseInt(ArchiveReader.readField(header, ArchiveReader.SIZE_START, ArchiveReader.SIZE_END).trim(), ArchiveReader.SIZE_RADIX);
      if (!Number.isInteger(size) || offset + ArchiveReader.BLOCK + size > tar.length)
        throw new PackageException(`${archive} has a malformed or truncated entry at offset ${offset}.`);
      const content = tar.subarray(offset + ArchiveReader.BLOCK, offset + ArchiveReader.BLOCK + size);
      const type = header.toString("latin1", ArchiveReader.TYPE_AT, ArchiveReader.TYPE_AT + 1);
      if (type === ArchiveReader.EXTENDED_TYPE)
        extendedName = ArchiveReader.PATH_RECORD.exec(content.toString("utf8"))?.[1] ?? null;
      else {
        if (ArchiveReader.FILE_TYPES.includes(type))
          files.set(extendedName ?? ArchiveReader.readName(header), Buffer.from(content));
        extendedName = null;
      }
      offset += ArchiveReader.BLOCK * (1 + Math.ceil(size / ArchiveReader.BLOCK));
    }
    return files;
  }

  private static readName(header: Buffer): string {
    const name = ArchiveReader.readField(header, 0, ArchiveReader.NAME_END);
    const prefix = ArchiveReader.readField(header, ArchiveReader.PREFIX_START, ArchiveReader.PREFIX_END);
    return prefix.length > 0 ? `${prefix}/${name}` : name;
  }

  private static readField(header: Buffer, start: number, end: number): string {
    return header.toString("utf8", start, end).replace(ArchiveReader.FIELD_END, "");
  }
}
