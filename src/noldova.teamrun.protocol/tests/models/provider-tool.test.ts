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
import { ProviderTool } from "@noldova/teamrun.protocol";

@TestClass
export class ProviderToolTests {
  private static readonly json: object = {
    kind: "claude",
    found: true,
    version: "2.1.211",
    installCommand: "curl -fsSL https://claude.ai/install.sh | bash",
    subscribeUrl: "https://claude.com/pricing"
  };

  @TestMethod
  public roundTripsThroughJson(): void {
    const tool = ProviderTool.fromJson(ProviderToolTests.json);

    Assert.areEqual(JSON.stringify(ProviderToolTests.json), JSON.stringify(tool.toJson()));
    Assert.areEqual("claude", tool.kind);
    Assert.isTrue(tool.found);
    Assert.areEqual("2.1.211", tool.version);
  }

  @TestMethod
  public defaultsToNoVersionNoCommandAndNoPage(): void {
    const tool = new ProviderTool("grok", false);

    Assert.areEqual(JSON.stringify({ kind: "grok", found: false, version: null, installCommand: null, subscribeUrl: null }), JSON.stringify(tool.toJson()));
    Assert.areEqual(JSON.stringify(tool.toJson()), JSON.stringify(ProviderTool.fromJson(tool.toJson()).toJson()));
  }

  @TestMethod
  public rejectsBlanksAndInvalidJson(): void {
    Assert.throws(() => new ProviderTool(" ", true), ArgumentException);
    Assert.throws(() => new ProviderTool("codex", true, String.empty), ArgumentException);
    Assert.throws(() => new ProviderTool("codex", false, null, " "), ArgumentException);
    Assert.throws(() => new ProviderTool("codex", false, null, null, String.empty), ArgumentException);
    Assert.areEqual("$.found", Assert.throws(() => ProviderTool.fromJson({ kind: "codex", found: "yes" }), JsonException).path);
    Assert.areEqual("$.kind", Assert.throws(() => ProviderTool.fromJson({ kind: " ", found: true }), JsonException).path);
  }
}
