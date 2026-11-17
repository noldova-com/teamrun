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
import { ChatCreateParams } from "@noldova/teamrun.protocol";

@TestClass
export class ChatCreateParamsTests {
  private static readonly json: object = { projectId: "prj-1", title: null, teammateId: null };

  @TestMethod
  public roundTripsThroughJson(): void {
    const value = ChatCreateParams.fromJson(ChatCreateParamsTests.json);

    Assert.areEqual(JSON.stringify(ChatCreateParamsTests.json), JSON.stringify(value.toJson()));
  }

  @TestMethod
  public carriesTheTeammateTheChatStartsWithAndReadsItAsNoneFromAnOlderRequest(): void {
    const value = ChatCreateParams.fromJson({ projectId: "prj-1", title: null, teammateId: "bob" });

    Assert.areEqual("bob", value.teammateId);
    Assert.areEqual("bob", ChatCreateParams.fromJson(value.toJson()).teammateId);
    Assert.isNull(ChatCreateParams.fromJson({ projectId: "prj-1", title: null }).teammateId);
    Assert.isNull(new ChatCreateParams("prj-1", null).teammateId);
  }

  @TestMethod
  public createsAChatWithoutAProjectFromANullProject(): void {
    const value = ChatCreateParams.fromJson({ projectId: null, title: null, teammateId: "bob" });

    Assert.isNull(value.projectId);
    Assert.areEqual(JSON.stringify({ projectId: null, title: null, teammateId: "bob" }), JSON.stringify(value.toJson()));
  }

  @TestMethod
  public rejectsInvalidArguments(): void {
    const valid = ChatCreateParams.fromJson(ChatCreateParamsTests.json);

    Assert.throws(() => new ChatCreateParams(String.empty, valid.title), ArgumentException);
    Assert.throws(() => new ChatCreateParams("prj-1", null, " "), ArgumentException);
  }

  @TestMethod
  public rejectsInvalidValuesWithTheirPath(): void {
    const exception = Assert.throws(() => ChatCreateParams.fromJson({ ...ChatCreateParamsTests.json, title: 7 }), JsonException);

    Assert.areEqual("$.title", exception.path);
    Assert.areEqual("$.teammateId", Assert.throws(() => ChatCreateParams.fromJson({ ...ChatCreateParamsTests.json, teammateId: 7 }),
      JsonException).path);
  }
}
