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
import { type IMethodHandler, RuntimeCommand } from "@noldova/teamrun-shell-runtime";

@TestClass
export class RuntimeCommandTests {
  private static readonly HANDLER: IMethodHandler = { handleAsync: async () => null };

  @TestMethod
  public describesItselfAsTheProtocolReportsIt(): void {
    const command = new RuntimeCommand("clock.tick", "Tick", "timer", "Alt+Mod+T", RuntimeCommandTests.HANDLER);

    Assert.areEqual("{\"name\":\"clock.tick\",\"title\":\"Tick\",\"icon\":\"timer\",\"defaultKey\":\"Mod+Alt+T\"}", JSON.stringify(command.info.toJson()));
    Assert.areEqual(RuntimeCommandTests.HANDLER, command.handler);
    Assert.isNull(new RuntimeCommand("clock.tick", "Tick", null, null, RuntimeCommandTests.HANDLER).info.defaultKey);
  }

  @TestMethod
  public namesTheInvalidPart(): void {
    Assert.areEqual("name", Assert.throws(() => new RuntimeCommand("tick", "Tick", null, null, RuntimeCommandTests.HANDLER), ArgumentException).parameterName);
    Assert.areEqual("title", Assert.throws(() => new RuntimeCommand("clock.tick", " ", null, null, RuntimeCommandTests.HANDLER), ArgumentException).parameterName);
    Assert.areEqual("defaultKey", Assert.throws(() => new RuntimeCommand("clock.tick", "Tick", null, "Mod+Q", RuntimeCommandTests.HANDLER), ArgumentException).parameterName);
    Assert.areEqual("defaultKey", Assert.throws(() => new RuntimeCommand("clock.tick", "Tick", null, "T", RuntimeCommandTests.HANDLER), ArgumentException).parameterName);
  }
}
