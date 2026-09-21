/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { MessageAuthor } from "@noldova/teamrun-protocol";

@TestClass
export class MessageAuthorTests {
  @TestMethod
  public usesMemberNamesAsValues(): void {
    Assert.areEqual("User", MessageAuthor.User);
    Assert.areEqual("Provider", MessageAuthor.Provider);
    Assert.areEqual("TeamRun", MessageAuthor.TeamRun);
  }

  @TestMethod
  public valuesAreDistinct(): void {
    const values = Object.values(MessageAuthor);

    Assert.areEqual(values.length, new Set(values).size);
  }
}
