/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { ArgumentException } from "@noldova/context.exceptions";
import { JsonException } from "@noldova/context.json";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { CommandStartParams, Resources } from "@noldova/teamrun.protocol";

@TestClass
export class CommandStartParamsTests {
  private static readonly json: object = { senderToken: "token-1", command: "npm test", description: "Run the tests" };

  @TestMethod
  public roundTripsThroughJson(): void {
    const value = CommandStartParams.fromJson(CommandStartParamsTests.json);

    Assert.areEqual(JSON.stringify(CommandStartParamsTests.json), JSON.stringify(value.toJson()));
  }

  @TestMethod
  public rejectsInvalidArguments(): void {
    Assert.throws(() => new CommandStartParams(String.empty, "npm test", "Run"), ArgumentException);
    Assert.throws(() => new CommandStartParams("token-1", " ", "Run"), ArgumentException);
    Assert.throws(() => new CommandStartParams("token-1", "npm test", String.empty), ArgumentException);
  }

  @TestMethod
  public takesACommandUpToItsLimitAndRefusesALongerOne(): void {
    const longest = "x".repeat(8_192);

    Assert.areEqual(longest, new CommandStartParams("token-1", longest, "Run").command);
    const exception = Assert.throws(() => new CommandStartParams("token-1", `${longest}x`, "Run"), ArgumentException);
    Assert.areEqual("command", exception.parameterName);
    Assert.isTrue(exception.message.startsWith(Resources.commandTooLong));
  }

  @TestMethod
  public rejectsInvalidValuesWithTheirPath(): void {
    const exception = Assert.throws(() => CommandStartParams.fromJson({ ...CommandStartParamsTests.json, command: " " }), JsonException);

    Assert.areEqual("$.command", exception.path);
  }
}
