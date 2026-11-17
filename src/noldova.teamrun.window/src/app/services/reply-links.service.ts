/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Injectable, inject } from "@angular/core";

import "@noldova/context.core";
import { type IWindowPartContext, type LinkGesture, WindowPartTokens } from "@noldova/desktop.window";
import { type Message, WrittenImageReader } from "@noldova/teamrun.protocol";
import { DialogService } from "@noldova/ui.components.angular";

import { Resources } from "../../resources";
import { ChatAction } from "../enums/chat-action";
import { ImageOpenMode } from "../enums/image-open-mode";
import { ImageViewerData } from "../models/image-viewer-data";
import { ViewedImage } from "../models/viewed-image";
import { ImageDialogComponent } from "../components/image-dialog/image-dialog.component";
import { ChatStoreService } from "./chat-store.service";
import { ConversationActions } from "./conversation-actions";
import { ImageViewerService } from "./image-viewer.service";

@Injectable()
export class ReplyLinksService {
  private readonly context: IWindowPartContext = inject(WindowPartTokens.context);
  private readonly store: ChatStoreService = inject(ChatStoreService);
  private readonly dialogs: DialogService = inject(DialogService);
  private readonly viewer: ImageViewerService = inject(ImageViewerService);

  public static nameOf(path: string): string {
    const name = path.slice(Math.max(path.lastIndexOf(Resources.slash), path.lastIndexOf(Resources.backslash)) + 1);
    return name.length === 0 ? path : name;
  }

  public static pathOf(target: string, rootPath: string | null): string | null {
    const reader = new WrittenImageReader();
    return (Object.isNull(rootPath) ? null : reader.linkedPathOf(target, rootPath)) ?? reader.localPathOf(target);
  }

  public openLink(url: string, gesture: LinkGesture): void {
    if (!url.startsWith(Resources.chatLinkPrefix)) {
      void this.context.openLinkAsync(url, { gesture });
      return;
    }
    const chat = this.store.conversation(url.slice(Resources.chatLinkPrefix.length));
    if (!Object.isNull(chat))
      ConversationActions.open(this.context, this.store, chat);
  }

  public showChatPage(conversationId: string): void {
    this.store.showChatPage(conversationId);
  }

  public openFile(target: string, message: Message, rootPath: string | null, images: readonly ViewedImage[] = []): void {
    const reader = new WrittenImageReader();
    const path = Object.isNull(rootPath) ? null : reader.linkedPathOf(target, rootPath);
    if (Object.isNull(rootPath) || Object.isNull(path)) {
      const local = reader.localPathOf(target);
      if (Object.isNull(local))
        this.store.reportFailure(ChatAction.OpenFile, target, Resources.formatLinkedFileRefused(ReplyLinksService.nameOf(target)), message.conversationId);
      else
        void this.openLinkedFileAsync(local, message, Resources.imageExtensionPattern.test(local));
      return;
    }
    const linked = reader.markdownLinkImagePathsOf(message, rootPath).map(t => ViewedImage.written(message.conversationId, message.id, t));
    const viewed = [...linked, ...images].filter((t, i, all) => all.findIndex(u => u.key === t.key) === i);
    const image = viewed.find(t => t.path === path);
    if (Object.isUndefined(image))
      void this.openLinkedFileAsync(path, message);
    else if (this.viewer.openMode() === ImageOpenMode.Tab)
      this.viewer.openTab(image);
    else
      ImageDialogComponent.open(this.dialogs, this.viewer, new ImageViewerData(image, viewed), null);
  }

  private async openLinkedFileAsync(path: string, message: Message, isShownOnly: boolean = false): Promise<void> {
    try {
      if (isShownOnly || await this.store.isLinkedFolderAsync(message, path))
        await this.context.showInFolderAsync(path);
      else
        await this.context.openFileAsync(path).catch(() => this.context.showInFolderAsync(path));
    }
    catch {
      if (!this.store.isDeleted(message.conversationId))
        this.store.reportFailure(ChatAction.OpenFile, path, Resources.formatLinkedFileFailed(ReplyLinksService.nameOf(path)), message.conversationId);
    }
  }
}
