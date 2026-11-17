/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { writeFileSync } from "node:fs";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { ZipDirectory } from "@noldova/teamrun.providers";

import { TemporaryDirectory } from "../../fixtures/temporary-directory.fixture.js";
import { ZipArchive } from "../../fixtures/zip-archive.fixture.js";

const entries = [{ name: "server", data: "server" }, { name: "lib/harness", data: "harness!" }];

@TestClass
export class ZipDirectoryTests {
  @TestMethod
  public readsAStoredAndAZip64Archive(): void {
    using directory = new TemporaryDirectory();
    Assert.isTrue(ZipDirectoryTests.check(directory, ZipArchive.stored(entries)));
    Assert.isTrue(ZipDirectoryTests.check(directory, ZipArchive.stored(entries, true)));
    Assert.isTrue(ZipDirectoryTests.check(directory, ZipArchive.stored([])));
    Assert.isTrue(ZipDirectoryTests.check(directory, ZipArchive.stored([{ name: "server", data: "server", mode: 0o100755 }])));
  }

  @TestMethod
  public refusesALinkOrANameOutsideTheFolder(): void {
    using directory = new TemporaryDirectory();
    Assert.isFalse(ZipDirectoryTests.check(directory, ZipArchive.stored([...entries, { name: "link", data: "/etc", mode: 0o120777 }])));
    for (const name of ["../server", "lib/../../server", "/server", "\\server", "C:server", "c:/server", "lib\\..\\..\\server"])
      Assert.isFalse(ZipDirectoryTests.check(directory, ZipArchive.stored([...entries, { name, data: "x" }])), name);
    Assert.isFalse(ZipDirectory.isContained(""));
    Assert.isTrue(ZipDirectory.isContained("lib/harness"));
    Assert.isTrue(ZipDirectory.isContained("lib/..harness.."));
  }

  @TestMethod
  public refusesAnArchiveWhoseDirectoryDoesntRead(): void {
    using directory = new TemporaryDirectory();
    const stored = ZipArchive.stored(entries);
    const end = stored.length - 22;
    const start = stored.readUInt32LE(end + 16);
    const zip64 = ZipArchive.stored(entries, true);
    const locator = zip64.length - 22 - 20;
    const cases: readonly [string, Buffer][] = [
      ["not a zip archive", Buffer.from("not a zip archive")],
      ["an empty file", Buffer.alloc(0)],
      ["zeros as long as an end record", Buffer.alloc(64)],
      ["a Zip64 end with nothing before it", zip64.subarray(zip64.length - 22)],
      ["a Zip64 end without its locator", Buffer.concat([Buffer.alloc(20), zip64.subarray(zip64.length - 22)])],
      ["a Zip64 record past the end", ZipDirectoryTests.patch(zip64, t => t.writeBigUInt64LE(BigInt(zip64.length), locator + 8))],
      ["a Zip64 record without its signature", ZipDirectoryTests.patch(zip64, t => t.writeUInt32LE(0, locator - 56))],
      ["a directory past the end", ZipDirectoryTests.patch(stored, t => t.writeUInt32LE(stored.length, end + 16))],
      ["a directory without its signature", ZipDirectoryTests.patch(stored, t => t.writeUInt32LE(0, start))],
      ["more entries than the directory holds", ZipDirectoryTests.patch(stored, t => t.writeUInt16LE(entries.length + 1, end + 10))],
      ["a name longer than the directory", ZipDirectoryTests.patch(stored, t => t.writeUInt16LE(0xfff, start + 28))]
    ];
    for (const [name, archive] of cases)
      Assert.isFalse(ZipDirectoryTests.check(directory, archive), name);
  }

  private static check(directory: TemporaryDirectory, archive: Buffer): boolean {
    const path = directory.resolve("archive.zip");
    writeFileSync(path, archive);
    return ZipDirectory.isSafe(path);
  }

  private static patch(archive: Buffer, change: (copy: Buffer) => void): Buffer {
    const copy = Buffer.from(archive);
    change(copy);
    return copy;
  }
}
