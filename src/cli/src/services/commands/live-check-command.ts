/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import "@noldova/teamrun-foundation-core";
import {
  Conversation,
  ConversationCreateParams,
  ConversationIdParams,
  MessageStatus,
  MessageSendParams,
  RequestedSettings,
  MethodName,
  Project,
  ProjectIdParams,
  ProjectOpenParams
} from "@noldova/teamrun-protocol";

import { DecisionPolicy } from "../../enums/decision-policy.js";
import type { CommandContext } from "../../models/command-context.js";
import { LiveCheckReport } from "../../models/live-check-report.js";
import { Resources } from "../../resources.js";
import type { OutputWriter } from "../output-writer.js";
import type { RuntimeSession } from "../runtime-session.js";
import { RuntimeCommand } from "./runtime-command.js";
import { SendCommand } from "./send-command.js";

export class LiveCheckCommand extends RuntimeCommand {
  public readonly name: string = Resources.liveCheckCommand;
  public readonly description: string = Resources.liveCheckDescription;

  protected override async execute(session: RuntimeSession, context: CommandContext, output: OutputWriter): Promise<number> {
    context.commandLine.requireOption(Resources.providerOption);
    const prompt = context.commandLine.option(Resources.promptOption) ?? Resources.liveCheckPrompt;
    const fixture = mkdtempSync(join(tmpdir(), Resources.liveCheckDirectoryPrefix));
    const startedAt = Date.now();
    try {
      const projectPath = join(fixture, Resources.liveCheckProjectDirectoryName);
      mkdirSync(projectPath);
      const project = Project.fromJson(await session.call(MethodName.ProjectOpen, new ProjectOpenParams(projectPath).toJson()));
      writeFileSync(join(projectPath, Resources.liveCheckReadme), Resources.liveCheckReadmeText);
      const conversationParams = new ConversationCreateParams(project.id, Resources.liveCheckConversationTitle);
      const conversation = Conversation.fromJson(await session.call(MethodName.ConversationCreate, conversationParams.toJson()));
      const requested = new RequestedSettings(context.commandLine.requireOption(Resources.providerOption),
        context.commandLine.option(Resources.modelOption), context.commandLine.option(Resources.effortOption));
      const params = new MessageSendParams(conversation.id, prompt, requested, context.commandLine.option(Resources.accountOption));
      const outcomes = await SendCommand.sendAndFollow(session, context, params, DecisionPolicy.Deny);
      await session.call(MethodName.ConversationDelete, new ConversationIdParams(conversation.id).toJson());
      await session.call(MethodName.ProjectForget, new ProjectIdParams(project.id).toJson());
      const report = new LiveCheckReport(context.commandLine.requireOption(Resources.providerOption), prompt, projectPath, outcomes, Date.now() - startedAt);
      this.writeEvidence(context, report);
      output.writeJsonOnly(report.toJson());

      return outcomes.length === 1 && outcomes[0]?.reply.status === MessageStatus.Completed ? Resources.exitSuccess : Resources.exitFailure;
    }
    finally {
      LiveCheckCommand.removeFixture(context, fixture);
    }
  }

  private static removeFixture(context: CommandContext, fixture: string): void {
    try {
      rmSync(fixture, { recursive: true });
    }
    catch (error: unknown) {
      context.console.writeError(Resources.formatFixtureKept(fixture, String(error)));
    }
  }

  private writeEvidence(context: CommandContext, report: LiveCheckReport): void {
    const path = context.commandLine.option(Resources.evidenceOption);
    if (Object.isNull(path))
      return;

    writeFileSync(path, `${JSON.stringify(report.toJson(), null, Resources.jsonIndent)}${Resources.lineSeparator}`);
    context.console.write(Resources.formatEvidenceWritten(path));
  }
}
