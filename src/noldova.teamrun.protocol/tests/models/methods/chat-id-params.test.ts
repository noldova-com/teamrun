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
import { ChatIdParams } from "@noldova/teamrun.protocol";

@TestClass
export class ChatIdParamsTests {
  private static readonly json: object = { chatId: "conv-1" };

  @TestMethod
  public roundTripsThroughJson(): void {
    const value = ChatIdParams.fromJson(ChatIdParamsTests.json);

    Assert.areEqual(JSON.stringify(ChatIdParamsTests.json), JSON.stringify(value.toJson()));
  }

  @TestMethod
  public rejectsInvalidArguments(): void {
    Assert.throws(() => new ChatIdParams(String.empty), ArgumentException);
  }

  @TestMethod
  public rejectsInvalidValuesWithTheirPath(): void {
    const invalid = { ...ChatIdParamsTests.json, chatId: String.empty };
    const exception = Assert.throws(() => ChatIdParams.fromJson(invalid), JsonException);

    Assert.areEqual("$.chatId", exception.path);
  }
}
