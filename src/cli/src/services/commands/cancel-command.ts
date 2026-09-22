/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/teamrun-foundation-core";
import { JsonReader } from "@noldova/teamrun-foundation-json";
import { Message, MessageIdParams, MessageListParams, MessageStatus, MethodName } from "@noldova/teamrun-protocol";

import type { CommandContext } from "../../models/command-context.js";
import { Resources } from "../../resources.js";
import type { OutputWriter } from "../output-writer.js";
import type { RuntimeSession } from "../runtime-session.js";
import { RuntimeCommand } from "./runtime-command.js";

export class CancelCommand extends RuntimeCommand {
  private static readonly OPEN_STATUSES: readonly MessageStatus[] = [MessageStatus.Pending, MessageStatus.Running, MessageStatus.AwaitingApproval];

  public readonly name: string = Resources.cancelCommand;
  public readonly description: string = Resources.cancelDescription;

  protected override async execute(session: RuntimeSession, context: CommandContext, output: OutputWriter): Promise<number> {
    const conversationId = context.commandLine.requirePositional(0, Resources.conversationIdArgument);
    const listed = await session.call(MethodName.MessageList, new MessageListParams(conversationId, null).toJson());
    const messages = JsonReader.fromValue({ [Resources.itemsField]: listed })
      .readObjectArray(Resources.itemsField)
      .map(t => Message.fromJson(t.toJson()));
    const open = messages.find(t => CancelCommand.OPEN_STATUSES.includes(t.status));
    if (Object.isUndefined(open)) {
      context.console.writeError(Resources.noOpenReply);
      return Resources.exitFailure;
    }

    const cancelled = await session.call(MethodName.MessageCancel, new MessageIdParams(open.id).toJson());
    output.writeObject(cancelled, t => this.formatter.formatMessage(Message.fromJson(t.toJson())));
    return Resources.exitSuccess;
  }
}
