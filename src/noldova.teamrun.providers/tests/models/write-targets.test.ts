/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { WriteTargets } from "@noldova/teamrun.providers";

@TestClass
export class WriteTargetsTests {
  @TestMethod
  public writesItsFilesAndFoldersAsPayloadFields(): void {
    const targets = new WriteTargets(["/tmp/a.txt", "b.txt"], ["."]);

    Assert.areEqual("/tmp/a.txt,b.txt", targets.files.join(","));
    Assert.areEqual(".", targets.unnamedIn.join(","));
    Assert.areEqual("{\"writes\":[\"/tmp/a.txt\",\"b.txt\"],\"unnamedWrites\":[\".\"]}", JSON.stringify(targets.toJson()));
  }
}
