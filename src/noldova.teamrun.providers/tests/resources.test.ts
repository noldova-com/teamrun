/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { SubAgentStatus } from "@noldova/teamrun.protocol";
import { Resources } from "@noldova/teamrun.providers";

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
    Assert.areEqual("Codex couldn't sign in: access denied.", Resources.formatCodexSignInFailed("access denied."));
    Assert.areEqual("Codex couldn't sign in: access denied.", Resources.formatCodexSignInFailed("access denied"));
    Assert.areEqual("TeamRun does not handle the server request m.", Resources.formatUnsupportedServerRequest("m"));
    Assert.areEqual("The effort \"ultra\" is not one Codex accepts.", Resources.formatUnknownEffort("ultra", "Codex"));
    Assert.areEqual("$ ls\nout", Resources.formatCommandStatus("ls", null, "out", null));
    Assert.areEqual("$ ls\nbash -lc ls\nout\n(exit 2)", Resources.formatCommandStatus("ls", "bash -lc ls", "out", 2));
    Assert.areEqual("ls", Resources.formatInnerCommand("ls"));
    Assert.areEqual("cd src …", Resources.formatInnerCommand("cd src\nnpm test"));
    Assert.areEqual("Moved a to b", Resources.formatFileChanges("Moved", Resources.formatMovedFile("a", "b")));
    Assert.areEqual("Apply file changes", Resources.formatFileChangeApproval(null, null));
    Assert.areEqual("Apply file changes: why (grant root /r)", Resources.formatFileChangeApproval("why", "/r"));
    Assert.areEqual("subtype", Resources.formatClaudeFailure("subtype", []));
    Assert.areEqual("subtype: a; b", Resources.formatClaudeFailure("subtype", ["a", "b"]));
    Assert.areEqual("Bash: ls", Resources.formatToolWithCommand("Bash", "ls"));
    Assert.areEqual("Read (a, b)", Resources.formatToolWithKeys("Read", "a, b"));
    Assert.areEqual("Codex rerouted the model from a to b (why).", Resources.formatModelRerouted("a", "b", "why"));
    Assert.areEqual("The native session could not be resumed, so a fresh one was started: e", Resources.formatResumeFailed("e"));
    Assert.areEqual("Claude Code refused this reply's sender token, so the messages it sends with teamrun fail: e", Resources.formatClaudeSenderRefused("e"));
    Assert.areEqual("Unexpected output from the sign-in check: o", Resources.formatUnexpectedSignInOutput("o"));
    Assert.areEqual("MCP tool s/t", Resources.formatMcpToolCall("s", "t"));
    Assert.areEqual("Tool t", Resources.formatToolCall("t"));
    Assert.areEqual("Generated image: a.png", Resources.formatGeneratedImage("a.png"));
    Assert.areEqual("Web search: q", Resources.formatWebSearch("q"));
    Assert.areEqual("Searched for p", Resources.formatSearchedTitle("p", []));
    Assert.areEqual("Searched for p in a, b", Resources.formatSearchedTitle("p", ["a", "b"]));
    Assert.areEqual("Read a, b", Resources.formatReadTitle(["a", "b"]));
    Assert.areEqual("Read the start of a", Resources.formatReadStartTitle("a"));
    Assert.areEqual("Read the end of a", Resources.formatReadEndTitle("a"));
    Assert.areEqual("Listed a", Resources.formatListedTitle("a"));
    Assert.areEqual("Listed a and its subfolders", Resources.formatListedTreeTitle("a"));
    Assert.areEqual("Changed to a", Resources.formatChangedFolderTitle("a"));
  }

  @TestMethod
  public namesAStoppedTurnsStepAndEachSubAgentsStateOrNone(): void {
    Assert.areEqual("t1 Running", Resources.formatSubAgentState("t1", SubAgentStatus.Running, false, false));
    Assert.areEqual("t2 Stopped in the background, kept", Resources.formatSubAgentState("t2", SubAgentStatus.Stopped, true, true));
    Assert.areEqual("grok: a stopped turn still waits on the turn's finish; its sub-agents at the stop: none",
      Resources.formatTurnStopStuck("grok", Resources.turnStepFinish, ""));
  }

  @TestMethod
  public putsAFailedInstallMoveDownToAHoldOnlyWhenItWasTriedAgain(): void {
    Assert.areEqual("TeamRun couldn't move the new GitHub Copilot 1 download into place in d (EPERM), as something such as a virus scanner still held it, "
      + "so nothing installed was changed. Install again in a moment.", Resources.formatCopilotNotReady("1", "d", "EPERM", true));
    Assert.areEqual("TeamRun couldn't move the new GitHub Copilot 1 download into place in d (EXDEV), so nothing installed was changed.",
      Resources.formatCopilotNotReady("1", "d", "EXDEV", false));
    Assert.areEqual("TeamRun couldn't move the new Grok into place at p (EBUSY), as something such as a virus scanner still held it, so Grok was kept as it was. "
      + "Install again in a moment.", Resources.formatGrokNotReady("p", "EBUSY", true));
    Assert.areEqual("TeamRun couldn't move the new Grok into place at p, so Grok was kept as it was.", Resources.formatGrokNotReady("p", String.empty, false));
  }
}
