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
import { ChatRenameParams } from "@noldova/teamrun.protocol";

@TestClass
export class ChatRenameParamsTests {
  private static readonly json: object = { chatId: "conv-1", title: "Login" };

  @TestMethod
  public roundTripsThroughJson(): void {
    const value = ChatRenameParams.fromJson(ChatRenameParamsTests.json);

    Assert.areEqual(JSON.stringify(ChatRenameParamsTests.json), JSON.stringify(value.toJson()));
  }

  @TestMethod
  public rejectsInvalidArguments(): void {
    const valid = ChatRenameParams.fromJson(ChatRenameParamsTests.json);

    Assert.throws(() => new ChatRenameParams(String.empty, valid.title), ArgumentException);
    Assert.throws(() => new ChatRenameParams(valid.chatId, String.empty), ArgumentException);
  }

  @TestMethod
  public rejectsInvalidValuesWithTheirPath(): void {
    const exception = Assert.throws(() => ChatRenameParams.fromJson({ ...ChatRenameParamsTests.json, title: String.empty }), JsonException);

    Assert.areEqual("$.title", exception.path);
  }
}
