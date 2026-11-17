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
import { ChatMoveParams } from "@noldova/teamrun.protocol";

@TestClass
export class ChatMoveParamsTests {
  private static readonly json: object = { chatId: "conv-1", projectId: "prj-2" };

  @TestMethod
  public roundTripsThroughJson(): void {
    const value = ChatMoveParams.fromJson(ChatMoveParamsTests.json);

    Assert.areEqual(JSON.stringify(ChatMoveParamsTests.json), JSON.stringify(value.toJson()));
  }

  @TestMethod
  public rejectsInvalidArguments(): void {
    const valid = ChatMoveParams.fromJson(ChatMoveParamsTests.json);

    Assert.throws(() => new ChatMoveParams(String.empty, valid.projectId), ArgumentException);
    Assert.throws(() => new ChatMoveParams(valid.chatId, String.empty), ArgumentException);
  }

  @TestMethod
  public rejectsInvalidValuesWithTheirPath(): void {
    const exception = Assert.throws(() => ChatMoveParams.fromJson({ ...ChatMoveParamsTests.json, projectId: String.empty }), JsonException);

    Assert.areEqual("$.projectId", exception.path);
  }
}
