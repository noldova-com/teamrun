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
import { ChatListParams } from "@noldova/teamrun.protocol";

@TestClass
export class ChatListParamsTests {
  @TestMethod
  public roundTripsAProjectAndNoProjectThroughJson(): void {
    Assert.areEqual(JSON.stringify({ projectId: "prj-1" }), JSON.stringify(ChatListParams.fromJson({ projectId: "prj-1" }).toJson()));
    Assert.isNull(ChatListParams.fromJson({ projectId: null }).projectId);
  }

  @TestMethod
  public rejectsABlankProject(): void {
    Assert.throws(() => new ChatListParams(" "), ArgumentException);
    Assert.areEqual("$.projectId", Assert.throws(() => ChatListParams.fromJson({}), JsonException).path);
    Assert.areEqual("$.projectId", Assert.throws(() => ChatListParams.fromJson({ projectId: String.empty }), JsonException).path);
  }
}
