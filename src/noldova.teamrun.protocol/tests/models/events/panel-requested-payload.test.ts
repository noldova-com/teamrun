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
import { PanelName, PanelRequestedPayload } from "@noldova/teamrun.protocol";

@TestClass
export class PanelRequestedPayloadTests {
  private static readonly chat: object = { requestId: "request-1", windowId: "window-1", panel: "Chat", chatId: "conv-1", open: true };
  private static readonly view: object = { requestId: "request-2", windowId: "window-1", panel: "Providers", chatId: null, open: false };

  @TestMethod
  public roundTripsThroughJson(): void {
    for (const json of [PanelRequestedPayloadTests.chat, PanelRequestedPayloadTests.view])
      Assert.areEqual(JSON.stringify(json), JSON.stringify(PanelRequestedPayload.fromJson(json).toJson()));
    const value = PanelRequestedPayload.fromJson(PanelRequestedPayloadTests.view);
    Assert.areEqual(PanelName.Providers, value.panel);
    Assert.isNull(value.chatId);
    Assert.isFalse(value.open);
  }

  @TestMethod
  public rejectsInvalidArguments(): void {
    Assert.throws(() => new PanelRequestedPayload(String.empty, "window-1", PanelName.Teammates, null, true), ArgumentException);
    Assert.throws(() => new PanelRequestedPayload("request-1", " ", PanelName.Teammates, null, true), ArgumentException);
    Assert.throws(() => new PanelRequestedPayload("request-1", "window-1", PanelName.Chat, " ", true), ArgumentException);
  }

  @TestMethod
  public rejectsAChatPanelOrAChatsPageWithoutItsChatAndAnotherPanelWithOne(): void {
    for (const make of [() => new PanelRequestedPayload("request-1", "window-1", PanelName.Chat, null, true),
      () => new PanelRequestedPayload("request-1", "window-1", PanelName.Page, null, true),
      () => new PanelRequestedPayload("request-1", "window-1", PanelName.Teammates, "conv-1", true)]) {
      const exception = Assert.throws(make, ArgumentException);
      Assert.areEqual("chatId", exception.parameterName);
    }
    Assert.areEqual("conv-1", new PanelRequestedPayload("request-1", "window-1", PanelName.Page, "conv-1", false).conversationId);
  }

  @TestMethod
  public rejectsInvalidValuesWithTheirPath(): void {
    const panel = Assert.throws(() => PanelRequestedPayload.fromJson({ ...PanelRequestedPayloadTests.view, panel: "Terminal" }), JsonException);
    const open = Assert.throws(() => PanelRequestedPayload.fromJson({ ...PanelRequestedPayloadTests.view, open: "yes" }), JsonException);

    Assert.areEqual("$.panel", panel.path);
    Assert.areEqual("$.open", open.path);
  }
}
