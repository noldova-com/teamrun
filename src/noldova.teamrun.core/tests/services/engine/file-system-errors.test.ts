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
import { mock } from "node:test";
import { ServiceException } from "@noldova/teamrun.services";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { ProjectImageReader } from "@noldova/teamrun.core";
import { CodedError } from "../../fixtures/coded-error.fixture.js";
import { SystemCallError } from "../../fixtures/system-call-error.fixture.js";
import { TemporaryDataDirectory } from "../../fixtures/temporary-data-directory.fixture.js";

@TestClass
export class FileSystemErrorsTests {
  @TestMethod
  public takesAnErrorWithAStringSyscallAsTheFileSystemsSoAReadIsRefusedAsGone(): void {
    const error = new SystemCallError("EIO: i/o error, read", "EIO", "read");

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
    const errors: unknown[] = [new SystemCallError("A number.", "EIO", 1), new SystemCallError("Nothing.", "EIO", undefined)];

    Assert.areEqual(JSON.stringify([true, true]), JSON.stringify(errors.map(t => FileSystemErrorsTests.readThrowing(t) === t)));
  }

  @TestMethod
  public letsAnErrorWithACodeButNoSyscallThrough(): void {
    const error = new CodedError("ENOENT, but from no file call.", "ENOENT");

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
    const read = mock.method(fs, "readSync", (): number => {
      throw error;
    });
    syncBuiltinESMExports();
    try {
      ProjectImageReader.read(project, path);
      return null;
    }
    catch (caught) {
      return caught;
    }
    finally {
      read.mock.restore();
      syncBuiltinESMExports();
    }
  }
}
