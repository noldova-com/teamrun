/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { CodexAccount } from "@noldova/teamrun-providers";

@TestClass
export class CodexAccountTests {
  @TestMethod
  public readsEveryAccountShape(): void {
    const none = CodexAccount.fromJson({ account: null });
    const chatGpt = CodexAccount.fromJson({ account: { type: "chatgpt", email: "dev@example.com", planType: "plus" } });
    const bareChatGpt = CodexAccount.fromJson({ account: { type: "chatgpt" } });
    const apiKey = CodexAccount.fromJson({ account: { type: "apiKey" } });

    Assert.isNull(none);
    Assert.areEqual("dev@example.com", chatGpt?.email);
    Assert.areEqual("plus", chatGpt?.toIdentity().plan);
    Assert.areEqual("chatgpt", chatGpt?.toIdentity().authMethod);
    Assert.isNull(bareChatGpt?.email);
    Assert.isUndefined(bareChatGpt?.toIdentity().email);
    Assert.areEqual("apiKey", apiKey?.type);
    Assert.isNull(apiKey?.planType);
  }
}
