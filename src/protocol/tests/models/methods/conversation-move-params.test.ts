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
import { ConversationMoveParams } from "@noldova/teamrun-protocol";

@TestClass
export class ConversationMoveParamsTests {
  private static readonly json: object = { conversationId: "conv-1", projectId: "prj-2" };

  @TestMethod
  public roundTripsThroughJson(): void {
    const value = ConversationMoveParams.fromJson(ConversationMoveParamsTests.json);

    Assert.areEqual(JSON.stringify(ConversationMoveParamsTests.json), JSON.stringify(value.toJson()));
  }

  @TestMethod
  public rejectsInvalidArguments(): void {
    const valid = ConversationMoveParams.fromJson(ConversationMoveParamsTests.json);

    Assert.throws(() => new ConversationMoveParams(String.empty, valid.projectId), ArgumentException);
    Assert.throws(() => new ConversationMoveParams(valid.conversationId, String.empty), ArgumentException);
  }

  @TestMethod
  public rejectsInvalidValuesWithTheirPath(): void {
    const exception = Assert.throws(() => ConversationMoveParams.fromJson({ ...ConversationMoveParamsTests.json, projectId: String.empty }), JsonException);

    Assert.areEqual("$.projectId", exception.path);
  }
}
