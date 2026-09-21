/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { Resources } from "@noldova/teamrun-providers";

@TestClass
export class ResourcesTests {
  @TestMethod
  public formatsMessagesWithAndWithoutOptionalParts(): void {
    Assert.areEqual("thread/start: nope (code -1)", Resources.formatAppServerError("thread/start", "nope", -1));
    Assert.areEqual("The Codex app-server is not running (x).", Resources.formatAppServerNotRunning("x"));
    Assert.areEqual("The Codex app-server did not answer x within the timeout.", Resources.formatAppServerTimedOut("x"));
    Assert.areEqual("The Codex app-server exited (code 1, signal null)", Resources.formatAppServerExited(1, null, " "));
    Assert.areEqual("The Codex app-server exited (code null, signal SIGTERM): tail", Resources.formatAppServerExited(null, "SIGTERM", "tail"));
    Assert.areEqual("The turn ended with status \"cancelled\".", Resources.formatTurnStatus("cancelled"));
    Assert.areEqual("TeamRun does not handle the server request m.", Resources.formatUnsupportedServerRequest("m"));
    Assert.areEqual("The effort \"ultra\" is not one Codex accepts.", Resources.formatUnknownEffort("ultra", "Codex"));
    Assert.areEqual("$ ls\nout", Resources.formatCommandStatus("ls", "out", null));
    Assert.areEqual("$ ls\nout\n(exit 2)", Resources.formatCommandStatus("ls", "out", 2));
    Assert.areEqual("File changes (done): update a", Resources.formatFileChanges("done", Resources.formatFileChange("update", "a")));
    Assert.areEqual("Apply file changes", Resources.formatFileChangeApproval(null, null));
    Assert.areEqual("Apply file changes: why (grant root /r)", Resources.formatFileChangeApproval("why", "/r"));
    Assert.areEqual("subtype", Resources.formatClaudeFailure("subtype", []));
    Assert.areEqual("subtype: a; b", Resources.formatClaudeFailure("subtype", ["a", "b"]));
    Assert.areEqual("Bash: ls", Resources.formatToolWithCommand("Bash", "ls"));
    Assert.areEqual("Read (a, b)", Resources.formatToolWithKeys("Read", "a, b"));
    Assert.areEqual("api key (user)", Resources.formatApiKeySource("user"));
    Assert.areEqual("Session tools: Read. MCP servers: none. Permission mode: acceptEdits.", Resources.formatClaudeSession("Read", "none", "acceptEdits"));
    Assert.areEqual("srv (connected)", Resources.formatClaudeServer("srv", "connected"));
    Assert.areEqual("Codex rerouted the model from a to b (why).", Resources.formatModelRerouted("a", "b", "why"));
    Assert.areEqual("The native session could not be resumed, so a fresh one was started: e", Resources.formatResumeFailed("e"));
    Assert.areEqual("The account could not be read: e", Resources.formatAccountUnavailable("e"));
    Assert.areEqual("The account details could not be read: e", Resources.formatAccountInfoUnavailable("e"));
    Assert.areEqual("Unexpected output from the sign-in check: o", Resources.formatUnexpectedSignInOutput("o"));
    Assert.areEqual("MCP tool s/t (ok)", Resources.formatMcpToolCall("s", "t", "ok"));
    Assert.areEqual("Tool t (ok)", Resources.formatToolCall("t", "ok"));
    Assert.areEqual("Web search: q", Resources.formatWebSearch("q"));
  }
}
