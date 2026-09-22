/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/teamrun-foundation-core";
import { ConversationSearchHit, ConversationSearchParams, ConversationSearchResult, MethodName } from "@noldova/teamrun-protocol";

import type { CommandContext } from "../../models/command-context.js";
import { Resources } from "../../resources.js";
import type { OutputWriter } from "../output-writer.js";
import type { RuntimeSession } from "../runtime-session.js";
import { RuntimeCommand } from "./runtime-command.js";

export class SearchCommand extends RuntimeCommand {
  public readonly name: string = Resources.searchCommand;
  public readonly description: string = Resources.searchDescription;

  protected override async execute(session: RuntimeSession, context: CommandContext, output: OutputWriter): Promise<number> {
    const query = context.commandLine.requirePositional(0, Resources.textArgument);
    const limit = context.commandLine.option(Resources.limitOption);
    const params = new ConversationSearchParams(query, Object.isNull(limit) ? Resources.defaultSearchLimit : Number(limit));
    const result = await session.call(MethodName.ConversationSearch, params.toJson());
    const hits = ConversationSearchResult.fromJson(result).hits;
    output.writeObjects(hits.map(t => t.toJson()), t => {
      const hit = ConversationSearchHit.fromJson(t.toJson());
      return Resources.formatSearchHit(hit.conversationId, hit.title, hit.snippet);
    });
    return Resources.exitSuccess;
  }
}
