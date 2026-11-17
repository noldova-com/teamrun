/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { ToolCall } from "@noldova/desktop.runtime";
import "@noldova/context.core";
import { JsonReader } from "@noldova/context.json";
import { type IConversationsService, Resources as CoreResources } from "@noldova/teamrun.core";
import { PageAuthor } from "@noldova/teamrun.protocol";

import type { IPagesHost } from "../interfaces/pages/i-pages-host.js";
import { Resources } from "../resources.js";

export class TeamRunPagesHost implements IPagesHost {
  private readonly conversations: Pick<IConversationsService, "findAsync">;

  public constructor(conversations: Pick<IConversationsService, "findAsync">) {
    this.conversations = conversations;
  }

  public chatOf(call: ToolCall): string {
    return call.scope.slice(0, call.scope.indexOf(CoreResources.toolScopeSeparator));
  }

  public folderOf(call: ToolCall): string {
    return JsonReader.fromValue(call.bindings).readNonBlankString(Resources.terminalFolderBinding);
  }

  public authorOf(call: ToolCall): PageAuthor {
    const scoped = call.scope.slice(call.scope.indexOf(CoreResources.toolScopeSeparator) + CoreResources.toolScopeSeparator.length);
    return new PageAuthor(scoped === CoreResources.defaultToolScope ? null : scoped,
      JsonReader.fromValue(call.bindings).readNonBlankString(Resources.browserAgentBinding));
  }

  public async hasChatAsync(chatId: string): Promise<boolean> {
    return !Object.isNull(await this.conversations.findAsync(chatId));
  }
}
