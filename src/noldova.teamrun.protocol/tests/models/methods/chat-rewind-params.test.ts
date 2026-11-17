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
import { ChatRewindParams } from "@noldova/teamrun.protocol";

@TestClass
export class ChatRewindParamsTests {
  private static readonly json: object = { chatId: "conv-1", messageId: "msg-4", restoreFiles: true };

  @TestMethod
  public roundTripsThroughJson(): void {
    const value = ChatRewindParams.fromJson(ChatRewindParamsTests.json);

    Assert.areEqual(JSON.stringify(ChatRewindParamsTests.json), JSON.stringify(value.toJson()));
    Assert.isTrue(value.restoreFiles);
  }

  @TestMethod
  public rejectsInvalidArguments(): void {
    Assert.throws(() => new ChatRewindParams(String.empty, "msg-4", false), ArgumentException);
    Assert.throws(() => new ChatRewindParams("conv-1", " ", false), ArgumentException);
  }

  @TestMethod
  public rejectsInvalidValuesWithTheirPath(): void {
    const exception = Assert.throws(() => ChatRewindParams.fromJson({ ...ChatRewindParamsTests.json, restoreFiles: "yes" }), JsonException);

    Assert.areEqual("$.restoreFiles", exception.path);
  }
}
