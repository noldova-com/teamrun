/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ArgumentException } from "@noldova/teamrun-foundation-exceptions";
import { Assert, SourcePosition, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";

@TestClass
export class SourcePositionTests {
  @TestMethod
  public carriesThePosition(): void {
    const position = new SourcePosition("src/sample.ts", 12);

    Assert.areEqual("src/sample.ts", position.sourcePath);
    Assert.areEqual(12, position.line);
  }

  @TestMethod
  public rejectsANonPositiveLine(): void {
    Assert.throws(() => new SourcePosition("src/sample.ts", 0), ArgumentException);
  }
}
