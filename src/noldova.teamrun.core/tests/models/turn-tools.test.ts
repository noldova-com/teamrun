/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { McpEndpoint, SessionTokens, TurnTools } from "@noldova/teamrun.core";
import type { IMcpToolHost } from "@noldova/teamrun.protocol";

@TestClass
export class TurnToolsTests {
  private static readonly host: IMcpToolHost = { listToolsAsync: () => Promise.resolve([]), callToolAsync: () => Promise.resolve({}) };
  private static readonly approvedTools: readonly string[] = [];

  @TestMethod
  public movesAKeptTokenToItsEndpointsSessionOnlyWhenItHasAnEndpointThatTakesIt(): void {
    const tokens = new SessionTokens(() => 0);
    tokens.open("turn-1", "c1/t1");
    tokens.open("wake", "c1/t1");
    tokens.open("other", "c1/t2");
    const kept = tokens.issueKept("turn-1");
    const plain = tokens.issue("turn-1");
    const wake = new TurnTools(TurnToolsTests.host, TurnToolsTests.approvedTools, new McpEndpoint("http://127.0.0.1:1/mcp", tokens, "wake"));
    const other = new TurnTools(TurnToolsTests.host, TurnToolsTests.approvedTools, new McpEndpoint("http://127.0.0.1:1/mcp", tokens, "other"));

    const withoutEndpoint = new TurnTools(TurnToolsTests.host, TurnToolsTests.approvedTools).adopt(kept);
    const anotherMember = other.adopt(kept);
    const notKept = wake.adopt(plain);
    const adopted = wake.adopt(kept);

    Assert.isFalse(withoutEndpoint);
    Assert.isFalse(anotherMember);
    Assert.isFalse(notKept);
    Assert.isTrue(adopted);
    Assert.areEqual("wake", tokens.find(kept));
  }

  @TestMethod
  public async saysItsToolsAreListedOnlyOnceTheEndpointHasListedThem(): Promise<void> {
    const tools = new TurnTools(TurnToolsTests.host, TurnToolsTests.approvedTools);
    const before = tools.isListed;

    tools.markListed();
    await tools.listed;
    tools.markListed();

    Assert.isFalse(before);
    Assert.isTrue(tools.isListed);
  }

  @TestMethod
  public async settlesFailedWithTheFirstErrorItIsGivenAndLeavesItsToolsUnlisted(): Promise<void> {
    const tools = new TurnTools(TurnToolsTests.host, TurnToolsTests.approvedTools);
    const first = new Error("The list failed.");

    tools.markFailed(first);
    tools.markFailed(new Error("A later failure."));

    Assert.areEqual(first, await tools.failed);
    Assert.isFalse(tools.isListed);
  }
}
