/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import fs, { mkdirSync, writeFileSync } from "node:fs";
import { syncBuiltinESMExports } from "node:module";
import { join } from "node:path";
import { ServiceException } from "@noldova/teamrun.services";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { ProjectImageReader } from "@noldova/teamrun.core";
import { TemporaryDataDirectory } from "../../fixtures/temporary-data-directory.fixture.js";

@TestClass
export class FileSystemErrorsTests {
  @TestMethod
  public takesAnErrorWithAStringSyscallAsTheFileSystemsSoAReadIsRefusedAsGone(): void {
    const error = Object.assign(new Error("EIO: i/o error, read"), { code: "EIO", syscall: "read" });

    const thrown = FileSystemErrorsTests.readThrowing(error);

    Assert.areEqual("NotFound", thrown instanceof ServiceException ? thrown.info.name : "not refused");
  }

  @TestMethod
  public letsAValueThatIsNotAnErrorThroughEvenWithAStringSyscall(): void {
    const values: unknown[] = ["Not an error.", { code: "EIO", syscall: "read" }];

    Assert.areEqual(JSON.stringify([true, true]), JSON.stringify(values.map(t => FileSystemErrorsTests.readThrowing(t) === t)));
  }

  @TestMethod
  public letsAnErrorWhoseSyscallIsNotAStringThrough(): void {
    const errors: unknown[] = [Object.assign(new Error("A number."), { code: "EIO", syscall: 1 }),
      Object.assign(new Error("Nothing."), { code: "EIO", syscall: undefined })];

    Assert.areEqual(JSON.stringify([true, true]), JSON.stringify(errors.map(t => FileSystemErrorsTests.readThrowing(t) === t)));
  }

  @TestMethod
  public letsAnErrorWithACodeButNoSyscallThrough(): void {
    const error = Object.assign(new Error("ENOENT, but from no file call."), { code: "ENOENT" });

    Assert.areEqual(true, FileSystemErrorsTests.readThrowing(error) === error);
  }

  private static readThrowing(error: unknown): unknown {
    using directory = new TemporaryDataDirectory();
    const project = join(directory.path, "alpha");
    mkdirSync(project);
    const path = join(project, "chart.png");
    const size = Buffer.alloc(8);
    size.writeUInt32BE(2, 0);
    size.writeUInt32BE(3, 4);
    writeFileSync(path, Buffer.concat([Buffer.from("89504e470d0a1a0a0000000d", "hex"), Buffer.from("IHDR", "latin1"), size, Buffer.alloc(5)]));
    const original = fs.readSync;
    fs.readSync = () => {
      throw error;
    };
    syncBuiltinESMExports();
    try {
      ProjectImageReader.read(project, path);
      return null;
    }
    catch (caught) {
      return caught;
    }
    finally {
      fs.readSync = original;
      syncBuiltinESMExports();
    }
  }
}
