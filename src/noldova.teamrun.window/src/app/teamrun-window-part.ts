/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { computed } from "@angular/core";

import "@noldova/context.core";
import {
  CommandContribution,
  ContentPadding,
  DockSide,
  DocumentContribution,
  type IWindowPart,
  type IWindowPartContext,
  PlaceholderContribution,
  SettingsPageContribution,
  ViewContribution
} from "@noldova/desktop.window";
import { GitFolder } from "@noldova/git.window";
import { EmbeddedTerminal, TerminalStartFolder } from "@noldova/terminal.window";

import { Resources } from "../resources";
import { PagesViewComponent } from "./components/pages/pages-view/pages-view.component";
import { AbilitySettingsRows } from "./services/ability-settings-rows";
import { BackgroundTaskStoreService } from "./services/background-task-store.service";
import { OrganizationMessagesStoreService } from "./services/organization-messages-store.service";
import { OrganizationStoreService } from "./services/organization-store.service";
import { BrowserAvailability } from "./services/browser-availability";
import { ChatPageAction } from "./services/chat-page-action";
import { ChatStoreService } from "./services/chat-store.service";
import { ChatTerminals } from "./services/chat-terminals";
import { ComputerUseBorder } from "./services/computer-use-border";
import { ComposerDefaultService } from "./services/composer-default.service";
import { GitHubReferenceSource } from "./services/github-reference-source";
import { ImageViewerService } from "./services/image-viewer.service";
import { InlineTerminals } from "./services/inline-terminals";
import { PageEditors } from "./services/page-editors";
import { PageDocuments } from "./services/pages/page-documents";
import { PanelRequests } from "./services/panel-requests";
import { PlanUsageStatus } from "./services/plan-usage-status";
import { ProjectsLayoutService } from "./services/projects-layout.service";
import { SubAgentsBadge } from "./services/sub-agents-badge";
import { TitleModelOptions } from "./services/title-model-options";
import { TimeFormatService } from "./services/time-format.service";
import { TeamRunSearchSources } from "./services/teamrun-search-sources";
import { TeammateStatusStoreService } from "./services/teammate-status-store.service";
import { TeamRunCommands } from "./teamrun-commands";

export class TeamRunWindowPart implements IWindowPart {
  public readonly moduleId: string = "teamrun";

  private activeContext: IWindowPartContext | null = null;
  private releaseStartFolder: (() => void) | null = null;
  private releaseTitleModels: (() => void) | null = null;
  private releaseGitFolder: (() => void) | null = null;
  private releasePages: (() => void) | null = null;
  private chatTerminals: ChatTerminals | null = null;

  public get context(): IWindowPartContext | null {
    return this.activeContext;
  }

  public activateAsync(context: IWindowPartContext): Promise<void> {
    this.activeContext = context;
    const store = ChatStoreService.watch(context);
    PanelRequests.register(context, store);
    SubAgentsBadge.register(context, store);
    AbilitySettingsRows.register(context, store);
    ComputerUseBorder.register(context);
    BrowserAvailability.register(context);
    TimeFormatService.register(context);
    GitHubReferenceSource.register(context);
    this.releaseStartFolder = TerminalStartFolder.provide(context, () => TeamRunWindowPart.startFolderOf(ChatStoreService.of(context)));
    this.releaseGitFolder = GitFolder.provide(context, computed(() => TeamRunWindowPart.startFolderOf(store)));
    this.releasePages = PagesViewComponent.provide(context, store.shownConversationId, t => store.onShownConversationChanged(t), PageEditors.of(store));
    const terminals = ChatTerminals.provide(context, store, null,
      (starter, kept) => new InlineTerminals(starter, EmbeddedTerminal.open, kept));
    this.chatTerminals = terminals;
    context.registerView(new ViewContribution(Resources.projectsViewName, Resources.explorerTitle, Resources.projectsViewIcon, DockSide.Left, true,
      () => import("./components/projects-view/projects-view.component").then(t => t.ProjectsViewComponent), ContentPadding.None));
    context.registerView(new ViewContribution(Resources.changesViewName, Resources.changesTitle, Resources.changesViewIcon, DockSide.Right, true,
      () => import("./components/changes-view/changes-view.component").then(t => t.ChangesViewComponent), ContentPadding.None));
    context.registerView(new ViewContribution(Resources.planViewName, Resources.plansTitle, Resources.planViewIcon, DockSide.Right, true,
      () => import("./components/plan-view/plan-view.component").then(t => t.PlanViewComponent), ContentPadding.None));
    context.registerView(new ViewContribution(Resources.subAgentsViewName, Resources.subAgentsTitle, Resources.subAgentsViewIcon, DockSide.Right, true,
      () => import("./components/sub-agents-view/sub-agents-view.component").then(t => t.SubAgentsViewComponent), ContentPadding.None));
    context.registerView(new ViewContribution(Resources.backgroundTasksViewName, Resources.backgroundTasksTitle, Resources.backgroundTasksViewIcon, DockSide.Right, true,
      () => import("./components/background-tasks-view/background-tasks-view.component").then(t => t.BackgroundTasksViewComponent), ContentPadding.None));
    context.registerView(new ViewContribution(Resources.pagesViewName, Resources.pagesTitle, Resources.pagesViewIcon, DockSide.Right, true,
      () => Promise.resolve(PagesViewComponent), ContentPadding.None));
    context.registerView(new ViewContribution(Resources.activityViewName, Resources.activityTitle, Resources.activityViewIcon, DockSide.Bottom, true,
      () => import("./components/activity-view/activity-view.component").then(t => t.ActivityViewComponent), ContentPadding.None));
    context.registerCommand(TeamRunWindowPart.opening(context, Resources.showTeammatesCommand, Resources.showTeammatesTitle, Resources.teammatesViewIcon,
      Resources.teammatesDocumentName, Resources.teammatesDocumentInstance, Resources.teammatesTitle));
    context.registerCommand(TeamRunWindowPart.opening(context, Resources.showProvidersCommand, Resources.showProvidersTitle, Resources.providersViewIcon,
      Resources.providersDocumentName, Resources.providersDocumentInstance, Resources.providersTitle));
    context.registerCommand(TeamRunWindowPart.opening(context, Resources.showMcpServersCommand, Resources.showMcpServersTitle, Resources.mcpServersViewIcon,
      Resources.mcpServersDocumentName, Resources.mcpServersDocumentInstance, Resources.mcpServersTitle));
    context.registerCommand(TeamRunWindowPart.opening(context, Resources.showComputerUseGrantsCommand, Resources.showComputerUseGrantsTitle,
      Resources.computerUseGrantsViewIcon, Resources.computerUseGrantsDocumentName, Resources.computerUseGrantsDocumentInstance, Resources.computerUseGrantsTitle));
    context.registerCommand(TeamRunWindowPart.opening(context, Resources.showOutsideSessionsCommand, Resources.showOutsideSessionsTitle,
      Resources.outsideViewIcon, Resources.outsideDocumentName, Resources.outsideDocumentInstance, Resources.outsideTitle));
    for (const command of TeamRunCommands.of(context))
      context.registerCommand(command);
    context.registerCommand(terminals.command());
    PlanUsageStatus.register(context);
    this.releaseTitleModels = TitleModelOptions.provide(context, store);
    ChatPageAction.register(context, store);
    for (const source of TeamRunSearchSources.of(context))
      context.registerSearchSource(source);
    context.registerDocument(new DocumentContribution(Resources.conversationDocumentName, () => import("./components/conversation/conversation.component").then(t => t.ConversationComponent), ContentPadding.None));
    context.registerDocument(new DocumentContribution(Resources.imageDocumentName, () => import("./components/image-document/image-document.component").then(t => t.ImageDocumentComponent), ContentPadding.None));
    context.registerDocument(new DocumentContribution(Resources.teammatesDocumentName, () => import("./components/teammates-view/teammates-view.component").then(t => t.TeammatesViewComponent), ContentPadding.None));
    context.registerDocument(new DocumentContribution(Resources.providersDocumentName, () => import("./components/providers-view/providers-view.component").then(t => t.ProvidersViewComponent), ContentPadding.None));
    context.registerDocument(new DocumentContribution(Resources.mcpServersDocumentName, () => import("./components/mcp-servers-view/mcp-servers-view.component").then(t => t.McpServersViewComponent), ContentPadding.None));
    context.registerDocument(new DocumentContribution(Resources.computerUseGrantsDocumentName,
      () => import("./components/computer-use-grants-view/computer-use-grants-view.component").then(t => t.ComputerUseGrantsViewComponent), ContentPadding.None));
    context.registerDocument(new DocumentContribution(Resources.outsideDocumentName,
      () => import("./components/outside-connection-view/outside-connection-view.component").then(t => t.OutsideConnectionViewComponent), ContentPadding.None));
    PageDocuments.register(context);
    context.registerPlaceholder(new PlaceholderContribution(Resources.noChatPlaceholderName,
      () => import("./components/conversation-placeholder/conversation-placeholder.component").then(t => t.ConversationPlaceholderComponent), ContentPadding.None));
    context.registerSettingsPage(new SettingsPageContribution(Resources.abilitiesPageName,
      () => import("./components/abilities-page/abilities-page.component").then(t => t.AbilitiesPageComponent)));
    return Promise.resolve();
  }

  public reconnectAsync(): Promise<boolean> {
    if (Object.isNull(this.activeContext))
      return Promise.resolve(false);
    PanelRequests.reportAgain(this.activeContext);
    SubAgentsBadge.reload(this.activeContext);
    ComputerUseBorder.reload(this.activeContext);
    return ChatStoreService.resync(this.activeContext);
  }

  public async deactivateAsync(): Promise<void> {
    this.releaseStartFolder?.();
    this.releaseStartFolder = null;
    this.releaseTitleModels?.();
    this.releaseTitleModels = null;
    this.releaseGitFolder?.();
    this.releaseGitFolder = null;
    this.releasePages?.();
    this.releasePages = null;
    const terminals = this.chatTerminals;
    this.chatTerminals = null;
    if (!Object.isNull(this.activeContext)) {
      PanelRequests.release(this.activeContext);
      SubAgentsBadge.release(this.activeContext);
      AbilitySettingsRows.release(this.activeContext);
      ComputerUseBorder.release(this.activeContext);
      BrowserAvailability.release(this.activeContext);
      TimeFormatService.release(this.activeContext);
      GitHubReferenceSource.release(this.activeContext);
      ImageViewerService.release(this.activeContext);
      PlanUsageStatus.release(this.activeContext);
      ChatPageAction.release(this.activeContext);
      PageDocuments.release(this.activeContext);
      BackgroundTaskStoreService.release(this.activeContext);
      OrganizationMessagesStoreService.release(this.activeContext);
      OrganizationStoreService.release(this.activeContext);
      TeammateStatusStoreService.release(this.activeContext);
      ProjectsLayoutService.release(this.activeContext);
      ComposerDefaultService.release(this.activeContext);
      ChatStoreService.release(this.activeContext);
    }
    this.activeContext = null;
    await terminals?.removeAsync();
  }

  private static startFolderOf(store: ChatStoreService): string | null {
    const shown = store.shownConversationId();
    return Object.isNull(shown) ? null : store.folderOf(shown);
  }

  private static opening(context: IWindowPartContext, name: string, title: string, icon: string, document: string, instance: string,
    documentTitle: string): CommandContribution {
    return new CommandContribution(name, title, icon, null, () => {
      context.openDocument(document, instance, documentTitle);
      return Promise.resolve(null);
    });
  }
}
