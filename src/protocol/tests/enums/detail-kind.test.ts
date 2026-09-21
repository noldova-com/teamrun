/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { DetailKind } from "@noldova/teamrun-protocol";

@TestClass
export class DetailKindTests {
  @TestMethod
  public usesMemberNamesAsValues(): void {
    Assert.areEqual("Text", DetailKind.Text);
    Assert.areEqual("Reasoning", DetailKind.Reasoning);
    Assert.areEqual("Command", DetailKind.Command);
    Assert.areEqual("FileChange", DetailKind.FileChange);
    Assert.areEqual("Note", DetailKind.Note);
    Assert.areEqual("Error", DetailKind.Error);
  }

  @TestMethod
  public valuesAreDistinct(): void {
    const values = Object.values(DetailKind);

    Assert.areEqual(values.length, new Set(values).size);
  }
}
