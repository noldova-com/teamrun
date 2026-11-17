/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { ExecutableSource, LocatedExecutable } from "@noldova/teamrun.providers";

export class FakeUnzip {
  private static readonly SCRIPT: string = `const fs = require("node:fs");
const path = require("node:path");
const args = process.argv;
const archive = fs.readFileSync(args[args.indexOf("-o") + 1]);
const directory = args[args.indexOf("-d") + 1];
if (archive.length < 4 || archive.readUInt32LE(0) !== 0x04034b50)
  process.exit(9);
let offset = 0;
while (archive.readUInt32LE(offset) === 0x04034b50) {
  const size = archive.readUInt32LE(offset + 18);
  const nameLength = archive.readUInt16LE(offset + 26);
  const start = offset + 30 + nameLength + archive.readUInt16LE(offset + 28);
  fs.writeFileSync(path.join(directory, archive.toString("utf8", offset + 30, offset + 30 + nameLength)), archive.subarray(start, start + size));
  offset = start + size;
}
`;

  public static create(directory: string): LocatedExecutable {
    const script = join(directory, "fake-unzip.cjs");
    writeFileSync(script, FakeUnzip.SCRIPT);
    return new LocatedExecutable(process.execPath, ExecutableSource.Path, [script]);
  }
}
