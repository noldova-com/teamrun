/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { closeSync, fstatSync, openSync, readSync } from "node:fs";
import "@noldova/context.core";

import { Resources } from "../../resources.js";

export class ZipDirectory {
  public static isSafe(path: string): boolean {
    const file = openSync(path, Resources.readFlag);
    try {
      const entries = ZipDirectory.readEntries(file);
      return !Object.isNull(entries) && entries.every(t => !t.isLink && ZipDirectory.isContained(t.name));
    }
    finally {
      closeSync(file);
    }
  }

  public static isContained(name: string): boolean {
    return name.length > 0 && !Resources.zipRootedName.test(name) && !name.split(Resources.zipNameSeparators).includes(Resources.parentSegment);
  }

  private static readEntries(file: number): readonly { readonly name: string; readonly isLink: boolean }[] | null {
    const size = fstatSync(file).size;
    const tailStart = Math.max(0, size - Resources.zipEndRecordBytes - Resources.zipMaxCommentBytes);
    const tail = ZipDirectory.read(file, tailStart, size - tailStart);
    const end = tail.length < Resources.zipEndRecordBytes
      ? -1
      : tail.lastIndexOf(ZipDirectory.signature(Resources.zipEndSignature), tail.length - Resources.zipEndRecordBytes);
    if (end < 0)
      return null;
    let count = tail.readUInt16LE(end + 10);
    let directorySize = tail.readUInt32LE(end + 12);
    let directoryOffset = tail.readUInt32LE(end + 16);
    if (count === Resources.zipUint16Max || directorySize === Resources.zipUint32Max || directoryOffset === Resources.zipUint32Max) {
      const locator = end - Resources.zip64LocatorBytes;
      if (locator < 0 || tail.readUInt32LE(locator) !== Resources.zip64LocatorSignature)
        return null;
      const recordOffset = Number(tail.readBigUInt64LE(locator + 8));
      if (recordOffset + Resources.zip64EndRecordBytes > size)
        return null;
      const record = ZipDirectory.read(file, recordOffset, Resources.zip64EndRecordBytes);
      if (record.readUInt32LE(0) !== Resources.zip64EndSignature)
        return null;
      count = Number(record.readBigUInt64LE(32));
      directorySize = Number(record.readBigUInt64LE(40));
      directoryOffset = Number(record.readBigUInt64LE(48));
    }
    if (directoryOffset + directorySize > size)
      return null;
    const directory = ZipDirectory.read(file, directoryOffset, directorySize);
    const entries: { readonly name: string; readonly isLink: boolean }[] = [];
    let offset = 0;
    for (let index = 0; index < count; index++) {
      if (offset + Resources.zipCentralHeaderBytes > directory.length || directory.readUInt32LE(offset) !== Resources.zipCentralSignature)
        return null;
      const nameStart = offset + Resources.zipCentralHeaderBytes;
      const nameEnd = nameStart + directory.readUInt16LE(offset + 28);
      const next = nameEnd + directory.readUInt16LE(offset + 30) + directory.readUInt16LE(offset + 32);
      if (next > directory.length)
        return null;
      const mode = directory.readUInt32LE(offset + 38) >>> 16;
      entries.push({
        name: directory.toString(Resources.utf8Encoding, nameStart, nameEnd),
        isLink: directory.readUInt8(offset + 5) === Resources.zipUnixHost && (mode & Resources.fileTypeMask) === Resources.symbolicLinkType
      });
      offset = next;
    }
    return entries;
  }

  private static read(file: number, position: number, length: number): Buffer {
    const buffer = Buffer.alloc(length);
    if (length > 0)
      readSync(file, buffer, 0, length, position);
    return buffer;
  }

  private static signature(value: number): Buffer {
    const buffer = Buffer.alloc(4);
    buffer.writeUInt32LE(value);
    return buffer;
  }
}
