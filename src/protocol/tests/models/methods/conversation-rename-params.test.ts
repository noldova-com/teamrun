/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/teamrun-foundation-core";
import { ArgumentException } from "@noldova/teamrun-foundation-exceptions";
import { JsonException } from "@noldova/teamrun-foundation-json";
import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { ConversationRenameParams } from "@noldova/teamrun-protocol";

@TestClass
export class ConversationRenameParamsTests {
  private static readonly json: object = { conversationId: "conv-1", title: "Login" };

  @TestMethod
  public roundTripsThroughJson(): void {
    const value = ConversationRenameParams.fromJson(ConversationRenameParamsTests.json);

    Assert.areEqual(JSON.stringify(ConversationRenameParamsTests.json), JSON.stringify(value.toJson()));
  }

  @TestMethod
  public rejectsInvalidArguments(): void {
    const valid = ConversationRenameParams.fromJson(ConversationRenameParamsTests.json);

    Assert.throws(() => new ConversationRenameParams(String.empty, valid.title), ArgumentException);
    Assert.throws(() => new ConversationRenameParams(valid.conversationId, String.empty), ArgumentException);
  }

  @TestMethod
  public rejectsInvalidValuesWithTheirPath(): void {
    const exception = Assert.throws(() => ConversationRenameParams.fromJson({ ...ConversationRenameParamsTests.json, title: String.empty }), JsonException);

    Assert.areEqual("$.title", exception.path);
  }
}
