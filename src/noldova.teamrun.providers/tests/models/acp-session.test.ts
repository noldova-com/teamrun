/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ArgumentException } from "@noldova/context.exceptions";
import { JsonReader } from "@noldova/context.json";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { AcpSession } from "@noldova/teamrun.providers";

@TestClass
export class AcpSessionTests {
  @TestMethod
  public keepsTheSessionWhetherItWasResumedAndTheAnswer(): void {
    const result = JsonReader.fromValue({ sessionId: "s-1" });
    const session = new AcpSession("s-1", true, result);

    Assert.areEqual("s-1", session.id);
    Assert.isTrue(session.resumed);
    Assert.areEqual(result, session.result);
    Assert.areEqual("sessionId", Assert.throws(() => new AcpSession(" ", false, result), ArgumentException).parameterName);
  }
}
