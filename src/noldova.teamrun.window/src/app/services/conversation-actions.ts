/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import type { IWindowPartContext } from "@noldova/desktop.window";
import type { Conversation, ConversationSearchHit } from "@noldova/teamrun.protocol";

import { Resources } from "../../resources";
import { ComposerSettings } from "../models/composer-settings";
import type { ChatStoreService } from "./chat-store.service";
import { CommandTargetsService } from "./command-targets.service";

export class ConversationActions {
  public static open(context: IWindowPartContext, store: ChatStoreService, conversation: Conversation, preview: boolean = true): void {
    store.conversationOpening(conversation.id);
    context.openDocument(Resources.conversationDocumentName, conversation.id, conversation.title,
      { preview, breadcrumb: ConversationActions.breadcrumbOf(store, conversation.projectId, conversation.attachedFolder) });
  }

  public static async show(context: IWindowPartContext, store: ChatStoreService, hit: ConversationSearchHit): Promise<void> {
    store.conversationOpening(hit.conversationId);
    context.openDocument(Resources.conversationDocumentName, hit.conversationId, hit.title, { breadcrumb: ConversationActions.breadcrumbOf(store, hit.projectId, null) });
    await store.showMessage(hit);
  }

  public static start(context: IWindowPartContext, store: ChatStoreService, projectId: string | null,
    teammateId: string | null = null, report?: (message: string) => void): Promise<Conversation | null> {
    return CommandTargetsService.of(context).startOneAtATime(() => ConversationActions.startNext(context, store, projectId, teammateId, report));
  }

  public static async openProject(context: IWindowPartContext, store: ChatStoreService, report?: (message: string) => void): Promise<void> {
    const folder = await context.chooseFolderAsync();
    if (!Object.isNull(folder))
      await store.openProject(folder, report);
  }

  public static async step(context: IWindowPartContext, store: ChatStoreService, offset: number): Promise<void> {
    const target = await store.stepConversation(offset);
    if (!Object.isNull(target))
      ConversationActions.open(context, store, target);
  }

  public static breadcrumbOf(store: ChatStoreService, projectId: string | null, attachedFolder: string | null): readonly string[] {
    if (Object.isNull(projectId))
      return Object.isNull(attachedFolder) ? [Resources.chatsTitle] : [Resources.chatsTitle, ConversationActions.folderNameOf(attachedFolder)];
    const project = store.projects().find(t => t.id === projectId);
    return Object.isUndefined(project) ? [] : [project.name];
  }

  public static placeOf(store: ChatStoreService, conversation: Conversation | null): string | null {
    if (Object.isNull(conversation) || (Object.isNull(conversation.projectId) && Object.isNull(conversation.attachedFolder)))
      return null;
    return ConversationActions.breadcrumbOf(store, conversation.projectId, conversation.attachedFolder).at(-1) ?? null;
  }

  public static folderNameOf(folder: string): string {
    const name = folder.slice(Math.max(folder.lastIndexOf(Resources.slash), folder.lastIndexOf(Resources.backslash)) + 1);
    return String.isNullOrWhitespace(name) ? folder : name;
  }

  private static async startNext(context: IWindowPartContext, store: ChatStoreService, projectId: string | null,
    teammateId: string | null, report: ((message: string) => void) | undefined): Promise<Conversation | null> {
    const targets = CommandTargetsService.of(context);
    await store.waitForResponderWrites();
    const empty = await store.listEmptyConversations(projectId, report);
    if (Object.isNull(empty))
      return null;
    const candidates = store.conversationsOf(projectId).filter(t => empty.includes(t.id))
      .toSorted((a, b) => Number(targets.canFocusComposer(b.id)) - Number(targets.canFocusComposer(a.id)));
    let fresh: Conversation | null = null;
    let hasTeammate = false;
    for (const candidate of candidates.filter(t => targets.isFresh(t.id))) {
      const members = await store.listMembers(candidate.id, report);
      if (Object.isNull(members))
        return null;
      if (targets.isFresh(candidate.id) && members.every(t => t.teammateId === teammateId)) {
        fresh = candidate;
        hasTeammate = members.length > 0;
        break;
      }
    }
    const chat = Object.isNull(fresh) ? await store.createConversation(null, projectId, teammateId, report) : await store.touchConversation(fresh.id, report);
    if (Object.isNull(chat))
      return null;
    if (!Object.isNull(fresh) && !Object.isNull(teammateId) && !hasTeammate) {
      if (!await store.addMember(chat.id, teammateId, report))
        return null;
      const kept = chat.responder;
      const starting = store.startingChoiceOf([teammateId], Object.isNull(kept) ? null : ComposerSettings.fromResponder(kept));
      if (!Object.isNull(starting))
        await store.setResponder(chat.id, starting.toResponder());
    }
    ConversationActions.open(context, store, chat);
    context.keepDocument(Resources.conversationDocumentName, chat.id);
    if (!Object.isNull(fresh))
      targets.focusComposer(chat.id);
    return chat;
  }
}
