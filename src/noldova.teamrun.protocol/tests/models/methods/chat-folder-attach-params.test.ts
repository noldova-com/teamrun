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
import { ChatFolderAttachParams } from "@noldova/teamrun.protocol";

@TestClass
export class ChatFolderAttachParamsTests {
  private static readonly json: object = { chatId: "c1", folder: "/home/ada/site" };

  @TestMethod
  public roundTripsThroughJson(): void {
    const value = ChatFolderAttachParams.fromJson(ChatFolderAttachParamsTests.json);

    Assert.areEqual(JSON.stringify(ChatFolderAttachParamsTests.json), JSON.stringify(value.toJson()));
  }

  @TestMethod
  public rejectsInvalidArguments(): void {
    Assert.throws(() => new ChatFolderAttachParams(String.empty, "/home/ada/site"), ArgumentException);
    Assert.throws(() => new ChatFolderAttachParams("c1", " "), ArgumentException);
  }

  @TestMethod
  public rejectsInvalidValuesWithTheirPath(): void {
    const exception = Assert.throws(() => ChatFolderAttachParams.fromJson({ ...ChatFolderAttachParamsTests.json, folder: String.empty }), JsonException);

    Assert.areEqual("$.folder", exception.path);
  }
}
