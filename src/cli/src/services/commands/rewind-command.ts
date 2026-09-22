/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/teamrun-foundation-core";
import { ConversationRewindParams, ConversationRewindResult, MethodName } from "@noldova/teamrun-protocol";

import type { CommandContext } from "../../models/command-context.js";
import { Resources } from "../../resources.js";
import type { OutputWriter } from "../output-writer.js";
import type { RuntimeSession } from "../runtime-session.js";
import { RuntimeCommand } from "./runtime-command.js";

export class RewindCommand extends RuntimeCommand {
  public readonly name: string = Resources.rewindCommand;
  public readonly description: string = Resources.rewindDescription;

  protected override async execute(session: RuntimeSession, context: CommandContext, output: OutputWriter): Promise<number> {
    const conversationId = context.commandLine.requirePositional(0, Resources.idArgument);
    const messageId = context.commandLine.requirePositional(1, Resources.messageIdArgument);
    const params = new ConversationRewindParams(conversationId, messageId, context.commandLine.hasFlag(Resources.restoreFilesOption));
    const result = await session.call(MethodName.ConversationRewind, params.toJson());
    output.writeObject(result, t => {
      const rewound = ConversationRewindResult.fromJson(t.toJson());
      return Resources.formatRewound(rewound.removedMessageIds.length, rewound.restoredFiles, rewound.sessionKept);
    });
    return Resources.exitSuccess;
  }
}
