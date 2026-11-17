/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { JsonReader } from "@noldova/context.json";
import { Assert } from "@noldova/context.testing";
import { SharedMcpValues, TurnOutcome, TurnRequest, type TurnResult } from "@noldova/teamrun.core";
import { MessageAttachment } from "@noldova/teamrun.protocol";
import { type AcpAdapter, Resources } from "@noldova/teamrun.providers";

import { RecordingTurnListener } from "./recording-turn-listener.fixture.js";

export class AcpCommandCheck {
  public static environment(directory: string): NodeJS.ProcessEnv {
    return { TEAMRUN_FAKE_ACP_COMMANDS: "review,/init", TEAMRUN_FAKE_ACP_PROMPTS: join(directory, "prompts.txt") };
  }

  public static async passesOnlyListedCommandsAsync(adapter: AcpAdapter, request: TurnRequest, directory: string): Promise<void> {
    const kind = adapter.descriptor.displayName;
    const prompts = (): readonly string[] => existsSync(join(directory, "prompts.txt"))
      ? readFileSync(join(directory, "prompts.txt"), "utf8").split("\n").filter(t => t.length > 0).map(t => JsonReader.parse(t).readString("text")) : [];
    const run = async (text: string, resume: string | null, command: string | null,
      attachments: readonly MessageAttachment[] = [], freshPrompt: string | null = null): Promise<{ result: TurnResult; texts: readonly string[] }> => {
      const listener = new RecordingTurnListener();
      const result = await adapter.runTurn(new TurnRequest(request.provider, request.workingDirectory, text, request.requested, resume, attachments, "Review carefully",
        freshPrompt, request.environment, false, null, [], null, () => false, SharedMcpValues.none, null, false, command), listener, new AbortController().signal);
      return { result, texts: listener.texts };
    };

    const listed = await run("Task: /review src", null, "/review src");
    const session = listed.result.nativeSessionId;
    const unlistedFresh = await run("Task: /deploy now", null, "/deploy now");
    const unlisted = await run("Task: /deploy now", session, "/deploy now");
    const filed = await run("Task: /review", session, "/review", [new MessageAttachment("notes.txt", "text/plain", 5, join(directory, "notes.txt"))]);
    const next = await run("go on", session, null, [], "Earlier: hello. go on");
    const after = await run("and then", session, null, [], "Earlier: hello. go on. and then");

    Assert.areEqual(TurnOutcome.Completed, listed.result.outcome);
    Assert.isNotNull(session);
    Assert.isTrue(listed.texts.includes("/review src"));
    for (const refused of [unlistedFresh, unlisted])
      Assert.areEqual(JSON.stringify([TurnOutcome.Completed, [Resources.formatCommandUnlisted(kind, "/deploy", ["review", "init"])]]),
        JSON.stringify([refused.result.outcome, refused.texts]));
    Assert.isNull(unlistedFresh.result.nativeSessionId);
    Assert.areEqual(session, unlisted.result.nativeSessionId);
    Assert.areEqual(JSON.stringify([TurnOutcome.Completed, session, [Resources.formatCommandWithFiles(kind, "/review")]]),
      JSON.stringify([filed.result.outcome, filed.result.nativeSessionId, filed.texts]));
    Assert.areEqual(`${TurnOutcome.Completed},${TurnOutcome.Completed}`, [next.result.outcome, after.result.outcome].join(","));
    const [first, second, third] = prompts();
    Assert.areEqual(JSON.stringify(["/review src", true, true, 3]), JSON.stringify([first, second?.includes("Review carefully") === true
      && second.endsWith("Earlier: hello. go on"), third?.endsWith("and then") === true && !third.includes("Earlier"), prompts().length]));
  }
}
