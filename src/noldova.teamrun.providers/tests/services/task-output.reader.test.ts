/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { writeFileSync } from "node:fs";

import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { TaskOutputReader } from "@noldova/teamrun.providers";

import { TemporaryDirectory } from "../fixtures/temporary-directory.fixture.js";

@TestClass
export class TaskOutputReaderTests {
  @TestMethod
  public readsAWholeSmallFile(): void {
    using directory = new TemporaryDirectory();
    const path = directory.resolve("small.output");
    writeFileSync(path, "line 1\nline 2\n");

    Assert.areEqual("line 1\nline 2\n", TaskOutputReader.readTail(path));
  }

  @TestMethod
  public readsTheTailOfALargeFileWithoutABrokenFirstCharacter(): void {
    using directory = new TemporaryDirectory();
    const path = directory.resolve("large.output");
    writeFileSync(path, "head ééé tail");

    Assert.areEqual("é tail", TaskOutputReader.readTail(path, 7));
    Assert.areEqual(" tail", TaskOutputReader.readTail(path, 6));
  }

  @TestMethod
  public readsNothingFromAMissingFile(): void {
    using directory = new TemporaryDirectory();

    Assert.areEqual("", TaskOutputReader.readTail(directory.resolve("missing.output")));
  }
}
