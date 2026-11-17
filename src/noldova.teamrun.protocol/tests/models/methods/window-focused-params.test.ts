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
import { WindowFocusedParams } from "@noldova/teamrun.protocol";

@TestClass
export class WindowFocusedParamsTests {
  @TestMethod
  public roundTripsThroughJson(): void {
    for (const json of [{ windowId: "window-1", shownChatId: "conv-1", focused: true }, { windowId: "window-1", shownChatId: null, focused: false }])
      Assert.areEqual(JSON.stringify(json), JSON.stringify(WindowFocusedParams.fromJson(json).toJson()));
  }

  @TestMethod
  public rejectsInvalidArguments(): void {
    Assert.throws(() => new WindowFocusedParams(String.empty, null, true), ArgumentException);
    Assert.throws(() => new WindowFocusedParams("window-1", " ", true), ArgumentException);
  }

  @TestMethod
  public rejectsInvalidValuesWithTheirPath(): void {
    const exception = Assert.throws(() => WindowFocusedParams.fromJson({ windowId: "window-1", shownChatId: 4 }), JsonException);
    const focused = Assert.throws(() => WindowFocusedParams.fromJson({ windowId: "window-1", shownChatId: null, focused: "yes" }), JsonException);

    Assert.areEqual("$.shownChatId", exception.path);
    Assert.areEqual("$.focused", focused.path);
  }
}
