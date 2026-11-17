/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { CliCommandResult, UsageException } from "@noldova/desktop.cli";
import { ConversationSearchParams, ConversationSearchResult, MethodName } from "@noldova/teamrun.protocol";

import { Resources } from "../resources.js";
import type { CommandValues } from "./command-values.js";
import type { RuntimeClient } from "./runtime-client.js";
import { TeamRunCommand } from "./teamrun-command.js";

export class SearchCommand extends TeamRunCommand {
  public readonly name: string = Resources.searchCommand;

  public constructor(client: RuntimeClient) {
    super(client);
  }

  protected async runAsync(values: CommandValues, signal: AbortSignal): Promise<CliCommandResult> {
    const limit = values.readInteger(Resources.limitValue);
    if (limit < 1 || limit > Resources.maximumSearchLimit)
      throw new UsageException(Resources.searchLimitOutOfRange);
    const params = new ConversationSearchParams(values.readWords(Resources.textValue), limit);
    const hits = ConversationSearchResult.fromJson(await this.client.requestAsync(MethodName.ConversationSearch, params.toJson(), signal)).hits;
    return new CliCommandResult(hits.map(t => t.toJson()), Resources.formatList(hits.map(t => Resources.formatSearchHit(t))));
  }
}
