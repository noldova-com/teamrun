/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";

import type { FakeQueryStep } from "./fake-claude-query.fixture.js";
import { SdkMessages } from "./sdk-messages.fixture.js";
import { StampedStep } from "./stamped-step.fixture.js";
import { WaitForInputStep } from "./wait-for-input-step.fixture.js";
import { WaitForInterruptStep } from "./wait-for-interrupt-step.fixture.js";
import { WaitForStopStep } from "./wait-for-stop-step.fixture.js";

type Uuid = `${string}-${string}-${string}-${string}-${string}`;

const session = "s-889";
const model = "claude-opus-5-5";

const started = (taskId: string, toolUseId: string, backgrounded: boolean, description: string, taskType: string): FakeQueryStep =>
  SdkMessages.taskStarted(session, taskId, toolUseId, backgrounded, description, taskType);

const shell = (taskId: string, toolUseId: string, backgrounded: boolean, description: string, parent: string): FakeQueryStep => {
  const message = { ...SdkMessages.taskStarted(session, taskId, toolUseId, backgrounded, description, "local_bash"), owned_by_subagent: true, parent_task_id: parent };
  return message;
};

const progress = (taskId: string, description: string, toolUses: number, tokens: number, durationMs: number): FakeQueryStep =>
  ({ ...SdkMessages.taskProgress(session, taskId, toolUses, tokens, durationMs), description });

const ended = (taskId: string, status: "completed" | "stopped", summary: string, usage?: { total_tokens: number; tool_uses: number; duration_ms: number }): FakeQueryStep =>
  ({ ...SdkMessages.taskNotification(session, taskId, status, `/work/.claude/tasks/${taskId}.output`), summary, ...Object.isUndefined(usage) ? {} : { usage } });

const call = (uuid: Uuid, id: string, name: string, input: unknown, parent: string): FakeQueryStep =>
  SdkMessages.assistant(uuid, [SdkMessages.toolUse(id, name, input)], model, parent);

const answer = (uuid: Uuid, id: string, text: string, isError: boolean, parent: string): FakeQueryStep =>
  SdkMessages.user(uuid, [SdkMessages.toolResult(id, text, isError)], parent);

const said = (uuid: Uuid, text: string): FakeQueryStep => new StampedStep(SdkMessages.assistant(uuid, [SdkMessages.text(text)], model));

const blocked = "<tool_use_error>Blocked: standalone sleep 300. To wait for a condition, use Monitor with an until-loop.</tool_use_error>";
const rejected = "The user doesn't want to proceed with this tool use. The tool use was rejected (eg. if it was a file edit, the new_string was NOT written to the file)";
const report = "There are **3** regular files directly in `/work`.\n\nI used this command:\n```\ncd /work && find . -maxdepth 1 -type f | wc -l\n```\n\n"
  + "The count includes hidden files. It leaves out subdirectories, anything inside them, and symlinks.";
const unknown = "Agent type 'no-such-agent-type-889' not found. Available agents: claude, Explore, general-purpose, Plan, statusline-setup";
const counted = "The sub-agent found 3 regular files in the current folder (hidden files counted, subfolders and symlinks not).";
const refused = "The launch failed with \"Agent type 'no-such-agent-type-889' not found\".";
const stopped = "You stopped the sub-agent before it finished, so it never ran `sleep 300` to completion or reported \"done\".";
const launched = "The background sub-agent has started and will run `sleep 20`, then say done.";
const finished = "The background sub-agent finished: it ran `sleep 20` and said \"done\".";
const counting = "Count the files in the current working directory (/work) using a shell command. Report the number and the exact command you used.";

export const ClaudeSubAgentRecording: { readonly source: string; readonly completed: readonly FakeQueryStep[]; readonly failed: readonly FakeQueryStep[];
  readonly stopped: readonly FakeQueryStep[]; readonly interrupted: readonly FakeQueryStep[]; readonly background: readonly FakeQueryStep[] } = {
  "source": "Claude Code 2.1.312 through the Agent SDK 0.3.263, recorded 2026-11-04 on Linux x64: a general-purpose sub-agent that counted files, a spawn of an unknown type, "
    + "one stopped with stopTask and one whose turn was interrupted while it waited on `sleep 300`, and a background one that ran `sleep 20` and woke the chat; "
    + "with sample session ids, uuids, two tool ids, paths and process ids, shorter prompts and tool texts, and the sub-agents' ToolSearch and pgrep steps left out",
  "completed": [
    new WaitForInputStep(),
    SdkMessages.init(session, "none", null, []),
    new StampedStep(SdkMessages.assistant("88900000-0000-4000-8000-000000000001", [SdkMessages.toolUse("toolu_01JqTjMAPBNEqPYKBVWxGYBa", "Agent",
      { description: "Count files in folder", subagent_type: "general-purpose", prompt: counting, run_in_background: false })], model)),
    started("a35fce204c3550ca8", "toolu_01JqTjMAPBNEqPYKBVWxGYBa", false, "Count files in folder", "local_agent"),
    SdkMessages.user("88900000-0000-4000-8000-000000000002", counting, "toolu_01JqTjMAPBNEqPYKBVWxGYBa"),
    progress("a35fce204c3550ca8", "Running Count regular files in current directory", 1, 11351, 1810),
    call("88900000-0000-4000-8000-000000000003", "toolu_01F51Gcjikaj8RgkaHtoQgKS", "Bash", { command: "find . -maxdepth 1 -type f | wc -l",
      description: "Count regular files in current directory" }, "toolu_01JqTjMAPBNEqPYKBVWxGYBa"),
    answer("88900000-0000-4000-8000-000000000004", "toolu_01F51Gcjikaj8RgkaHtoQgKS", "3", false, "toolu_01JqTjMAPBNEqPYKBVWxGYBa"),
    ended("a35fce204c3550ca8", "completed", report, { total_tokens: 12480, tool_uses: 1, duration_ms: 4509 }),
    SdkMessages.user("88900000-0000-4000-8000-000000000005", [SdkMessages.toolResult("toolu_01JqTjMAPBNEqPYKBVWxGYBa", [SdkMessages.textParam(report)])], null,
      { status: "completed", agentId: "a35fce204c3550ca8", agentType: "general-purpose", toolsUsed: ["Bash"], resolvedModel: model, totalDurationMs: 4518, totalTokens: 12381,
        totalToolUseCount: 1 }),
    said("88900000-0000-4000-8000-000000000006", counted),
    new StampedStep(SdkMessages.success(session, counted))
  ],
  "failed": [
    new WaitForInputStep(),
    SdkMessages.init(session, "none", null, []),
    new StampedStep(SdkMessages.assistant("88900000-0000-4000-8000-000000000011", [SdkMessages.toolUse("toolu_0138TTvXzvacmcJtX5YZ3Hos", "Agent",
      { description: "Say hi", prompt: "say hi", subagent_type: "no-such-agent-type-889" })], model)),
    SdkMessages.user("88900000-0000-4000-8000-000000000012", [SdkMessages.toolResult("toolu_0138TTvXzvacmcJtX5YZ3Hos", unknown, true)], null, `Error: ${unknown}`),
    said("88900000-0000-4000-8000-000000000013", refused),
    new StampedStep(SdkMessages.success(session, refused))
  ],
  "stopped": [
    new WaitForInputStep(),
    SdkMessages.init(session, "none", null, []),
    new StampedStep(SdkMessages.assistant("88900000-0000-4000-8000-000000000021", [SdkMessages.toolUse("toolu_01Ac89Zc1D5MGW2jTvpD1pHd", "Agent",
      { description: "Sleep 300 then report done", subagent_type: "general-purpose", prompt: "Run the shell command `sleep 300`, then reply with just \"done\"." })], model)),
    started("addca31bb0eff8f7c", "toolu_01Ac89Zc1D5MGW2jTvpD1pHd", false, "Sleep 300 then report done", "local_agent"),
    call("88900000-0000-4000-8000-000000000022", "toolu_01EMqVhn1kV7JgBk9QSV9iTX", "Bash", { command: "sleep 300", description: "Sleep for 300 seconds", timeout: 360000 },
      "toolu_01Ac89Zc1D5MGW2jTvpD1pHd"),
    answer("88900000-0000-4000-8000-000000000023", "toolu_01EMqVhn1kV7JgBk9QSV9iTX", blocked, true, "toolu_01Ac89Zc1D5MGW2jTvpD1pHd"),
    progress("addca31bb0eff8f7c", "Running Sleep for 300 seconds", 1, 11248, 1694),
    call("88900000-0000-4000-8000-000000000024", "toolu_01EcyxGSomGmmv3EdYTgC3Vz", "Bash", { command: "sleep 300", description: "Sleep for 300 seconds in background",
      timeout: 360000, run_in_background: true }, "toolu_01Ac89Zc1D5MGW2jTvpD1pHd"),
    progress("addca31bb0eff8f7c", "Running Sleep for 300 seconds in background", 2, 12364, 3531),
    shell("b1gq8m9hc", "toolu_01EcyxGSomGmmv3EdYTgC3Vz", true, "Sleep for 300 seconds in background", "addca31bb0eff8f7c"),
    answer("88900000-0000-4000-8000-000000000025", "toolu_01EcyxGSomGmmv3EdYTgC3Vz",
      "Command running in background with ID: b1gq8m9hc. Output is being written to: /work/.claude/tasks/b1gq8m9hc.output", false, "toolu_01Ac89Zc1D5MGW2jTvpD1pHd"),
    call("88900000-0000-4000-8000-000000000026", "toolu_011sfk5o94SWQ7MjoEv77XYk", "Monitor", { command: "while pgrep -f \"^sleep 300$\" >/dev/null; do sleep 2; done; echo finished",
      description: "wait for background sleep 300 to finish", timeout_ms: 360000 }, "toolu_01Ac89Zc1D5MGW2jTvpD1pHd"),
    progress("addca31bb0eff8f7c", "Monitoring: wait for background sleep 300 to finish", 4, 15900, 7050),
    shell("bok9bguss", "toolu_011sfk5o94SWQ7MjoEv77XYk", true, "wait for background sleep 300 to finish", "addca31bb0eff8f7c"),
    answer("88900000-0000-4000-8000-000000000027", "toolu_011sfk5o94SWQ7MjoEv77XYk", "Monitor started (task bok9bguss, expires in 6m unless the source ends first).", false,
      "toolu_01Ac89Zc1D5MGW2jTvpD1pHd"),
    call("88900000-0000-4000-8000-000000000028", "toolu_01Dx9UpRRKSVg3J7skqkNhQK", "Bash", { command: "while kill -0 1001 2>/dev/null; do sleep 2; done; echo finished",
      description: "Wait until the background sleep process exits", timeout: 360000 }, "toolu_01Ac89Zc1D5MGW2jTvpD1pHd"),
    progress("addca31bb0eff8f7c", "Running Wait until the background sleep process exits", 6, 17068, 12591),
    shell("bfjhe7ral", "toolu_01Dx9UpRRKSVg3J7skqkNhQK", false, "Wait until the background sleep process exits", "addca31bb0eff8f7c"),
    new WaitForStopStep(),
    ended("addca31bb0eff8f7c", "stopped", "Sleep 300 then report done"),
    ended("bfjhe7ral", "stopped", "Wait until the background sleep process exits"),
    answer("88900000-0000-4000-8000-000000000029", "toolu_01Dx9UpRRKSVg3J7skqkNhQK", rejected, true, "toolu_01Ac89Zc1D5MGW2jTvpD1pHd"),
    ended("b1gq8m9hc", "stopped", "Sleep for 300 seconds in background"),
    ended("bok9bguss", "stopped", "wait for background sleep 300 to finish"),
    SdkMessages.user("88900000-0000-4000-8000-00000000002a", [SdkMessages.toolResult("toolu_01Ac89Zc1D5MGW2jTvpD1pHd", "[Request interrupted by user for tool use]", true)], null,
      "Error: [Request interrupted by user for tool use]"),
    said("88900000-0000-4000-8000-00000000002b", stopped),
    new StampedStep(SdkMessages.success(session, stopped))
  ],
  "interrupted": [
    new WaitForInputStep(),
    SdkMessages.init(session, "none", null, []),
    new StampedStep(SdkMessages.assistant("88900000-0000-4000-8000-000000000031", [SdkMessages.toolUse("toolu_01VVgcuvMKAyd2YWSUPFYwWw", "Agent",
      { description: "Run sleep 300", subagent_type: "general-purpose", prompt: "Run the shell command `sleep 300`, then reply with just \"done\".", run_in_background: false })],
    model)),
    started("a2dba825497ba7490", "toolu_01VVgcuvMKAyd2YWSUPFYwWw", false, "Run sleep 300", "local_agent"),
    call("88900000-0000-4000-8000-000000000032", "toolu_01XQJ4bGx9ra5p6NWydCsScn", "Bash", { command: "sleep 300", description: "Wait for 300 seconds", timeout: 360000 },
      "toolu_01VVgcuvMKAyd2YWSUPFYwWw"),
    answer("88900000-0000-4000-8000-000000000033", "toolu_01XQJ4bGx9ra5p6NWydCsScn", blocked, true, "toolu_01VVgcuvMKAyd2YWSUPFYwWw"),
    progress("a2dba825497ba7490", "Running Wait for 300 seconds", 1, 11242, 2285),
    call("88900000-0000-4000-8000-000000000034", "toolu_019riauVwpLhDQDaCsMgCExH", "Bash", { command: "sleep 300", description: "Wait for 300 seconds in background",
      timeout: 360000, run_in_background: true }, "toolu_01VVgcuvMKAyd2YWSUPFYwWw"),
    progress("a2dba825497ba7490", "Running Wait for 300 seconds in background", 2, 12441, 5486),
    shell("b2enlaebf", "toolu_019riauVwpLhDQDaCsMgCExH", true, "Wait for 300 seconds in background", "a2dba825497ba7490"),
    answer("88900000-0000-4000-8000-000000000035", "toolu_019riauVwpLhDQDaCsMgCExH",
      "Command running in background with ID: b2enlaebf. Output is being written to: /work/.claude/tasks/b2enlaebf.output", false, "toolu_01VVgcuvMKAyd2YWSUPFYwWw"),
    call("88900000-0000-4000-8000-000000000036", "toolu_01AQpDoxNiErpSWyCcR1sqdc", "Bash", { command: "until ! pgrep -f \"^sleep 300$\" >/dev/null; do sleep 2; done; echo finished",
      description: "Wait until the background sleep exits", timeout: 360000 }, "toolu_01VVgcuvMKAyd2YWSUPFYwWw"),
    progress("a2dba825497ba7490", "Running Wait until the background sleep exits", 5, 16291, 14442),
    shell("blizfiiv7", "toolu_01AQpDoxNiErpSWyCcR1sqdc", false, "Wait until the background sleep exits", "a2dba825497ba7490"),
    new WaitForInterruptStep(),
    ended("blizfiiv7", "stopped", "Wait until the background sleep exits"),
    SdkMessages.user("88900000-0000-4000-8000-000000000037", [SdkMessages.toolResult("toolu_01VVgcuvMKAyd2YWSUPFYwWw", rejected, true)], null, "User rejected tool use"),
    ended("b2enlaebf", "stopped", "Wait for 300 seconds in background"),
    ended("a2dba825497ba7490", "stopped", "Run sleep 300"),
    new StampedStep(SdkMessages.failure(session, "error_during_execution", ["[ede_diagnostic] result_type=user last_content_type=n/a stop_reason=tool_use"]))
  ],
  "background": [
    new WaitForInputStep(),
    SdkMessages.init(session, "none", null, []),
    new StampedStep(SdkMessages.assistant("88900000-0000-4000-8000-000000000041", [SdkMessages.toolUse("toolu_01RPzB9ZSUzcBdr6SChM22Tx", "Agent",
      { description: "Run sleep 20", subagent_type: "general-purpose", prompt: "Run the shell command `sleep 20` using the Bash tool, then reply with just \"done\".",
        run_in_background: true })], model)),
    started("a947d08ffc092c15f", "toolu_01RPzB9ZSUzcBdr6SChM22Tx", true, "Run sleep 20", "local_agent"),
    SdkMessages.user("88900000-0000-4000-8000-000000000042", [SdkMessages.toolResult("toolu_01RPzB9ZSUzcBdr6SChM22Tx", [SdkMessages.textParam("Async agent launched successfully.")])],
      null, { isAsync: true, status: "async_launched", agentId: "a947d08ffc092c15f", description: "Run sleep 20", resolvedModel: model }),
    said("88900000-0000-4000-8000-000000000043", launched),
    new StampedStep(SdkMessages.success(session, launched)),
    call("88900000-0000-4000-8000-000000000044", "toolu_01H5KPq9NQ3PM5NmAG3pFRAK", "Bash", { command: "sleep 20", description: "Wait 20 seconds" }, "toolu_01RPzB9ZSUzcBdr6SChM22Tx"),
    progress("a947d08ffc092c15f", "Running Wait 20 seconds", 1, 9960, 1625),
    shell("bvoy3xj0f", "toolu_01H5KPq9NQ3PM5NmAG3pFRAK", false, "Wait 20 seconds", "a947d08ffc092c15f"),
    ended("bvoy3xj0f", "completed", "Wait 20 seconds"),
    answer("88900000-0000-4000-8000-000000000045", "toolu_01H5KPq9NQ3PM5NmAG3pFRAK", "(Bash completed with no output)", false, "toolu_01RPzB9ZSUzcBdr6SChM22Tx"),
    SdkMessages.assistant("88900000-0000-4000-8000-000000000046", [SdkMessages.text("done")], model, "toolu_01RPzB9ZSUzcBdr6SChM22Tx"),
    ended("a947d08ffc092c15f", "completed", "done", { total_tokens: 10787, tool_uses: 1, duration_ms: 22675 }),
    SdkMessages.init(session, "none", null, []),
    SdkMessages.assistant("88900000-0000-4000-8000-000000000047", [SdkMessages.text(finished)], model),
    SdkMessages.success(session, finished)
  ]
};
