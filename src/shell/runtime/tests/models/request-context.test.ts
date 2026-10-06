/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/teamrun-foundation-core";
import { ArgumentException } from "@noldova/teamrun-foundation-exceptions";
import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { RequestContext } from "@noldova/teamrun-shell-runtime";

@TestClass
export class RequestContextTests {
  @TestMethod
  public carriesTheCallerThePayloadTheSignalAndTheConnection(): void {
    const controller = new AbortController();

    const context = new RequestContext("desktop", { path: "notes.md" }, controller.signal, 3);

    Assert.areEqual("desktop", context.client);
    Assert.areEqual("{\"path\":\"notes.md\"}", JSON.stringify(context.payload));
    Assert.areEqual(controller.signal, context.signal);
    Assert.areEqual(3, context.connection);
  }

  @TestMethod
  public requiresTheCallersName(): void {
    Assert.areEqual("client", Assert.throws(() => new RequestContext("", null, new AbortController().signal, 1), ArgumentException).parameterName);
  }
}
