/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import type { JsonValue } from "@noldova/context.json";
import { CommandContribution, type IWindowPartContext } from "@noldova/desktop.window";

import { Resources } from "../resources";
import { BrowserAvailability } from "./services/browser-availability";
import { ChatStoreService } from "./services/chat-store.service";
import { CommandTargetsService } from "./services/command-targets.service";
import { ConversationActions } from "./services/conversation-actions";

export class TeamRunCommands {
  public static of(context: IWindowPartContext): readonly CommandContribution[] {
    const store = (): ChatStoreService => ChatStoreService.of(context);
    const targets = CommandTargetsService.of(context);
    const done = async (action: () => Promise<void> | void): Promise<null> => {
      await action();
      return null;
    };
    return [
      new CommandContribution(Resources.newConversationCommand, Resources.newConversationLabel, Resources.newConversationIcon, Resources.newConversationKey,
        () => done(async () => { await ConversationActions.start(context, store(), store().selectedProjectId()); })),
      new CommandContribution(Resources.openProjectCommand, Resources.openProjectLabel, Resources.openProjectIcon, Resources.openProjectKey,
        () => done(() => ConversationActions.openProject(context, store()))),
      new CommandContribution(Resources.openBrowserCommand, Resources.openBrowserLabel, Resources.openBrowserIcon, null,
        () => done(async () => {
          if (BrowserAvailability.isActive(context))
            await store().openBrowser();
        }), () => BrowserAvailability.isActive(context)),
      new CommandContribution(Resources.searchConversationsCommand, Resources.searchConversationsTitle, Resources.searchIcon, null,
        () => done(async () => { await context.runCommandAsync(Resources.desktopSearchCommand, { [Resources.sourceArgument]: Resources.chatsSearchSource }); })),
      new CommandContribution(Resources.focusComposerCommand, Resources.focusComposerTitle, Resources.focusComposerIcon, Resources.focusComposerKey,
        () => done(() => TeamRunCommands.focus(context, store(), targets)), () => !Object.isNull(store().screenConversationId())),
      new CommandContribution(Resources.openChatPageCommand, Resources.openChatPageTitle, Resources.openChatPageIcon, null,
        () => done(() => TeamRunCommands.showChatPage(store())), () => !Object.isNull(store().shownConversationId())),
      new CommandContribution(Resources.stopReplyCommand, Resources.stopReplyTitle, Resources.stopReplyIcon, Resources.stopReplyKey,
        () => done(() => TeamRunCommands.stop(store())), () => !Object.isNull(store().runningReply())),
      new CommandContribution(Resources.previousConversationCommand, Resources.previousConversationTitle, Resources.previousConversationIcon,
        Resources.previousConversationKey, () => done(() => ConversationActions.step(context, store(), -1)), () => store().recentConversations().length > 0),
      new CommandContribution(Resources.nextConversationCommand, Resources.nextConversationTitle, Resources.nextConversationIcon,
        Resources.nextConversationKey, () => done(() => ConversationActions.step(context, store(), 1)), () => store().recentConversations().length > 0),
      new CommandContribution(Resources.moveRowUpCommand, Resources.moveRowUpTitle, Resources.moveRowUpIcon, Resources.moveRowUpKey,
        () => done(() => targets.moveRow(-1)), () => targets.canMoveRow()),
      new CommandContribution(Resources.moveRowDownCommand, Resources.moveRowDownTitle, Resources.moveRowDownIcon, Resources.moveRowDownKey,
        () => done(() => targets.moveRow(1)), () => targets.canMoveRow()),
      new CommandContribution(Resources.chooseDefaultTeammateCommand, Resources.chooseDefaultTeammateTitle, Resources.teammatesViewIcon, null,
        () => done(() => TeamRunCommands.chooseDefaultTeammate(context, store()))),
      new CommandContribution(Resources.showDataFolderCommand, Resources.showDataFolderTitle, Resources.dataFolderIcon, null,
        () => done(async () => context.showInFolderAsync((await store().readDataFolder()).databaseFile))),
      new CommandContribution(Resources.openChatCommand, Resources.openChatTitle, Resources.openChatIcon, null,
        t => done(() => TeamRunCommands.openChat(context, store(), TeamRunCommands.chatIdOf(t))),
        t => !Object.isNull(TeamRunCommands.chatIdOf(t))),
      new CommandContribution(Resources.enableProviderCommand, Resources.enableProviderTitle, Resources.enableProviderIcon, null,
        t => done(() => TeamRunCommands.enableProvider(store(), TeamRunCommands.textOf(t, Resources.providerIdArgument))),
        t => !Object.isNull(TeamRunCommands.textOf(t, Resources.providerIdArgument))),
      new CommandContribution(Resources.reloadCommand, Resources.reloadTitle, Resources.reloadIcon, null,
        t => done(() => store().reloadIn(TeamRunCommands.textOf(t, Resources.windowIdArgument), TeamRunCommands.textOf(t, Resources.noticeKeyArgument))),
        t => !Object.isNull(TeamRunCommands.textOf(t, Resources.windowIdArgument)) || store().hasFailedLoads())
    ];
  }

  private static chooseDefaultTeammate(context: IWindowPartContext, store: ChatStoreService): void {
    store.askForDefaultTeammate();
    context.openDocument(Resources.teammatesDocumentName, Resources.teammatesDocumentInstance, Resources.teammatesTitle);
  }

  private static focus(context: IWindowPartContext, store: ChatStoreService, targets: CommandTargetsService): void {
    const conversation = store.screenConversation();
    if (Object.isNull(conversation))
      return;
    ConversationActions.open(context, store, conversation);
    targets.focusComposer(conversation.id);
  }

  private static openChat(context: IWindowPartContext, store: ChatStoreService, conversationId: string | null): void {
    if (Object.isNull(conversationId) || store.isDeleted(conversationId))
      return;
    const conversation = store.conversation(conversationId);
    context.openDocument(Resources.conversationDocumentName, conversationId, conversation?.title ?? Resources.untitledConversation,
      { breadcrumb: Object.isNull(conversation) ? [] : ConversationActions.breadcrumbOf(store, conversation.projectId) });
  }

  private static async enableProvider(store: ChatStoreService, providerId: string | null): Promise<void> {
    if (!Object.isNull(providerId))
      await store.setProviderEnabled(providerId, true);
  }

  private static chatIdOf(commandArguments: JsonValue): string | null {
    return TeamRunCommands.textOf(commandArguments, Resources.chatIdArgument) ?? TeamRunCommands.textOf(commandArguments, Resources.legacyChatIdArgument);
  }

  private static textOf(commandArguments: JsonValue, name: string): string | null {
    const value: unknown = Object.isObject(commandArguments) && !Array.isArray(commandArguments) ? Reflect.get(commandArguments, name) : null;
    return Object.isString(value) && !String.isNullOrWhitespace(value) ? value : null;
  }

  private static showChatPage(store: ChatStoreService): void {
    const conversationId = store.shownConversationId();
    if (!Object.isNull(conversationId))
      store.showChatPage(conversationId);
  }

  private static async stop(store: ChatStoreService): Promise<void> {
    const reply = store.runningReply();
    if (!Object.isNull(reply))
      await store.stop(reply.conversationId);
  }
}
