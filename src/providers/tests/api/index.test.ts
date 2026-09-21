/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import * as api from "@noldova/teamrun-providers";

@TestClass
export class ProvidersApiTests {
  @TestMethod
  public exportsTheCompleteCatalog(): void {
    const expected = [
      "AbortTimer", "AgentSdkQueryFactory", "AppServerClient", "AppServerClientInfo", "AppServerException", "AppServerInitialization",
      "AppServerUnavailableException", "BoundedOutput", "ClaudeAdapter", "ClaudeEnvironment", "ClaudePrompt", "ClaudeRun", "ClaudeSignInReader", "ClaudeTurn",
      "CodexAccount", "CodexAdapter", "CodexEnvironment", "CodexItemReader", "CodexRequestRouter", "CodexTurn", "CommandResult", "CommandRunner", "DeltaStream",
      "ExecutableLocator", "ExecutableNotFoundException", "ExecutableSource", "ExecutableVersionReader", "FailureDescriber", "HandlerSubscription",
      "ProjectInstructions", "AcpClient", "GrokAdapter", "GrokEnvironment", "GrokProfile", "GrokModelReader", "GrokTurn",
      "InvalidOperationException", "JsonRpcError", "LocatedExecutable", "PendingRequest", "ProcessCommand", "ProcessExit", "ProcessTerminator",
      "ProviderTimings", "Resources", "TailBuffer", "ThreadStartResult", "UnsupportedServerRequestException"
    ];

    Assert.areEqual([...expected].sort().join(","), Object.keys(api).sort().join(","));
  }
}
