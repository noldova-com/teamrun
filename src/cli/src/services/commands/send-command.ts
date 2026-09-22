/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/teamrun-foundation-core";
import { JsonReader } from "@noldova/teamrun-foundation-json";
import { MessageIdParams, MessageSendParams, MessageSendResult, MessageStatus, MethodName, RequestedSettings,
  MentionResolver, Teammate, TeammateMention, TeammateName } from "@noldova/teamrun-protocol";

import { DecisionPolicy } from "../../enums/decision-policy.js";
import type { CommandContext } from "../../models/command-context.js";
import type { ReplyOutcome } from "../../models/reply-outcome.js";
import { Resources } from "../../resources.js";
import type { OutputWriter } from "../output-writer.js";
import { RepliesFollower } from "../replies-follower.js";
import { UsageException } from "../../exceptions/usage.exception.js";
import type { RuntimeSession } from "../runtime-session.js";
import { RuntimeCommand } from "./runtime-command.js";

export class SendCommand extends RuntimeCommand {
  public readonly name: string = Resources.sendCommand;
  public readonly description: string = Resources.sendDescription;

  protected override async execute(session: RuntimeSession, context: CommandContext, output: OutputWriter): Promise<number> {
    const conversationId = context.commandLine.requirePositional(0, Resources.conversationIdArgument);
    const text = context.commandLine.requirePositional(1, Resources.textArgument);
    const params = await SendCommand.createParams(session, context, conversationId, text);
    const outcomes = await SendCommand.sendAndFollow(session, context, params, SendCommand.readPolicy(context));
    output.writeJsonOnly(outcomes.map(t => t.reply.toJson()));

    return outcomes.every(t => t.reply.status === MessageStatus.Completed) ? Resources.exitSuccess : Resources.exitFailure;
  }

  public static async sendAndFollow(
    session: RuntimeSession,
    context: CommandContext,
    params: MessageSendParams,
    policy: DecisionPolicy): Promise<readonly ReplyOutcome[]> {
    const follower = new RepliesFollower(session, context.console, policy, SendCommand.echoes(context));
    const subscription = session.subscribe(follower);
    let firstReplyId: string | null = null;
    let cancelRequested = false;
    let cancellation: Promise<void> | null = null;
    const cancellationFailure = Promise.withResolvers<never>();
    const cancel = (): void => {
      cancelRequested = true;
      if (!Object.isNull(firstReplyId) && Object.isNull(cancellation))
        cancellation = session.call(MethodName.MessageCancel, new MessageIdParams(firstReplyId).toJson())
          .then(() => undefined, error => cancellationFailure.reject(error));
    };
    context.signals.on(Resources.interruptSignal, cancel);
    try {
      const sent = MessageSendResult.fromJson(await session.call(MethodName.MessageSend, params.toJson()));
      firstReplyId = sent.replies[0]?.id ?? null;
      if (cancelRequested)
        cancel();
      const results = await Promise.race([follower.follow(sent.replies), cancellationFailure.promise]);
      if (!Object.isNull(cancellation))
        await cancellation;
      return results;
    }
    finally {
      context.signals.off(Resources.interruptSignal, cancel);
      subscription[Symbol.dispose]();
    }
  }

  public static async createParams(session: RuntimeSession, context: CommandContext, conversationId: string, text: string): Promise<MessageSendParams> {
    const commandLine = context.commandLine;
    const as = commandLine.option(Resources.asOption);
    let mentions: readonly TeammateMention[] = [];
    let responderId: string | null = null;
    if (!Object.isNull(as) || text.includes(Resources.mentionMarker)) {
      const listed = await session.call(MethodName.TeammateList, null);
      const teammates = JsonReader.fromValue({ [Resources.itemsField]: listed }).readObjectArray(Resources.itemsField)
        .map(t => Teammate.fromJson(t.toJson()));
      mentions = MentionResolver.resolve(text, teammates.map(t => new TeammateMention(t.id, t.name)));
      if (mentions.length === 0 && !Object.isNull(as)) {
        const responder = teammates.find(t => TeammateName.key(t.name) === TeammateName.key(as));
        if (Object.isUndefined(responder))
          throw new UsageException(Resources.formatUnknownTeammate(as));
        responderId = responder.id;
      }
    }
    const named = mentions.length > 0 || !Object.isNull(responderId);
    if (named && [Resources.modelOption, Resources.effortOption, Resources.accountOption].some(t => commandLine.hasFlag(t)))
      throw new UsageException(Resources.namedSettingsUseTeammateUpdate);
    const requested = named ? null : new RequestedSettings(commandLine.requireOption(Resources.providerOption),
      commandLine.option(Resources.modelOption), commandLine.option(Resources.effortOption));

    return new MessageSendParams(conversationId, text, requested, named ? null : commandLine.option(Resources.accountOption),
      [], mentions.map(t => t.teammateId), responderId);
  }

  public static echoes(context: CommandContext): boolean {
    return !context.settings.isJson;
  }

  public static readPolicy(context: CommandContext): DecisionPolicy {
    if (context.commandLine.hasFlag(Resources.approveOption))
      return DecisionPolicy.Approve;

    return context.commandLine.hasFlag(Resources.denyOption) ? DecisionPolicy.Deny : DecisionPolicy.Ask;
  }
}
