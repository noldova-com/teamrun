/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { DialogRef } from "@angular/cdk/dialog";
import { CdkDrag, type CdkDragDrop, CdkDragHandle, CdkDropList, moveItemInArray } from "@angular/cdk/drag-drop";
import { NgTemplateOutlet } from "@angular/common";
import { Component, DestroyRef, ElementRef, Injector, type Signal, type WritableSignal, computed, inject, signal, viewChildren } from "@angular/core";

import "@noldova/context.core";
import { type IWindowPartContext, WindowPartTokens } from "@noldova/desktop.window";
import { Conversation, MethodName, OrganizationChat, type Project, type Teammate } from "@noldova/teamrun.protocol";
import {
  AnnouncementPoliteness,
  Announcer,
  ContextMenuTriggerDirective,
  DialogService,
  IconButtonComponent,
  MenuComponent,
  MenuItemComponent,
  MenuSeparatorComponent,
  MenuTriggerDirective,
  OverlaySide,
  SectionHeaderActionDirective,
  SectionHeaderComponent,
  SpinnerComponent,
  TooltipDirective
} from "@noldova/ui.components.angular";

import { Resources } from "../../../resources";
import { ChatAction } from "../../enums/chat-action";
import { ProjectsGroup } from "../../enums/projects-group";
import { ConfirmRequest } from "../../models/confirm-request";
import { OrganizationExplorer } from "../../models/organization-explorer";
import { TreeFocus } from "../../models/tree-focus";
import { BrowserAvailability } from "../../services/browser-availability";
import { ChatPlacement } from "../../services/chat-placement";
import { ChatStoreService } from "../../services/chat-store.service";
import { CommandTargetsService } from "../../services/command-targets.service";
import { ConversationActions } from "../../services/conversation-actions";
import { OrganizationActions } from "../../services/organization-actions";
import { OrganizationCatalog } from "../../services/organization-catalog";
import { ProjectsLayoutService } from "../../services/projects-layout.service";
import { TimeFormatService } from "../../services/time-format.service";
import { ConfirmDialogComponent } from "../confirm-dialog/confirm-dialog.component";
import { RenameDialogComponent } from "../rename-dialog/rename-dialog.component";
import { TeammateStatusComponent } from "../teammate-status/teammate-status.component";
import { TreeItemDirective } from "./tree-item.directive";

@Component({
  selector: "nol-teamrun-projects-view",
  imports: [CdkDrag, CdkDragHandle, CdkDropList, ContextMenuTriggerDirective, IconButtonComponent, MenuComponent, MenuItemComponent, MenuSeparatorComponent,
    MenuTriggerDirective, NgTemplateOutlet, SectionHeaderActionDirective, SectionHeaderComponent, SpinnerComponent, TeammateStatusComponent, TooltipDirective, TreeItemDirective],
  providers: [ChatStoreService.provider, ProjectsLayoutService.provider],
  templateUrl: "./projects-view.component.html",
  styleUrl: "./projects-view.component.css"
})
export class ProjectsViewComponent {
  protected readonly resources: typeof Resources = Resources;
  protected readonly beside: OverlaySide = OverlaySide.end;
  protected readonly store: ChatStoreService = inject(ChatStoreService);
  protected readonly layout: ProjectsLayoutService = inject(ProjectsLayoutService);
  private readonly context: IWindowPartContext = inject(WindowPartTokens.context);
  private readonly dialogs: DialogService = inject(DialogService);
  protected readonly placement: ChatPlacement = new ChatPlacement(this.context, this.store, this.dialogs);
  private readonly times: TimeFormatService = inject(TimeFormatService);
  private readonly unfoldedProjects: WritableSignal<ReadonlySet<string>> = signal(new Set());
  private readonly announcer: Announcer = inject(Announcer);
  private readonly injector: Injector = inject(Injector);
  private readonly host: ElementRef<HTMLElement> = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly treeItems: Signal<readonly TreeItemDirective[]> = viewChildren(TreeItemDirective);

  protected readonly pinsTree: TreeFocus = new TreeFocus(this.treeItems, this.store.shownConversationId, this.injector);
  protected readonly projectsTree: TreeFocus = new TreeFocus(this.treeItems, this.store.shownConversationId, this.injector);
  protected readonly chatsTree: TreeFocus = new TreeFocus(this.treeItems, this.store.shownConversationId, this.injector);
  protected readonly organizationsTree: TreeFocus = new TreeFocus(this.treeItems, this.store.shownConversationId, this.injector);
  protected readonly moveShortcuts: string = navigator.platform.startsWith(Resources.macPlatformPrefix) ? Resources.macTreeMoveShortcuts : Resources.treeMoveShortcuts;
  protected readonly groups: typeof ProjectsGroup = ProjectsGroup;
  protected readonly rowShortcuts: string = `${this.moveShortcuts} ${Resources.renameKey}`;

  protected readonly pinnedConversations: Signal<readonly Conversation[]> = computed(() =>
    this.layout.pinnedConversations().map(t => this.store.conversation(t)).filter((t): t is Conversation => !Object.isNull(t) && Object.isNull(t.organizationChat)));

  protected readonly orderedProjects: Signal<readonly Project[]> = computed(() => this.layout.ordered(this.store.projects()));

  protected readonly listIds: Signal<string[]> = computed(() => this.orderedProjects().map(t => this.listIdOf(t.id)));

  protected readonly areChatsUnfolded: WritableSignal<boolean> = signal(false);

  protected readonly canOpenBrowser: Signal<boolean> = computed(() => BrowserAvailability.isActive(this.context));

  protected readonly chats: Signal<readonly Conversation[]> = computed(() => this.orderedConversationsOf(null));

  private readonly catalog: OrganizationCatalog = OrganizationCatalog.of(this.context);
  protected readonly organizations: Signal<readonly OrganizationExplorer[]> = computed(() =>
    this.catalog.organizations().map(t => OrganizationExplorer.of(t, this.store.teammates())));

  protected readonly hasOrganization: Signal<boolean> = computed(() => this.organizations().length > 0);

  private readonly organizationChats: Signal<ReadonlyMap<string, Conversation>> = computed(() => {
    const chats = new Map<string, Conversation>();
    for (const projectId of [null, ...this.store.projects().map(t => t.id)])
      for (const chat of this.store.newestConversationsOf(projectId))
        if (!Object.isNull(chat.organizationChat))
          chats.set(Resources.formatOrganizationChatKey(chat.organizationChat.organizationId, chat.organizationChat.teammateId), chat);
    return chats;
  });

  protected readonly shownChats: Signal<readonly Conversation[]> = computed(() =>
    this.areChatsUnfolded() ? this.chats() : this.chats().slice(0, Resources.projectConversationCount));

  public constructor() {
    inject(DestroyRef).onDestroy(CommandTargetsService.of(this.context).provideRowMover(() => this.focusedRow()?.treeMovable() === true,
      t => this.focusedRow()?.moved.emit(t)));
  }

  protected open(conversation: Conversation): void {
    ConversationActions.open(this.context, this.store, conversation);
    if (conversation.id === this.store.shownConversationId())
      void this.store.selectConversation(conversation.id);
  }

  protected chatOf(organizationId: string, teammate: Teammate): Conversation | null {
    return this.organizationChats().get(Resources.formatOrganizationChatKey(organizationId, teammate.id)) ?? null;
  }

  protected openTeammate(organizationId: string, teammate: Teammate): Promise<void> {
    return this.withOrganizationChat(organizationId, teammate, t => this.open(t));
  }

  protected placeOf(organizationId: string, teammate: Teammate): string {
    const chat = this.chatOf(organizationId, teammate);
    const project = this.store.projects().find(t => t.id === chat?.projectId);
    return chat?.attachedFolder ?? project?.rootPath ?? this.organizations().find(t => t.id === organizationId)?.folder ?? teammate.name;
  }

  protected teammateProjectOf(organizationId: string, teammate: Teammate): string | null {
    return this.chatOf(organizationId, teammate)?.projectId ?? null;
  }

  protected teammateFolderOf(organizationId: string, teammate: Teammate): string | null {
    return this.chatOf(organizationId, teammate)?.attachedFolder ?? null;
  }

  protected teammateProjectsOf(organizationId: string, teammate: Teammate): readonly Project[] {
    const chat = this.chatOf(organizationId, teammate);
    return Object.isNull(chat) ? this.orderedProjects() : this.otherProjectsOf(chat);
  }

  protected moveTeammateToProject(organizationId: string, teammate: Teammate, project: Project): Promise<void> {
    return this.withOrganizationChat(organizationId, teammate, t => this.placement.moveToProject(t, project));
  }

  protected moveTeammateToFolder(organizationId: string, teammate: Teammate): Promise<void> {
    return this.withOrganizationChat(organizationId, teammate, t => this.placement.moveToFolder(t));
  }

  protected attachTeammateFolder(organizationId: string, teammate: Teammate): Promise<void> {
    return this.withOrganizationChat(organizationId, teammate, t => this.placement.attachFolder(t));
  }

  protected detachTeammateFolder(organizationId: string, teammate: Teammate): Promise<void> {
    return this.withOrganizationChat(organizationId, teammate, t => this.placement.detachFolder(t));
  }

  protected isChatMarked(organizationId: string, teammate: Teammate): boolean {
    const chat = this.chatOf(organizationId, teammate);
    return !Object.isNull(chat) && chat.id === this.store.markedConversationId();
  }

  protected openOrganization(organization: OrganizationExplorer): void {
    this.context.openDocument(Resources.organizationDocumentName, organization.id, organization.name);
  }

  protected createOrganization(): void {
    const dialog = this.dialogs.open(RenameDialogComponent, ".nol-teamrun-rename-title");
    dialog.componentRef?.setInput("initialTitle", String.empty);
    dialog.componentRef?.setInput("heading", Resources.newOrganizationTitle);
    dialog.componentRef?.setInput("fieldLabel", Resources.organizationNameFieldLabel);
    dialog.componentRef?.setInput("maxLength", Resources.organizationNameMaxLength);
    dialog.componentRef?.setInput("oneLine", true);
    dialog.componentInstance?.answered.subscribe(name => {
      dialog.close();
      if (!Object.isNull(name))
        void OrganizationActions.create(this.context, name);
    });
  }

  protected renameOrganization(organization: OrganizationExplorer): void {
    const dialog = this.dialogs.open(RenameDialogComponent, ".nol-teamrun-rename-title");
    dialog.componentRef?.setInput("initialTitle", organization.name);
    dialog.componentRef?.setInput("heading", Resources.renameOrganizationTitle);
    dialog.componentRef?.setInput("fieldLabel", Resources.organizationNameFieldLabel);
    dialog.componentRef?.setInput("maxLength", Resources.organizationNameMaxLength);
    dialog.componentRef?.setInput("oneLine", true);
    dialog.componentInstance?.answered.subscribe(name => {
      dialog.close();
      if (!Object.isNull(name))
        void OrganizationActions.rename(this.context, organization.id, name);
    });
  }

  protected async chooseOrganizationFolder(organization: OrganizationExplorer): Promise<void> {
    const folder = await this.context.chooseFolderAsync();
    if (!Object.isNull(folder))
      await OrganizationActions.setFolder(this.context, organization.id, folder);
  }

  protected clearOrganizationFolder(organization: OrganizationExplorer): Promise<void> {
    return OrganizationActions.setFolder(this.context, organization.id, null);
  }

  protected removeOrganization(organization: OrganizationExplorer): void {
    this.confirm(new ConfirmRequest(Resources.deleteOrganizationTitle, Resources.formatDeleteOrganizationText(organization.name), Resources.organizationDeleteLabel, null, true),
      () => OrganizationActions.remove(this.context, organization.id));
  }

  private async withOrganizationChat(organizationId: string, teammate: Teammate, use: (chat: Conversation) => void | Promise<void>): Promise<void> {
    const known = this.chatOf(organizationId, teammate);
    if (!Object.isNull(known)) {
      await use(known);
      return;
    }
    let chat: Conversation;
    try {
      chat = Conversation.fromJson(await this.context.requestAsync(Resources.formatQualifiedName(MethodName.OrganizationChatOpen),
        new OrganizationChat(organizationId, teammate.id).toJson()));
    }
    catch (error) {
      this.context.log(Resources.formatOrganizationChatNotOpened(String(error)));
      return;
    }
    await use(chat);
  }

  protected isMarked(projectId: string): boolean {
    return Object.isNull(this.store.markedConversationId()) && projectId === this.store.selectedProjectId();
  }

  protected keepOpen(conversation: Conversation): void {
    this.context.keepDocument(Resources.conversationDocumentName, conversation.id);
  }

  protected async startConversation(projectId: string | null): Promise<void> {
    await ConversationActions.start(this.context, this.store, projectId);
  }

  protected openProject(): Promise<void> {
    return ConversationActions.openProject(this.context, this.store);
  }

  protected openBrowser(): Promise<void> {
    return this.store.openBrowser();
  }

  protected isPinned(conversationId: string): boolean {
    return this.layout.layout().isPinned(conversationId);
  }

  protected isGroupOpen(group: ProjectsGroup): boolean {
    return !this.layout.layout().isGroupCollapsed(group);
  }

  protected openGroup(group: ProjectsGroup, open: boolean): void {
    this.layout.collapseGroup(group, !open);
  }

  protected isCollapsed(projectId: string): boolean {
    return this.layout.layout().isProjectCollapsed(projectId);
  }

  protected listIdOf(projectId: string): string {
    return `${Resources.conversationListIdPrefix}${projectId}`;
  }

  protected shownConversationsOf(projectId: string): readonly Conversation[] {
    const all = this.orderedConversationsOf(projectId);
    return this.unfoldedProjects().has(projectId) ? all : all.slice(0, Resources.projectConversationCount);
  }

  protected hiddenCountOf(projectId: string): number {
    return this.orderedConversationsOf(projectId).length - this.shownConversationsOf(projectId).length;
  }

  protected showAll(projectId: string): void {
    const shown = this.shownConversationsOf(projectId).length;
    this.unfold(projectId);
    this.projectsTree.focusLater(this.orderedConversationsOf(projectId)[shown]?.id);
  }

  protected showAllChats(): void {
    const shown = this.shownChats().length;
    this.areChatsUnfolded.set(true);
    this.chatsTree.focusLater(this.chats()[shown]?.id);
  }

  protected moveProject(project: Project, step: number): void {
    this.moveRow(this.projectsTree, project.id, project.name, this.orderedProjects().map(t => t.id), step, ids => this.layout.orderProjects(ids));
  }

  protected moveConversation(conversation: Conversation, tree: TreeFocus, projectId: string | null, step: number): void {
    if (tree === this.chatsTree)
      this.moveRow(tree, conversation.id, conversation.title, this.chats().map(t => t.id), step, ids => {
        this.layout.orderConversations(Resources.chatsOrderKey, ids);
        if (ids.indexOf(conversation.id) >= Resources.projectConversationCount)
          this.areChatsUnfolded.set(true);
      });
    else if (Object.isNull(projectId))
      this.moveRow(tree, conversation.id, conversation.title, this.pinnedConversations().map(t => t.id), step, ids => this.layout.orderPins(ids));
    else
      this.moveRow(tree, conversation.id, conversation.title, this.orderedConversationsOf(projectId).map(t => t.id), step, ids => {
        this.layout.orderConversations(projectId, ids);
        if (ids.indexOf(conversation.id) >= Resources.projectConversationCount)
          this.unfold(projectId);
      });
  }

  protected tooltipOf(conversation: Conversation): string {
    const place = Object.isNull(conversation.attachedFolder) ? ConversationActions.breadcrumbOf(this.store, conversation.projectId, null)
      : [Resources.chatsTitle, conversation.attachedFolder];
    return [...place, this.times.dateTime(conversation.updatedAt)].join(Resources.titleSeparator);
  }

  protected dropPin(event: CdkDragDrop<unknown, unknown, string>): void {
    const ids = this.pinnedConversations().map(t => t.id);
    if (ids.indexOf(event.item.data) !== event.currentIndex)
      this.layout.orderPins(ProjectsViewComponent.placed(ids, event.item.data, event.currentIndex));
  }

  protected dropProject(event: CdkDragDrop<unknown, unknown, string>): void {
    const ids = this.orderedProjects().map(t => t.id);
    if (ids.indexOf(event.item.data) !== event.currentIndex)
      this.layout.orderProjects(ProjectsViewComponent.placed(ids, event.item.data, event.currentIndex));
  }

  protected dropChat(event: CdkDragDrop<unknown, unknown, string>): void {
    const shown = this.shownChats().map(t => t.id);
    if (shown.indexOf(event.item.data) === event.currentIndex)
      return;
    const hidden = this.chats().slice(shown.length).map(t => t.id);
    this.layout.orderConversations(Resources.chatsOrderKey, [...ProjectsViewComponent.placed(shown, event.item.data, event.currentIndex), ...hidden]);
  }

  protected async dropConversation(event: CdkDragDrop<string, string, string>): Promise<void> {
    const conversationId = event.item.data;
    const from = event.previousContainer.data;
    const to = event.container.data;
    const shown = this.shownConversationsOf(to).map(t => t.id);
    const hidden = this.orderedConversationsOf(to).map(t => t.id).filter(t => !shown.includes(t));
    if (from === to) {
      if (shown.indexOf(conversationId) !== event.currentIndex)
        this.layout.orderConversations(to, [...ProjectsViewComponent.placed(shown, conversationId, event.currentIndex), ...hidden]);
      return;
    }
    const fromOrder = this.layout.layout().conversationOrderOf(from);
    const toOrder = this.layout.layout().conversationOrderOf(to);
    shown.splice(event.currentIndex, 0, conversationId);
    this.layout.orderConversations(to, [...shown, ...hidden]);
    this.layout.orderConversations(from, this.orderedConversationsOf(from).map(t => t.id).filter(t => t !== conversationId));
    if (await this.store.moveConversation(conversationId, to))
      return;
    this.layout.orderConversations(from, fromOrder);
    this.layout.orderConversations(to, toOrder);
  }

  protected rename(conversation: Conversation, tree: TreeFocus): void {
    const dialog = this.dialogs.open(RenameDialogComponent, ".nol-teamrun-rename-title");
    dialog.componentRef?.setInput("initialTitle", conversation.title);
    dialog.componentInstance?.answered.subscribe(title => {
      dialog.close();
      const left = document.activeElement;
      if (!Object.isNull(title))
        void this.store.renameConversation(conversation.id, title).then(() => tree.keepFocusLater(conversation.id, left));
    });
  }

  protected async remove(conversation: Conversation, tree: TreeFocus): Promise<void> {
    const count = Object.isNull(conversation.projectId) ? await this.store.countFolderFilesAsync(conversation.id, ChatAction.DeleteChat) : 0;
    if (Object.isNull(count))
      return;
    const kept = Object.isNull(conversation.attachedFolder) ? String.empty
      : ` ${Resources.formatAttachedFolderKept(ConversationActions.folderNameOf(conversation.attachedFolder))}`;
    const request = count === 0
      ? new ConfirmRequest(Resources.deleteTitle, `${Resources.formatDeleteText(conversation.title)}${kept}`, Resources.deleteConversationLabel, null, true)
      : new ConfirmRequest(Resources.deleteTitle, `${Resources.formatDeleteWithFilesText(conversation.title, count)}${kept}`, Resources.deleteConversationLabel,
        Resources.moveToFolderLabel, true);
    const dialog = this.confirm(request, async () => {
      const neighbour = tree.neighbourOf(conversation.id);
      await this.store.deleteConversation(conversation.id);
      tree.focusIfLostLater(neighbour, () => this.host.nativeElement.querySelector<HTMLElement>(".nol-teamrun-action"));
    });
    dialog.componentInstance?.other.subscribe(() => {
      dialog.close();
      void this.placement.moveToFolder(conversation);
    });
  }

  protected otherProjectsOf(conversation: Conversation): readonly Project[] {
    return this.orderedProjects().filter(t => t.id !== conversation.projectId);
  }

  protected forget(project: Project): void {
    const request = new ConfirmRequest(Resources.forgetTitle, Resources.formatForgetText(project.name), Resources.forgetConfirmLabel, null, true);
    this.confirm(request, () => this.store.forgetProject(project.id));
  }

  private confirm(request: ConfirmRequest, action: () => Promise<void>): DialogRef<unknown, ConfirmDialogComponent> {
    const dialog = this.dialogs.open(ConfirmDialogComponent, ".nol-teamrun-cancel");
    dialog.componentRef?.setInput("request", request);
    dialog.componentInstance?.answered.subscribe(confirmed => {
      dialog.close();
      if (confirmed)
        void action();
    });
    return dialog;
  }

  private unfold(projectId: string): void {
    this.unfoldedProjects.update(t => new Set(t).add(projectId));
  }

  private focusedRow(): TreeItemDirective | undefined {
    return this.treeItems().find(t => t.element === document.activeElement);
  }

  private static placed(ids: readonly string[], id: string, index: number): string[] {
    const placed = ids.filter(t => t !== id);
    placed.splice(index, 0, id);
    return placed;
  }

  private moveRow(tree: TreeFocus, id: string, label: string, ids: string[], step: number, order: (ids: string[]) => void): void {
    const from = ids.indexOf(id);
    const to = from + step;
    if (to < 0 || to >= ids.length) {
      this.announceMove(Resources.formatRowMoveRefused(label, step < 0));
      return;
    }
    moveItemInArray(ids, from, to);
    order(ids);
    this.announceMove(Resources.formatRowMoved(label, to + 1, ids.length));
    tree.focusLater(id);
  }

  private announceMove(message: string): void {
    this.announcer.announce(message, AnnouncementPoliteness.Polite, { group: Resources.treeMoveGroup });
  }

  private orderedConversationsOf(projectId: string | null): readonly Conversation[] {
    const pinned = this.layout.pinnedConversations();
    const newest = this.store.newestConversationsOf(projectId).filter(t => !pinned.includes(t.id) && Object.isNull(t.organizationChat));
    const order = this.layout.layout().conversationOrderOf(projectId ?? Resources.chatsOrderKey);
    const named = order.map(id => newest.find(t => t.id === id)).filter((t): t is Conversation => !Object.isUndefined(t));
    return [...named, ...newest.filter(t => !order.includes(t.id))];
  }
}
