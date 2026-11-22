/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import type { IWindowPartContext } from "@noldova/desktop.window";
import type { Conversation, Project } from "@noldova/teamrun.protocol";
import type { DialogService } from "@noldova/ui.components.angular";

import { Resources } from "../../resources";
import { ConfirmDialogComponent } from "../components/confirm-dialog/confirm-dialog.component";
import { ChatAction } from "../enums/chat-action";
import { ConfirmRequest } from "../models/confirm-request";
import type { ChatStoreService } from "./chat-store.service";
import { ConversationActions } from "./conversation-actions";

export class ChatPlacement {
  private readonly context: IWindowPartContext;
  private readonly store: ChatStoreService;
  private readonly dialogs: DialogService;

  public constructor(context: IWindowPartContext, store: ChatStoreService, dialogs: DialogService) {
    this.context = context;
    this.store = store;
    this.dialogs = dialogs;
  }

  public moveToProject(conversation: Conversation, project: Project): Promise<void> {
    return this.moveInto(conversation, project.name, () => Promise.resolve(project));
  }

  public async moveToFolder(conversation: Conversation): Promise<void> {
    const folder = await this.context.chooseFolderAsync();
    if (!Object.isNull(folder))
      await this.moveInto(conversation, ConversationActions.folderNameOf(folder), () => this.store.openProject(folder));
  }

  public async attachFolder(conversation: Conversation): Promise<void> {
    const folder = await this.context.chooseFolderAsync();
    if (Object.isNull(folder))
      return;
    const attach = async (): Promise<void> => {
      await this.store.attachFolder(conversation.id, folder);
    };
    if (Object.isNull(conversation.attachedFolder))
      await attach();
    else
      this.confirm(new ConfirmRequest(Resources.replaceFolderTitle, Resources.formatReplaceFolderText(conversation.attachedFolder, folder),
        Resources.replaceFolderConfirmLabel), attach);
  }

  public async detachFolder(conversation: Conversation): Promise<void> {
    await this.store.detachFolder(conversation.id);
  }

  private async moveInto(conversation: Conversation, name: string, open: () => Promise<Project | null>): Promise<void> {
    const count = Object.isNull(conversation.projectId) ? await this.store.countFolderFilesAsync(conversation.id, ChatAction.MoveChat) : 0;
    if (Object.isNull(count))
      return;
    const move = async (): Promise<void> => {
      const project = await open();
      if (!Object.isNull(project))
        await this.store.moveConversation(conversation.id, project.id);
    };
    if (count === 0)
      await move();
    else
      this.confirm(new ConfirmRequest(Resources.moveTitle, Resources.formatMoveText(count, name), Resources.moveConfirmLabel), move);
  }

  private confirm(request: ConfirmRequest, action: () => Promise<void>): void {
    const dialog = this.dialogs.open(ConfirmDialogComponent, ".nol-teamrun-cancel");
    dialog.componentRef?.setInput("request", request);
    dialog.componentInstance?.answered.subscribe(confirmed => {
      dialog.close();
      if (confirmed)
        void action();
    });
  }
}
