/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ArgumentException } from "@noldova/teamrun-foundation-exceptions";
import { Assert, LineRange, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";

@TestClass
export class LineRangeTests {
  @TestMethod
  public carriesTheRange(): void {
    const lineRange = new LineRange(3, 5);

    Assert.areEqual(3, lineRange.startLine);
    Assert.areEqual(5, lineRange.endLine);
  }

  @TestMethod
  public displaysASingleLineWithoutASpan(): void {
    Assert.areEqual("3", new LineRange(3, 3).displayText);
  }

  @TestMethod
  public displaysASpanWithADash(): void {
    Assert.areEqual("3-5", new LineRange(3, 5).displayText);
  }

  @TestMethod
  public rejectsANonPositiveStartLine(): void {
    Assert.throws(() => new LineRange(0, 1), ArgumentException);
  }

  @TestMethod
  public rejectsAnEndBeforeTheStart(): void {
    Assert.throws(() => new LineRange(3, 2), ArgumentException);
  }
}
