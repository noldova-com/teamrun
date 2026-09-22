/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/teamrun-foundation-core";
import { MessageIdParams, MessageSendResult, MethodName } from "@noldova/teamrun-protocol";

import { DecisionPolicy } from "../../enums/decision-policy.js";
import type { CommandContext } from "../../models/command-context.js";
import { Resources } from "../../resources.js";
import type { OutputWriter } from "../output-writer.js";
import { RepliesFollower } from "../replies-follower.js";
import type { RuntimeSession } from "../runtime-session.js";
import { RuntimeCommand } from "./runtime-command.js";
import { SendCommand } from "./send-command.js";

export class ChatCommand extends RuntimeCommand {
  public readonly name: string = Resources.chatCommand;
  public readonly description: string = Resources.chatDescription;
  private openReplyId: string | null = null;
  private cancelRequested: boolean = false;
  private cancelling: Promise<void> | null = null;

  protected override async execute(session: RuntimeSession, context: CommandContext, _output: OutputWriter): Promise<number> {
    const conversationId = context.commandLine.requirePositional(0, Resources.conversationIdArgument);
    const cancel = (): void => this.cancel(session, context);
    context.signals.on(Resources.interruptSignal, cancel);
    context.console.write(Resources.chatWelcome);
    try {
      let text = await context.console.ask(Resources.chatPrompt);
      while (!Object.isNull(text) && !String.isNullOrWhitespace(text)) {
        await this.exchange(session, context, conversationId, text);
        text = await context.console.ask(Resources.chatPrompt);
      }
    }
    finally {
      context.signals.off(Resources.interruptSignal, cancel);
    }

    return Resources.exitSuccess;
  }

  private async exchange(session: RuntimeSession, context: CommandContext, conversationId: string, text: string): Promise<void> {
    const follower = new RepliesFollower(session, context.console, DecisionPolicy.Ask, true);
    const subscription = session.subscribe(follower);
    try {
      const params = await SendCommand.createParams(session, context, conversationId, text);
      const sent = MessageSendResult.fromJson(await session.call(MethodName.MessageSend, params.toJson()));
      this.openReplyId = sent.replies[0]?.id ?? null;
      if (this.cancelRequested)
        this.cancel(session, context);
      await follower.follow(sent.replies);
      if (!Object.isNull(this.cancelling))
        await this.cancelling;
    }
    finally {
      this.openReplyId = null;
      this.cancelRequested = false;
      this.cancelling = null;
      subscription[Symbol.dispose]();
    }
  }

  private cancel(session: RuntimeSession, context: CommandContext): void {
    if (Object.isNull(this.openReplyId)) {
      this.cancelRequested = true;
      return;
    }
    if (!Object.isNull(this.cancelling))
      return;

    this.cancelling = session.call(MethodName.MessageCancel, new MessageIdParams(this.openReplyId).toJson()).then(() => undefined);
    context.console.write(Resources.cancelRequested);
  }
}
