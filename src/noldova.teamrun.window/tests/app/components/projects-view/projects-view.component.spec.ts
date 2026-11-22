/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { signal, type WritableSignal } from "@angular/core";
import { type ComponentFixture, TestBed } from "@angular/core/testing";
import { By } from "@angular/platform-browser";

import "@noldova/context.core";
import type { JsonValue } from "@noldova/context.json";
import { DatePattern } from "@noldova/desktop.protocol";
import { WindowPartTokens } from "@noldova/desktop.window";
import {
  Approval,
  ApprovalKind,
  ApprovalQuestion,
  ApprovalStatus,
  ChatFolderAttachParams,
  Conversation,
  ConversationCreateParams,
  ConversationIdParams,
  ConversationListParams,
  ConversationMoveParams,
  ConversationRenameParams,
  Department,
  ErrorCode,
  EventName,
  Harness,
  Message,
  MessageAuthor,
  MessagePageParams,
  MessageStatus,
  MethodName,
  NodeType,
  Organization,
  OrganizationChat,
  OrganizationCreateParams,
  OrganizationIdParams,
  OrganizationParent,
  OrganizationUpdateParams,
  Project,
  ProjectFolderChange,
  ProjectIdParams,
  ProjectOpenParams,
  ProjectsLayoutSaveParams,
  QuestionOption,
  Resources as ProtocolResources,
  Teammate,
  TeammatePlacement
} from "@noldova/teamrun.protocol";
import { AnnouncementPoliteness, Announcer, DefaultTheme, ThemeMode, TooltipDirective } from "@noldova/ui.components.angular";
import { AppearanceFixture, FixtureTheme, PointerFixture } from "@noldova/ui.components.angular/testing";
import { userEvent } from "vitest/browser";

import { ConversationComponent } from "../../../../src/app/components/conversation/conversation.component";
import { ProjectsViewComponent } from "../../../../src/app/components/projects-view/projects-view.component";
import { ChatAction } from "../../../../src/app/enums/chat-action";
import { ProjectsGroup } from "../../../../src/app/enums/projects-group";
import { TeammateStatus } from "../../../../src/app/enums/teammate-status";
import { BrowserAvailability } from "../../../../src/app/services/browser-availability";
import { ChatStoreService } from "../../../../src/app/services/chat-store.service";
import { CommandTargetsService } from "../../../../src/app/services/command-targets.service";
import { OrganizationCatalog } from "../../../../src/app/services/organization-catalog";
import { ProjectsLayoutService } from "../../../../src/app/services/projects-layout.service";
import { TeammateStatusStoreService } from "../../../../src/app/services/teammate-status-store.service";
import { TimeFormatService } from "../../../../src/app/services/time-format.service";
import { TeamRunCommands } from "../../../../src/app/teamrun-commands";
import { Resources } from "../../../../src/resources";
import { AccessibilityFixture } from "../../../fixtures/accessibility.fixture";
import { DeferredResponse } from "../../../fixtures/deferred-response.fixture";
import { EmulatedMediaFixture } from "../../../fixtures/emulated-media.fixture";
import { FakeWindowPartContext } from "../../../fixtures/fake-window-part-context.fixture";
import { RefusedError } from "../../../fixtures/refused-error.fixture";
import { Required } from "../../../fixtures/required.fixture";
import { SampleData } from "../../../fixtures/sample-data.fixture";
import { Wait } from "../../../fixtures/wait.fixture";

describe("ProjectsViewComponent", () => {
  const second = new Conversation("c2", "p1", "Second", "2026-09-11T08:00:00.000Z", "2026-09-11T08:00:00.000Z");
  const other = new Conversation("c3", "p2", "Other talk", "2026-09-12T08:00:00.000Z", "2026-09-12T08:00:00.000Z");
  const scratchOf = (id: string, title: string, at: string): Conversation => new Conversation(id, null, title, at, at, false, null, null, false, `/data/chats/${id}`);
  const scratch = scratchOf("c5", "Scratch", "2026-09-13T08:00:00.000Z");
  const at = "2026-09-14T08:00:00.000Z";
  const teammateOf = (id: string, name: string): Teammate => new Teammate(id, name, null, "a1", Harness.Provider, null, null, "t", "t");
  const grok = teammateOf("grok", "Grok");
  const opus = teammateOf("opus", "Opus 1");
  const agy = teammateOf("agy", "Agy");
  const builder = teammateOf("builder", "Builder");
  const sol = teammateOf("sol", "Sol");
  const mia = teammateOf("mia", "Mia");
  const nova = teammateOf("nova", "Nova");
  const zed = teammateOf("zed", "Zed");
  const departmentOf = (id: string, name: string, parentId: string | null, leaderId: string | null, order: number): Department =>
    new Department(id, name, "department", OrganizationParent.departmentOrPerson(parentId), leaderId, order, "c", "u");
  const placementOf = (teammateId: string, departmentId: string | null, order: number): TeammatePlacement =>
    new TeammatePlacement(teammateId, OrganizationParent.departmentOrPerson(departmentId), order);
  const organization = SampleData.organizationOf([
    departmentOf("devops", "DevOps", null, "sol", 1),
    departmentOf("marketing", "Marketing", null, null, 0),
    departmentOf("infra", "Infra", "devops", null, 0)
  ], [placementOf("grok", null, 0), placementOf("opus", null, 1), placementOf("sol", "devops", 0), placementOf("agy", "devops", 1), placementOf("builder", "devops", 2),
    placementOf("mia", "infra", 0)]);
  const labs = new Organization("labs", "Labs", null, 1, SampleData.timestamp, SampleData.timestamp, [SampleData.departmentType], [departmentOf("research", "Research", null, null, 0)],
    [placementOf("nova", "research", 0)]);
  const organizationChatOf = (id: string, teammate: Teammate, organizationId: string = ProtocolResources.defaultOrganizationId): Conversation =>
    new Conversation(id, null, teammate.name, at, at, false, null, null, false, `/data/chats/${id}`, false, [], false, false, null, new OrganizationChat(organizationId, teammate.id));
  const myOrganizationKey = Resources.formatOrganizationExplorerKey(ProtocolResources.defaultOrganizationId);
  const grokChat = organizationChatOf("o1", grok);
  const infra = `DevOps${Resources.departmentPathSeparator}Infra`;
  const createOrganization = async (configure: (context: FakeWindowPartContext) => void = () => undefined): Promise<void> => {
    await create(t => {
      t.answer(MethodName.TeammateList, () => [grok, opus, agy, builder, sol, mia, nova, zed].map(u => u.toJson()))
        .answer(MethodName.OrganizationList, () => [organization.toJson(), labs.toJson()]);
      configure(t);
    });
    await Wait.until(() => expect(element().querySelector(".nol-teamrun-teammate-row")).not.toBeNull());
    await settle();
  };
  const names = (): string[] => texts(".nol-teamrun-organization-name, .nol-teamrun-teammate-name");
  const organizationRow = (name: string): HTMLElement => find<HTMLElement>(".nol-teamrun-organization-row", name);
  const teammateRow = (name: string): HTMLElement => find<HTMLElement>(".nol-teamrun-teammate-row", name);
  const opened = (): string[] => context.openedDocuments.map(t => `${t.name} ${t.instance}`);

  let context: FakeWindowPartContext;
  let fixture: ComponentFixture<ProjectsViewComponent>;
  let store: ChatStoreService;
  let layout: ProjectsLayoutService;
  let conversations: Conversation[];
  let shown: WritableSignal<boolean>;

  const element = (): HTMLElement => {
    const found: unknown = fixture.nativeElement;
    if (!(found instanceof HTMLElement))
      throw new Error("The projects view has no element.");
    return found;
  };
  const itemAt = <T>(items: ArrayLike<T>, index: number): T => {
    const found = items[index];
    if (Object.isUndefined(found))
      throw new Error(`There is no item ${index}.`);
    return found;
  };
  const texts = (selector: string, root: ParentNode = element()): string[] => [...root.querySelectorAll(selector)].map(t => t.textContent?.trim() ?? "");
  const headers = (): string[] => [...element().querySelectorAll("nol-section-header")].map(t => (t.querySelector(".nol-section-header-label") ?? t).textContent?.trim() ?? "");
  const nested = (): string[] => texts(".nol-teamrun-conversation-row.nol-teamrun-nested .nol-teamrun-conversation-title");
  const chats = (): string[] => texts(".nol-teamrun-chat-list .nol-teamrun-conversation-title");
  const dialogText = (): string | undefined => document.querySelector("nol-teamrun-confirm-dialog p")?.textContent?.trim();
  const pinned = (): string[] => texts(".nol-teamrun-pins .nol-teamrun-conversation-title");
  const projectNames = (): string[] => texts(".nol-teamrun-project-name");
  const requestOf = (method: MethodName): unknown => context.parametersOf(method);
  const find = <T extends Element>(selector: string, text: string, root: ParentNode = element()): T => {
    const found = [...root.querySelectorAll<T>(selector)].find(t => t.textContent?.includes(text) === true);
    if (Object.isUndefined(found))
      throw new Error(`Nothing matches ${selector} with "${text}".`);
    return found;
  };
  const part = (root: ParentNode, selector: string): HTMLElement => {
    const found = root.querySelector<HTMLElement>(selector);
    if (Object.isNull(found))
      throw new Error(`Nothing matches ${selector}.`);
    return found;
  };
  const conversationRow = (title: string): HTMLElement => find<HTMLElement>(".nol-teamrun-conversation-row", title);
  const projectRow = (name: string): HTMLElement => find<HTMLElement>(".nol-teamrun-project-row", name);
  const action = (label: string): HTMLButtonElement => find<HTMLButtonElement>(".nol-teamrun-action", label);
  const tooltipOf = (row: HTMLElement): string => {
    const found = fixture.debugElement.queryAll(By.css(".nol-teamrun-project-row")).find(t => t.nativeElement === row);
    if (Object.isUndefined(found))
      throw new Error("The row is not a project row.");
    return found.injector.get(TooltipDirective).text();
  };
  const withMissingFolder = (t: FakeWindowPartContext): FakeWindowPartContext =>
    t.answer(MethodName.ProjectList, () => [SampleData.listed(SampleData.project), SampleData.listed(SampleData.otherProject, true)]);
  const settle = async (): Promise<void> => {
    await fixture.whenStable();
    await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
    await fixture.whenStable();
  };
  const choose = async (row: HTMLElement, label: string): Promise<void> => {
    row.querySelector<HTMLButtonElement>(".nol-teamrun-row-actions")?.click();
    await settle();
    find<HTMLButtonElement>("button[nol-menu-item]", label, document).click();
    await settle();
  };
  const submenu = (): Element => itemAt([...document.querySelectorAll("nol-menu")], 1);
  const menuLabels = (): string[] => texts("button[nol-menu-item] .nol-menu-item-label", submenu());
  const pick = async (label: string): Promise<void> => {
    find<HTMLButtonElement>("button[nol-menu-item]", label, submenu()).click();
    await settle();
  };
  const answerDialog = async (selector: string): Promise<void> => {
    document.querySelector<HTMLButtonElement>(selector)?.click();
    await settle();
  };
  const pointAt = (target: Element, share: number): { clientX: number; clientY: number } => {
    const box = target.getBoundingClientRect();
    return { clientX: box.left + box.width / 2, clientY: box.top + box.height * share };
  };
  const moveHeldAsync = async (start: { clientX: number; clientY: number }, end: { clientX: number; clientY: number }): Promise<() => Promise<void>> => {
    for (const step of [0.25, 0.5, 0.75, 1]) {
      const clientX = start.clientX + (end.clientX - start.clientX) * step;
      const clientY = start.clientY + (end.clientY - start.clientY) * step;
      document.dispatchEvent(new MouseEvent("mousemove", { bubbles: true, buttons: 1, clientX, clientY }));
      await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
    }
    return async () => {
      document.dispatchEvent(new MouseEvent("mouseup", { bubbles: true, button: 0, ...end }));
      await settle();
    };
  };
  const holdDragAsync = async (handle: Element, target: Element, share: number = 0.25): Promise<() => Promise<void>> => {
    const start = pointAt(handle, 0.5);
    handle.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, button: 0, buttons: 1, detail: 1, ...start }));
    return moveHeldAsync(start, pointAt(target, share));
  };
  const dragAsync = async (handle: Element, target: Element, share: number = 0.25): Promise<void> => {
    const release = await holdDragAsync(handle, target, share);
    await release();
  };
  const dropFinished = (): Promise<void> => Wait.until(() => expect(document.querySelector(".cdk-drag-preview")).toBeNull());
  const dragItemOf = (row: HTMLElement): HTMLElement => {
    const item = row.closest<HTMLElement>(".nol-teamrun-drag-item");
    if (Object.isNull(item))
      throw new Error("The row is not in a drag item.");
    return item;
  };

  const withBrowser = (t: FakeWindowPartContext): void => {
    t.activeDependencies.add("browser");
    BrowserAvailability.register(t);
  };
  const create = async (configure: (context: FakeWindowPartContext) => void = () => undefined): Promise<void> => {
    context = SampleData.createContext()
      .answer(MethodName.ProjectList, () => [SampleData.listed(SampleData.project), SampleData.listed(SampleData.otherProject)])
      .answer(MethodName.ConversationList, t => conversations.filter(u => u.projectId === ConversationListParams.fromJson(t).projectId).map(u => u.toJson()));
    configure(context);
    TestBed.configureTestingModule({
      providers: [{ provide: WindowPartTokens.context, useValue: context }, { provide: WindowPartTokens.shown, useValue: shown.asReadonly() }]
    });
    layout = ProjectsLayoutService.of(context);
    fixture = TestBed.createComponent(ProjectsViewComponent);
    store = ChatStoreService.of(context);
    fixture.autoDetectChanges();
    await Wait.until(() => expect(store.loaded()).toBe(true));
    await settle();
  };

  beforeEach(() => {
    localStorage.removeItem(Resources.projectsLayoutStorageKey);
    conversations = [SampleData.conversation, second, other];
    shown = signal(true);
  });

  afterEach(() => {
    BrowserAvailability.release(context);
    ProjectsLayoutService.release(context);
    ChatStoreService.release(context);
    OrganizationCatalog.release(context);
    TeammateStatusStoreService.release(context);
    localStorage.removeItem(Resources.projectsLayoutStorageKey);
    vi.restoreAllMocks();
  });

  it("lists the open projects with their conversations newest first, and the store is the window's own", async () => {
    conversations = [SampleData.conversation, second];
    await create();

    expect(fixture.debugElement.injector.get(ChatStoreService)).toBe(store);
    expect(fixture.debugElement.injector.get(ProjectsLayoutService)).toBe(layout);
    expect(headers()).toEqual([Resources.organizationsTitle, Resources.projectsViewTitle]);
    expect(projectNames()).toEqual([SampleData.project.name, SampleData.otherProject.name]);
    expect(nested()).toEqual([second.title, SampleData.conversation.title]);
    expect(texts(".nol-teamrun-conversation-list > .nol-teamrun-muted")).toEqual([Resources.noConversations]);
  });

  it("shows a project's name as typed, keeping its case and spacing like a chat's title", async () => {
    const typed = new Project("p4", "My Repo", "D:/My Repo", SampleData.timestamp);
    conversations = [];
    await create(t => t.answer(MethodName.ProjectList, () => [SampleData.listed(typed)]));
    const name = part(projectRow(typed.name), ".nol-teamrun-project-name");
    const style = getComputedStyle(name);

    expect([name.innerText, style.textTransform, style.letterSpacing]).toEqual([typed.name, "none", "normal"]);
  });

  it("starts a chat without a project from New chat when no project is open, shows no empty tree, asks for no folder, and lists it under Chats", async () => {
    const created = scratchOf("c7", "New chat", "2026-09-14T08:00:00.000Z");
    await create(t => t.answer(MethodName.ProjectList, () => []).answer(MethodName.ConversationCreate, () => created.toJson()));

    expect(texts(".nol-teamrun-projects > .nol-teamrun-muted")).toEqual([Resources.noProjects]);
    expect(headers()).toEqual([Resources.organizationsTitle, Resources.projectsViewTitle]);
    expect([element().querySelectorAll("[role='tree']").length, part(element(), ".nol-teamrun-project-list").getAttribute("aria-label")]).toEqual([0, null]);
    action(Resources.newConversationLabel).click();
    await Wait.until(() => expect(context.keptDocuments.map(t => t.instance)).toEqual(["c7"]));
    await settle();

    expect(context.folderChoices).toBe(0);
    expect(ConversationCreateParams.fromJson(requestOf(MethodName.ConversationCreate))).toEqual(new ConversationCreateParams(null, null));
    expect(context.openedDocuments).toEqual([{ name: Resources.conversationDocumentName, instance: "c7", title: created.title,
      options: { preview: true, breadcrumb: [Resources.chatsTitle] } }]);
    expect(headers()).toEqual([Resources.organizationsTitle, Resources.projectsViewTitle, Resources.chatsTitle]);
    expect(chats()).toEqual([created.title]);
    expect(store.selectedProjectId()).toBeNull();
  });

  it("lists the chats without a project under Chats, newest first and apart from the pins, and shows the rest from Show more", async () => {
    const many = Array.from({ length: Resources.projectConversationCount + 2 }, (_, i) =>
      scratchOf(`s${String(i)}`, `Note ${String(i)}`, new Date(Date.UTC(2026, 8, 1 + i)).toISOString()));
    conversations = [SampleData.conversation, ...many];
    await create();
    const newest = many.toReversed().map(t => t.title);

    expect(headers()).toEqual([Resources.organizationsTitle, Resources.projectsViewTitle, Resources.chatsTitle]);
    expect(chats()).toEqual(newest.slice(0, Resources.projectConversationCount));
    await choose(conversationRow(itemAt(newest, 0)), Resources.pinLabel);
    expect(pinned()).toEqual([newest[0]]);
    expect(chats()).toEqual(newest.slice(1, Resources.projectConversationCount + 1));

    find<HTMLElement>(".nol-teamrun-chat-list .nol-teamrun-show-more", Resources.formatShowMore(1)).click();
    await settle();

    expect(chats()).toEqual(newest.slice(1));
    expect(element().querySelector(".nol-teamrun-chat-list .nol-teamrun-show-more")).toBeNull();
    expect(document.activeElement).toBe(conversationRow(itemAt(newest, Resources.projectConversationCount + 1)));
    expect(conversationRow(itemAt(newest, 1)).classList.contains("nol-teamrun-nested")).toBe(false);
  });

  it("opens the folder the person chooses as a project and selects it, and opens nothing when they cancel", async () => {
    const site = new Project("p3", "site", "D:/site", SampleData.timestamp);
    await create(t => t.answer(MethodName.ProjectOpen, () => site.toJson()));

    action(Resources.openProjectLabel).click();
    await settle();
    expect(context.folderChoices).toBe(1);
    expect(context.count(MethodName.ProjectOpen)).toBe(0);

    context.chosenFolder = "D:/site";
    action(Resources.openProjectLabel).click();
    await Wait.until(() => expect(projectNames()).toEqual([SampleData.project.name, SampleData.otherProject.name, site.name]));

    expect(ProjectOpenParams.fromJson(requestOf(MethodName.ProjectOpen))).toEqual(new ProjectOpenParams("D:/site"));
    expect(store.selectedProjectId()).toBe("p3");
    expect(texts(".nol-teamrun-conversation-list > .nol-teamrun-muted", projectRow(site.name).parentElement ?? element())).toEqual([Resources.noConversations]);
  });

  it("follows conversations and projects that another window changes", async () => {
    await create();
    conversations = [SampleData.conversation, other, new Conversation("c9", "p1", "From elsewhere", "2026-09-13T08:00:00.000Z", "2026-09-13T08:00:00.000Z")];
    context.answer(MethodName.ProjectList, () => [SampleData.listed(SampleData.project)]);
    context.answer(MethodName.ConversationListMembers, t => {
      if (ConversationIdParams.fromJson(t).conversationId === second.id)
        throw new RefusedError(`Conversation ${second.id} was not found.`, ErrorCode.NotFound, second.id);
      return [];
    });

    context.emit(EventName.StateInvalidated, null);
    await Wait.until(() => expect(nested()).toEqual(["From elsewhere", SampleData.conversation.title]));

    expect(projectNames()).toEqual([SampleData.project.name]);
    expect(store.conversation(other.id)).toBeNull();
  });

  it("previews a conversation on a click and keeps it open on a double click, naming its project", async () => {
    await create();

    find<HTMLButtonElement>(".nol-teamrun-conversation-title", second.title).click();
    const title = find<HTMLButtonElement>(".nol-teamrun-conversation-title", other.title);
    title.click();
    title.dispatchEvent(new MouseEvent("dblclick", { bubbles: true }));

    expect(context.openedDocuments).toEqual([
      { name: "teamrun.conversation", instance: "c2", title: second.title, options: { preview: true, breadcrumb: [SampleData.project.name] } },
      { name: "teamrun.conversation", instance: "c3", title: other.title, options: { preview: true, breadcrumb: [SampleData.otherProject.name] } }
    ]);
    expect(store.selectedConversationId()).toBeNull();
    expect(context.keptDocuments).toEqual([{ name: "teamrun.conversation", instance: "c3" }]);
  });

  it("marks the chat whose tab is open, also while another document covers it, and none once its last tab closes", async () => {
    await create();
    const tab = TestBed.createComponent(ConversationComponent);
    tab.componentRef.setInput("instance", "c2");
    tab.detectChanges();
    await Wait.until(() => expect(store.shownConversationId()).toBe("c2"));
    await settle();
    const marked = (): string[] => texts(".nol-teamrun-selected .nol-teamrun-conversation-title");
    const open = marked();

    shown.set(false);
    await settle();
    const covered = marked();
    tab.destroy();
    await settle();

    expect([open, covered, marked(), store.selectedConversationId()]).toEqual([[second.title], [second.title], [], "c2"]);
  });

  it("marks only the chat clicked, into Chats and across projects, while its preview tab replaces the one shown and another chat's tab stays open", async () => {
    conversations = [SampleData.conversation, second, other, scratch];
    await create();
    const tabOf = (id: string): ComponentFixture<ConversationComponent> => {
      const tab = TestBed.createComponent(ConversationComponent);
      tab.componentRef.setInput("instance", id);
      tab.detectChanges();
      return tab;
    };
    const kept = tabOf(SampleData.conversation.id);
    let previous = tabOf(second.id);
    await Wait.until(() => expect(store.selectedConversationId()).toBe(second.id));
    await settle();
    const marked = (): readonly HTMLElement[] => [...element().querySelectorAll<HTMLElement>("[aria-selected='true']")];
    const steps: (readonly HTMLElement[])[] = [];

    for (const chat of [scratch, other, second]) {
      part(conversationRow(chat.title), ".nol-teamrun-conversation-title").click();
      await settle();
      steps.push(marked());
      previous.destroy();
      await settle();
      steps.push(marked());
      previous = tabOf(chat.id);
      await Wait.until(() => expect(store.selectedConversationId()).toBe(chat.id));
      await settle();
      steps.push(marked());
    }

    expect(steps).toEqual([scratch, other, second].flatMap(t => Array<HTMLElement[]>(3).fill([conversationRow(t.title)])));
    previous.destroy();
    kept.destroy();
  });

  it("marks only the chat clicked while it opens in a new tab beside the selected chat's, until its messages load", async () => {
    conversations = [SampleData.conversation, second, scratch];
    const delayed = new DeferredResponse();
    await create(t => t.answer(MethodName.MessagePage, u => MessagePageParams.fromJson(u).conversationId === scratch.id
      ? delayed.promise : SampleData.page([], false, false).toJson()));
    const tabOf = (id: string): ComponentFixture<ConversationComponent> => {
      const tab = TestBed.createComponent(ConversationComponent);
      tab.componentRef.setInput("instance", id);
      tab.detectChanges();
      return tab;
    };
    const kept = tabOf(SampleData.conversation.id);
    await Wait.until(() => expect(store.selectedConversationId()).toBe(SampleData.conversation.id));
    await settle();
    const marked = (): readonly HTMLElement[] => [...element().querySelectorAll<HTMLElement>("[aria-selected='true']")];

    part(conversationRow(scratch.title), ".nol-teamrun-conversation-title").click();
    const opened = tabOf(scratch.id);
    await settle();
    const loading = [store.selectedConversationId(), marked()];
    delayed.resolve(SampleData.page([], false, false).toJson());
    await Wait.until(() => expect(store.selectedConversationId()).toBe(scratch.id));
    await settle();

    expect([loading, marked()]).toEqual([[SampleData.conversation.id, [conversationRow(scratch.title)]], [conversationRow(scratch.title)]]);
    opened.destroy();
    kept.destroy();
  });

  it("marks a project opened while a chat without one shows, starts New chat there whatever focus or click lands in that chat, and marks the chat once its row is chosen", async () => {
    conversations = [SampleData.conversation, second, scratch];
    const started = new Conversation("c6", "p2", "New chat", "2026-09-14T08:00:00.000Z", "2026-09-14T08:00:00.000Z");
    await create(t => t.answer(MethodName.ProjectOpen, () => SampleData.otherProject.toJson()).answer(MethodName.ConversationCreate, () => started.toJson()));
    const tab = TestBed.createComponent(ConversationComponent);
    tab.componentRef.setInput("instance", scratch.id);
    tab.detectChanges();
    await Wait.until(() => expect(store.selectedConversationId()).toBe(scratch.id));
    const selectedRows = (): readonly HTMLElement[] => [...element().querySelectorAll<HTMLElement>("[aria-selected='true']")];

    await store.openProject(SampleData.otherProject.rootPath);
    const history = (tab.nativeElement as HTMLElement).querySelector(".history");
    expect([history?.dispatchEvent(new FocusEvent("focusin", { bubbles: true })), history?.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }))]).toEqual([true, true]);
    await settle();

    expect(selectedRows()).toEqual([projectRow(SampleData.otherProject.name)]);
    expect(projectRow(SampleData.otherProject.name).classList).toContain("nol-teamrun-selected");
    expect(conversationRow(scratch.title).getAttribute("aria-selected")).toBe("false");
    action(Resources.newConversationLabel).click();
    await Wait.until(() => expect(context.count(MethodName.ConversationCreate)).toBe(1));
    expect(ConversationCreateParams.fromJson(requestOf(MethodName.ConversationCreate)).projectId).toBe(SampleData.otherProject.id);

    part(conversationRow(scratch.title), ".nol-teamrun-conversation-title").click();
    await Wait.until(() => expect(store.selectedConversationId()).toBe(scratch.id));
    await settle();

    expect([store.selectedProjectId(), selectedRows()]).toEqual([null, [conversationRow(scratch.title)]]);
    tab.destroy();
  });

  it("marks the shown conversation and the ones whose reply is running, and shows each row's project and time", async () => {
    await create(t => t.answer(MethodName.MessageListOpen, () => [SampleData.reply.toJson()]));
    await store.conversationInView("c2");
    await settle();

    expect(texts(".nol-teamrun-selected .nol-teamrun-conversation-title")).toEqual([second.title]);
    expect(texts("[role='treeitem'][aria-selected='true'] .nol-teamrun-conversation-title")).toEqual([second.title]);
    expect(element().querySelectorAll("[aria-selected='true']")).toHaveLength(1);
    expect(element().querySelectorAll(".nol-teamrun-conversation-row[aria-selected='false']")).toHaveLength(2);
    expect(conversationRow(SampleData.conversation.title).querySelector(".nol-teamrun-working nol-spinner")).not.toBeNull();
    expect(conversationRow(SampleData.conversation.title).querySelector(".nol-teamrun-working")?.getAttribute("aria-label")).toBe(Resources.workingLabel);
    expect(element().querySelectorAll(".nol-teamrun-working")).toHaveLength(1);
    const tooltip = fixture.debugElement.query(By.css(".nol-teamrun-conversation-row")).injector.get(TooltipDirective);
    expect(tooltip.text()).toMatch(new RegExp(`^${SampleData.project.name}${Resources.titleSeparator}\\S`));
    expect(fixture.debugElement.query(By.css(".nol-teamrun-project-row")).injector.get(TooltipDirective).text()).toBe(SampleData.project.rootPath);
  });

  it("writes a chat's time in its tooltip in the 24-hour format once the setting asks for it, and in the 12-hour default again once the setting is cleared", async () => {
    await create(t => TimeFormatService.register(t));
    try {
      const tooltip = (): string => {
        const found = fixture.debugElement.queryAll(By.css(".nol-teamrun-conversation-row")).find(t => t.nativeElement === conversationRow(second.title));
        return found!.injector.get(TooltipDirective).text();
      };
      const before = tooltip();
      const at = new Date(second.updatedAt);
      expect(before.endsWith(`${Resources.titleSeparator}${DatePattern.format(at, Resources.defaultDateTimeFormat)}`)).toBe(true);
      expect(before).toMatch(/ [AP]M$/u);

      context.changeSetting("desktop.dateTimeFormat", "d MMM yyyy, HH:mm");
      await settle();

      expect(tooltip()).toBe(before.replace(DatePattern.format(at, Resources.defaultDateTimeFormat), DatePattern.format(at, "d MMM yyyy, HH:mm")));
      expect(tooltip()).not.toMatch(/[AP]M$/u);

      context.changeSetting("desktop.dateTimeFormat", null);
      await settle();

      expect(tooltip()).toBe(before);
    }
    finally {
      TimeFormatService.release(context);
    }
  });

  it("marks only the project whose folder is missing, with its name muted, a glyph after it and the folder in its tooltip, until a turn finds the folder back", async () => {
    await create(withMissingFolder);
    const missing = projectRow(SampleData.otherProject.name);
    const present = projectRow(SampleData.project.name);

    expect([...element().querySelectorAll(".nol-teamrun-folder-missing")].map(t => t.closest(".nol-teamrun-project-row"))).toEqual([missing]);
    expect(part(missing, ".nol-teamrun-folder-missing").textContent?.trim()).toBe(Resources.folderMissingIcon);
    expect(part(missing, ".nol-teamrun-folder-missing").getAttribute("aria-label")).toBe(Resources.folderMissingLabel);
    expect(part(missing, ".nol-teamrun-project-name").classList).toContain("nol-teamrun-muted");
    expect(part(present, ".nol-teamrun-project-name").classList).not.toContain("nol-teamrun-muted");
    expect([tooltipOf(missing), tooltipOf(present)]).toEqual([Resources.formatProjectFolderMissing(SampleData.otherProject.rootPath), SampleData.project.rootPath]);

    context.emit(EventName.ProjectFolderChanged, new ProjectFolderChange(SampleData.otherProject.id, false).toJson());
    await fixture.whenStable();

    expect(element().querySelectorAll(".nol-teamrun-folder-missing")).toHaveLength(0);
    expect(part(missing, ".nol-teamrun-project-name").classList).not.toContain("nol-teamrun-muted");
    expect(tooltipOf(missing)).toBe(SampleData.otherProject.rootPath);

    context.emit(EventName.ProjectFolderChanged, new ProjectFolderChange(SampleData.project.id, true).toJson());
    await fixture.whenStable();

    expect([...element().querySelectorAll(".nol-teamrun-folder-missing")].map(t => t.closest(".nol-teamrun-project-row"))).toEqual([present]);
  });

  it("marks a conversation whose reply waits for an approval with a raised hand in place of the spinner, and the spinner again once it is answered", async () => {
    await create(t => t.answer(MethodName.MessageListOpen, () => [SampleData.withStatus(SampleData.reply, MessageStatus.AwaitingApproval).toJson()]));
    await settle();
    const row = conversationRow(SampleData.conversation.title);

    expect(row.querySelector(".nol-teamrun-waiting")?.textContent?.trim()).toBe(Resources.awaitingApprovalGlyph);
    expect(row.querySelector(".nol-teamrun-waiting")?.getAttribute("aria-label")).toBe(Resources.awaitingApprovalLabel);
    expect(element().querySelectorAll(".nol-teamrun-waiting, .nol-teamrun-working")).toHaveLength(1);

    context.emit(EventName.MessageUpdated, SampleData.withStatus(SampleData.reply, MessageStatus.Running).toJson());
    await settle();
    expect(row.querySelector(".nol-teamrun-waiting")).toBeNull();
    expect(row.querySelector(".nol-teamrun-working nol-spinner")).not.toBeNull();
  });

  it("marks a conversation whose reply waits only for answers with a question mark, and with the raised hand once a permission waits too", async () => {
    const questions = [new ApprovalQuestion("platform", "Platform", "Which platform?", [new QuestionOption("Web", "A browser")], false, false, false)];
    const asking = new Approval("q1", "m2", ApprovalKind.Question, "AskUserQuestion", "Which platform?", null, SampleData.approval.options, ApprovalStatus.Pending,
      null, SampleData.timestamp, null, questions);
    await create(t => t.answer(MethodName.MessageListOpen, () => [SampleData.withStatus(SampleData.reply, MessageStatus.AwaitingApproval).toJson()])
      .answer(MethodName.ApprovalListPending, () => [asking.toJson()]));
    await Wait.until(() => expect(store.pendingApprovals()).toHaveLength(1));
    await settle();
    const row = conversationRow(SampleData.conversation.title);

    expect(row.querySelector(".nol-teamrun-waiting")?.textContent?.trim()).toBe(Resources.awaitingAnswerGlyph);
    expect(row.querySelector(".nol-teamrun-waiting")?.getAttribute("aria-label")).toBe(Resources.awaitingAnswerLabel);
    expect(element().querySelectorAll(".nol-teamrun-waiting, .nol-teamrun-working")).toHaveLength(1);

    context.emit(EventName.ApprovalCreated, SampleData.approval.toJson());
    await settle();
    expect(row.querySelector(".nol-teamrun-waiting")?.textContent?.trim()).toBe(Resources.awaitingApprovalGlyph);
    expect(row.querySelector(".nol-teamrun-waiting")?.getAttribute("aria-label")).toBe(Resources.awaitingApprovalLabel);
  });

  it("starts a conversation in the selected project from the top, and in a chosen project from its menu, keeping each open", async () => {
    const created = new Conversation("c5", "p1", "New chat", "2026-09-14T08:00:00.000Z", "2026-09-14T08:00:00.000Z");
    const elsewhere = new Conversation("c6", "p2", "New chat", "2026-09-14T09:00:00.000Z", "2026-09-14T09:00:00.000Z");
    await create(t => t.answer(MethodName.ConversationCreate, u => ConversationCreateParams.fromJson(u).projectId === "p1" ? created.toJson() : elsewhere.toJson()));

    action(Resources.newConversationLabel).click();
    await settle();
    await choose(projectRow(SampleData.otherProject.name), Resources.newConversationLabel);

    expect(context.requests.filter(t => t.method === "teamrun.conversationCreate").map(t => ConversationCreateParams.fromJson(t.parameters).projectId)).toEqual(["p1", "p2"]);
    expect(ConversationCreateParams.fromJson(requestOf(MethodName.ConversationCreate)).title).toBeNull();
    expect(context.openedDocuments.map(t => t.instance)).toEqual(["c5", "c6"]);
    expect(context.keptDocuments.map(t => t.instance)).toEqual(["c5", "c6"]);
    expect(nested()).toContain(created.title);
  });

  it("brings forward each project's own empty new chat from the top and from the project's menu, instead of starting another", async () => {
    const created = new Conversation("c5", "p1", "New chat", "2026-09-14T08:00:00.000Z", "2026-09-14T08:00:00.000Z");
    const elsewhere = new Conversation("c6", "p2", "New chat", "2026-09-14T09:00:00.000Z", "2026-09-14T09:00:00.000Z");
    await create(t => SampleData.keepCreatedEmpty(t, u => ConversationCreateParams.fromJson(u).projectId === "p1" ? created : elsewhere));

    action(Resources.newConversationLabel).click();
    await settle();
    await choose(projectRow(SampleData.otherProject.name), Resources.newConversationLabel);
    action(Resources.newConversationLabel).click();
    await settle();
    await choose(projectRow(SampleData.project.name), Resources.newConversationLabel);

    expect(context.requests.filter(t => t.method === "teamrun.conversationCreate").map(t => ConversationCreateParams.fromJson(t.parameters).projectId)).toEqual(["p1", "p2"]);
    expect(context.openedDocuments.map(t => t.instance)).toEqual(["c5", "c6", "c6", "c5"]);
  });

  it("renames a conversation with the title the person saves, and leaves it when they close the dialog", async () => {
    await create(t => t.answer(MethodName.ConversationRename, u => new Conversation("c2", "p1", ConversationRenameParams.fromJson(u).title, second.createdAt, second.updatedAt).toJson()));

    await choose(conversationRow(second.title), Resources.renameConversationLabel);
    expect(document.querySelector<HTMLInputElement>("nol-teamrun-rename-dialog .nol-teamrun-rename-title")?.value).toBe(second.title);
    await answerDialog("nol-teamrun-rename-dialog .nol-teamrun-cancel");
    expect(context.count(MethodName.ConversationRename)).toBe(0);
    expect(document.querySelector("nol-teamrun-rename-dialog")).toBeNull();

    await choose(conversationRow(second.title), Resources.renameConversationLabel);
    const field = document.querySelector<HTMLInputElement>("nol-teamrun-rename-dialog .nol-teamrun-rename-title");
    if (Object.isNull(field))
      throw new Error("The rename dialog shows no title field.");
    field.value = " Renamed ";
    field.dispatchEvent(new Event("input"));
    await settle();
    await answerDialog("nol-teamrun-rename-dialog .nol-teamrun-save");

    expect(ConversationRenameParams.fromJson(requestOf(MethodName.ConversationRename))).toEqual(new ConversationRenameParams("c2", "Renamed"));
    await Wait.until(() => expect(nested()).toContain("Renamed"));
    expect(document.querySelector("nol-teamrun-rename-dialog")).toBeNull();
  });

  it("deletes a conversation only after the person confirms", async () => {
    await create(t => t.answer(MethodName.ConversationDelete, () => null));

    await choose(conversationRow(second.title), Resources.deleteConversationLabel);
    expect(document.querySelector("nol-teamrun-confirm-dialog")?.textContent).toContain(Resources.formatDeleteText(second.title));
    await answerDialog("nol-teamrun-confirm-dialog .nol-teamrun-cancel");
    expect(context.count(MethodName.ConversationDelete)).toBe(0);
    expect(nested()).toContain(second.title);

    await choose(conversationRow(second.title), Resources.deleteConversationLabel);
    await answerDialog("nol-teamrun-confirm-dialog .nol-teamrun-confirm");

    expect(ConversationIdParams.fromJson(requestOf(MethodName.ConversationDelete)).conversationId).toBe("c2");
    await Wait.until(() => expect(nested()).not.toContain(second.title));
    expect(document.querySelector("nol-teamrun-confirm-dialog")).toBeNull();
  });

  it("moves the focus to the next row of its tree once a chat is deleted, to New chat once the chat's group is gone, and leaves a focus the person moved meanwhile", async () => {
    conversations = [SampleData.conversation, second, other, scratch];
    let deleting = new DeferredResponse();
    await create(t => t.answer(MethodName.ConversationFolderCount, () => 0).answer(MethodName.ConversationDelete, () => deleting.promise));
    const remove = async (title: string): Promise<void> => {
      deleting = new DeferredResponse();
      conversationRow(title).focus();
      await choose(conversationRow(title), Resources.deleteConversationLabel);
      await answerDialog("nol-teamrun-confirm-dialog .nol-teamrun-confirm");
    };
    const rows = [...element().querySelectorAll(`#${Resources.projectsGroupId} [role="treeitem"]`)];
    const next = rows[rows.indexOf(conversationRow(second.title)) + 1];

    await remove(second.title);
    deleting.resolve(null);
    await Wait.until(() => expect(document.activeElement).toBe(next));
    await remove(scratch.title);
    deleting.resolve(null);
    await Wait.until(() => expect(document.activeElement).toBe(part(element(), ".nol-teamrun-action")));
    await remove(other.title);
    const outside = document.body.appendChild(document.createElement("button"));
    outside.focus();
    deleting.resolve(null);
    await Wait.until(() => expect(element().textContent).not.toContain(other.title));
    await settle();
    const kept = document.activeElement === outside;
    outside.remove();

    expect([Object.isUndefined(next), kept]).toEqual([false, true]);
  });

  it("moves the focus to the row before once the last row of its tree is deleted", async () => {
    conversations = [SampleData.conversation, second, other];
    await create(t => t.answer(MethodName.ConversationFolderCount, () => 0).answer(MethodName.ConversationDelete, () => null));
    const rows = [...element().querySelectorAll<HTMLElement>(`#${Resources.projectsGroupId} [role="treeitem"]`)];
    const last = conversationRow(other.title);
    const before = itemAt(rows, rows.length - 2);

    last.focus();
    await choose(last, Resources.deleteConversationLabel);
    await answerDialog("nol-teamrun-confirm-dialog .nol-teamrun-confirm");

    await Wait.until(() => expect(document.activeElement).toBe(before));
    expect([rows.at(-1) === last, last.isConnected, before.isConnected]).toEqual([true, false, true]);
  });

  it("attaches the folder the person chooses to a chat without a project, then offers to replace it after a confirm or detach it, and offers neither in a project", async () => {
    const attachedTo = (folder: string): Conversation => scratch.withAttachedFolder(folder, SampleData.timestamp).withFolder(folder);
    conversations = [SampleData.conversation, scratch];
    await create(t => t.answer(MethodName.ChatFolderAttach, u => attachedTo(ChatFolderAttachParams.fromJson(u).folder).toJson())
      .answer(MethodName.ChatFolderDetach, () => scratch.toJson()));
    const rowMenu = async (title: string): Promise<string[]> => {
      conversationRow(title).querySelector<HTMLButtonElement>(".nol-teamrun-row-actions")?.click();
      await settle();
      const labels = texts("button[nol-menu-item] .nol-menu-item-label", itemAt([...document.querySelectorAll("nol-menu")], 0));
      await userEvent.keyboard("{Escape}");
      await settle();
      return labels;
    };
    const chatTooltip = (): string => {
      const found = fixture.debugElement.queryAll(By.css(".nol-teamrun-conversation-row")).find(t => t.nativeElement === conversationRow(scratch.title));
      if (Object.isUndefined(found))
        throw new Error("The chat's row is not shown.");
      return found.injector.get(TooltipDirective).text();
    };
    const attached = (): string[] => context.requests.filter(t => t.method === FakeWindowPartContext.qualify(MethodName.ChatFolderAttach))
      .map(t => ChatFolderAttachParams.fromJson(t.parameters).folder);
    const inProject = await rowMenu(SampleData.conversation.title);
    const own = await rowMenu(scratch.title);

    await choose(conversationRow(scratch.title), Resources.attachFolderLabel);
    const unchosen = [context.folderChoices, attached().length];
    context.chosenFolder = "D:/site";
    await choose(conversationRow(scratch.title), Resources.attachFolderLabel);
    await Wait.until(() => expect(store.conversation("c5")?.attachedFolder).toBe("D:/site"));
    const withFolder = await rowMenu(scratch.title);
    const tooltip = chatTooltip();
    context.chosenFolder = "E:/other";
    await choose(conversationRow(scratch.title), Resources.replaceFolderLabel);
    const asked = dialogText();
    await answerDialog("nol-teamrun-confirm-dialog .nol-teamrun-cancel");
    const afterCancel = attached().length;
    await choose(conversationRow(scratch.title), Resources.replaceFolderLabel);
    await answerDialog("nol-teamrun-confirm-dialog .nol-teamrun-confirm");
    await Wait.until(() => expect(store.conversation("c5")?.attachedFolder).toBe("E:/other"));
    await choose(conversationRow(scratch.title), Resources.detachFolderLabel);
    await Wait.until(() => expect(store.conversation("c5")?.attachedFolder).toBeNull());

    expect(inProject.filter(t => [Resources.attachFolderLabel, Resources.replaceFolderLabel, Resources.detachFolderLabel].includes(t))).toEqual([]);
    expect(own.slice(-3)).toEqual([Resources.moveToProjectLabel, Resources.attachFolderLabel, Resources.deleteConversationLabel]);
    expect(unchosen).toEqual([1, 0]);
    expect(withFolder.slice(-4)).toEqual([Resources.moveToProjectLabel, Resources.replaceFolderLabel, Resources.detachFolderLabel, Resources.deleteConversationLabel]);
    expect(tooltip).toMatch(new RegExp(`^${Resources.chatsTitle}${Resources.titleSeparator}D:/site${Resources.titleSeparator}\\S`, "u"));
    expect([asked, afterCancel]).toEqual([Resources.formatReplaceFolderText("D:/site", "E:/other"), 1]);
    expect(attached()).toEqual(["D:/site", "E:/other"]);
    expect(ConversationIdParams.fromJson(requestOf(MethodName.ChatFolderDetach)).conversationId).toBe("c5");
    expect(await rowMenu(scratch.title)).toEqual(own);
  });

  it("says that the attached folder and its files stay when deleting a chat with one, with or without files of its own", async () => {
    let files = 0;
    const site = scratch.withAttachedFolder("D:\\work\\site",SampleData.timestamp);
    conversations = [site];
    await create(t => t.answer(MethodName.ConversationFolderCount, () => files));

    await choose(conversationRow(scratch.title), Resources.deleteConversationLabel);
    const empty = dialogText();
    await answerDialog("nol-teamrun-confirm-dialog .nol-teamrun-cancel");
    files = 2;
    await choose(conversationRow(scratch.title), Resources.deleteConversationLabel);
    const holding = dialogText();
    await answerDialog("nol-teamrun-confirm-dialog .nol-teamrun-cancel");

    expect([empty, holding]).toEqual([`${Resources.formatDeleteText(scratch.title)} ${Resources.formatAttachedFolderKept("site")}`,
      `${Resources.formatDeleteWithFilesText(scratch.title, 2)} ${Resources.formatAttachedFolderKept("site")}`]);
    expect(context.count(MethodName.ConversationDelete)).toBe(0);
  });

  it("names the files a chat without a project holds when deleting it, offers Move to a folder… instead, and asks plainly when it holds none", async () => {
    let files = 2;
    conversations = [SampleData.conversation, scratch];
    await create(t => t.answer(MethodName.ConversationFolderCount, () => files).answer(MethodName.ConversationDelete, () => null));

    await choose(conversationRow(SampleData.conversation.title), Resources.deleteConversationLabel);
    expect([dialogText(), context.count(MethodName.ConversationFolderCount)]).toEqual([Resources.formatDeleteText(SampleData.conversation.title), 0]);
    expect(document.querySelector("nol-teamrun-confirm-dialog .nol-teamrun-other")).toBeNull();
    await answerDialog("nol-teamrun-confirm-dialog .nol-teamrun-cancel");

    await choose(conversationRow(scratch.title), Resources.deleteConversationLabel);
    expect(dialogText()).toBe(`"${scratch.title}", its messages and the 2 files it holds are removed. This cannot be undone. `
      + "To keep the chat and its files, move it to a folder instead.");
    expect(ConversationIdParams.fromJson(requestOf(MethodName.ConversationFolderCount)).conversationId).toBe("c5");
    expect(document.querySelector("nol-teamrun-confirm-dialog .nol-teamrun-other")?.textContent?.trim()).toBe("Move to a folder…");
    await answerDialog("nol-teamrun-confirm-dialog .nol-teamrun-other");
    expect([document.querySelector("nol-teamrun-confirm-dialog"), context.folderChoices, context.count(MethodName.ConversationDelete)]).toEqual([null, 1, 0]);

    files = 0;
    await choose(conversationRow(scratch.title), Resources.deleteConversationLabel);
    expect(dialogText()).toBe(Resources.formatDeleteText(scratch.title));
    await answerDialog("nol-teamrun-confirm-dialog .nol-teamrun-confirm");

    expect(ConversationIdParams.fromJson(requestOf(MethodName.ConversationDelete)).conversationId).toBe("c5");
    await Wait.until(() => expect(chats()).toEqual([]));
  });

  it("deletes nothing and asks nothing when it can't count a chat's files", async () => {
    conversations = [scratch];
    await create(t => t.fail(MethodName.ConversationFolderCount, "The folder is gone."));

    await choose(conversationRow(scratch.title), Resources.deleteConversationLabel);

    expect(document.querySelector("nol-teamrun-confirm-dialog")).toBeNull();
    expect(context.count(MethodName.ConversationDelete)).toBe(0);
    await Wait.until(() => expect([context.shownNotices(Resources.chatActionFailedNotice).at(-1)?.title, context.noticeText()])
      .toEqual([Resources.chatActionTitles[ChatAction.DeleteChat], "The folder is gone."]));
  });

  it("moves a chat without a project into the folder the person chooses from Move to a folder…, naming the files it copies, and opens the project only after they confirm", async () => {
    const site = new Project("p3", "site", "D:/site", SampleData.timestamp);
    let files = 3;
    conversations = [SampleData.conversation, scratch];
    await create(t => t.answer(MethodName.ProjectOpen, () => site.toJson()).answer(MethodName.ConversationFolderCount, () => files)
      .answer(MethodName.ConversationMove, u => scratch.withProjectId(ConversationMoveParams.fromJson(u).projectId, SampleData.timestamp).toJson()));
    await choose(conversationRow(scratch.title), Resources.moveToProjectLabel);
    await pick(Resources.moveToFolderLabel);
    expect([context.folderChoices, context.count(MethodName.ProjectOpen), context.count(MethodName.ConversationFolderCount)]).toEqual([1, 0, 0]);

    context.chosenFolder = "D:/site";
    await choose(conversationRow(scratch.title), Resources.moveToProjectLabel);
    await pick(Resources.moveToFolderLabel);
    expect(dialogText()).toBe(Resources.formatMoveText(3, site.name));
    await answerDialog("nol-teamrun-confirm-dialog .nol-teamrun-cancel");
    expect([context.count(MethodName.ProjectOpen), context.count(MethodName.ConversationMove)]).toEqual([0, 0]);

    context.chosenFolder = "D:\\";
    await choose(conversationRow(scratch.title), Resources.moveToProjectLabel);
    await pick(Resources.moveToFolderLabel);
    expect(dialogText()).toBe(Resources.formatMoveText(3, "D:\\"));
    await answerDialog("nol-teamrun-confirm-dialog .nol-teamrun-cancel");
    context.chosenFolder = "D:/site";

    files = 0;
    await choose(conversationRow(scratch.title), Resources.moveToProjectLabel);
    await pick(Resources.moveToFolderLabel);

    expect(document.querySelector("nol-teamrun-confirm-dialog")).toBeNull();
    expect(ConversationMoveParams.fromJson(requestOf(MethodName.ConversationMove))).toEqual(new ConversationMoveParams("c5", "p3"));
    await Wait.until(() => expect(chats()).toEqual([]));
    expect(store.conversationsOf("p3").map(t => t.id)).toEqual(["c5"]);
  });

  it("moves a chat that holds files once the person confirms, and moves nothing when the folder can't open or its files can't be counted", async () => {
    const site = new Project("p3", "site", "D:/site", SampleData.timestamp);
    conversations = [scratch];
    await create(t => t.answer(MethodName.ProjectOpen, () => site.toJson()).answer(MethodName.ConversationFolderCount, () => 1)
      .answer(MethodName.ConversationMove, u => scratch.withProjectId(ConversationMoveParams.fromJson(u).projectId, SampleData.timestamp).toJson()));
    context.chosenFolder = "D:/site";

    await choose(conversationRow(scratch.title), Resources.moveToProjectLabel);
    await pick(Resources.moveToFolderLabel);
    expect(dialogText()).toBe(Resources.formatMoveText(1, site.name));
    await answerDialog("nol-teamrun-confirm-dialog .nol-teamrun-confirm");
    await Wait.until(() => expect(chats()).toEqual([]));
    expect(ConversationMoveParams.fromJson(requestOf(MethodName.ConversationMove))).toEqual(new ConversationMoveParams("c5", "p3"));

    context.fail(MethodName.ProjectOpen, "The folder is gone.");
    conversations = [scratch];
    context.emit(EventName.StateInvalidated, null);
    await Wait.until(() => expect(chats()).toEqual([scratch.title]));
    await choose(conversationRow(scratch.title), Resources.moveToProjectLabel);
    await pick(Resources.moveToFolderLabel);
    await answerDialog("nol-teamrun-confirm-dialog .nol-teamrun-confirm");
    await Wait.until(() => expect(context.noticeText()).toBe("The folder is gone."));
    expect([context.count(MethodName.ConversationMove), context.count(MethodName.ConversationFolderCount)]).toEqual([1, 2]);

    context.answer(MethodName.ProjectOpen, () => site.toJson()).fail(MethodName.ConversationFolderCount, "The folder can't be read.");
    await choose(conversationRow(scratch.title), Resources.moveToProjectLabel);
    await pick(Resources.moveToFolderLabel);

    expect([context.count(MethodName.ConversationMove), context.count(MethodName.ConversationFolderCount), context.count(MethodName.ProjectOpen)]).toEqual([1, 3, 2]);
    expect(document.querySelector("nol-teamrun-confirm-dialog")).toBeNull();
    await Wait.until(() => expect([context.shownNotices(Resources.chatActionFailedNotice).at(-1)?.title, context.noticeText()])
      .toEqual([Resources.chatActionTitles[ChatAction.MoveChat], "The folder can't be read."]));
  });

  it("offers a chat without a project the open projects in the Projects order, then Move to a folder…, and moves it to the one picked once the person confirms its files", async () => {
    conversations = [SampleData.conversation, scratch];
    await create(t => t.answer(MethodName.ConversationFolderCount, () => 2)
      .answer(MethodName.ConversationMove, u => scratch.withProjectId(ConversationMoveParams.fromJson(u).projectId, SampleData.timestamp).toJson()));
    layout.orderProjects(["p2", "p1"]);
    await settle();

    await choose(conversationRow(scratch.title), Resources.moveToProjectLabel);
    expect([menuLabels(), submenu().querySelectorAll("nol-menu-separator").length])
      .toEqual([[SampleData.otherProject.name, SampleData.project.name, Resources.moveToFolderLabel], 1]);
    await pick(SampleData.project.name);
    expect(dialogText()).toBe(Resources.formatMoveText(2, SampleData.project.name));
    await answerDialog("nol-teamrun-confirm-dialog .nol-teamrun-confirm");

    await Wait.until(() => expect(chats()).toEqual([]));
    expect(ConversationMoveParams.fromJson(requestOf(MethodName.ConversationMove))).toEqual(new ConversationMoveParams("c5", "p1"));
    expect([context.count(MethodName.ProjectOpen), context.folderChoices]).toEqual([0, 0]);
  });

  it("offers a chat in a project the other open projects, then Move to a folder…, and moves it without counting its files", async () => {
    const site = new Project("p3", "site", "D:/site", SampleData.timestamp);
    conversations = [SampleData.conversation, second];
    await create(t => t.answer(MethodName.ProjectOpen, () => site.toJson()).answer(MethodName.ConversationMove, u => {
      const params = ConversationMoveParams.fromJson(u);
      return itemAt(conversations.filter(v => v.id === params.conversationId), 0).withProjectId(params.projectId, SampleData.timestamp).toJson();
    }));

    await choose(conversationRow(SampleData.conversation.title), Resources.moveToAnotherProjectLabel);
    expect(menuLabels()).toEqual([SampleData.otherProject.name, Resources.moveToFolderLabel]);
    await pick(SampleData.otherProject.name);
    await Wait.until(() => expect(context.count(MethodName.ConversationMove)).toBe(1));
    expect(ConversationMoveParams.fromJson(requestOf(MethodName.ConversationMove))).toEqual(new ConversationMoveParams("c1", "p2"));

    context.chosenFolder = "D:/site";
    await choose(conversationRow(second.title), Resources.moveToAnotherProjectLabel);
    await pick(Resources.moveToFolderLabel);

    await Wait.until(() => expect(context.requests.filter(t => t.method === "teamrun.conversationMove").map(t => ConversationMoveParams.fromJson(t.parameters)))
      .toEqual([new ConversationMoveParams("c1", "p2"), new ConversationMoveParams("c2", "p3")]));
    expect([context.count(MethodName.ConversationFolderCount), context.count(MethodName.ProjectOpen), document.querySelector("nol-teamrun-confirm-dialog")])
      .toEqual([0, 1, null]);
  });

  it("offers only Move to a folder… when no other project is open", async () => {
    await create(t => t.answer(MethodName.ProjectList, () => [SampleData.listed(SampleData.project)]));

    await choose(conversationRow(SampleData.conversation.title), Resources.moveToAnotherProjectLabel);

    expect([menuLabels(), submenu().querySelectorAll("nol-menu-separator").length]).toEqual([["Move to a folder…"], 0]);
  });

  it("shows the confirm button in the danger look when deleting a chat, with or without files, and forgetting a project, but not when moving a chat", async () => {
    conversations = [SampleData.conversation, scratch];
    await create(t => t.answer(MethodName.ConversationFolderCount, () => 2));
    const isDanger = (): boolean => part(document, "nol-teamrun-confirm-dialog .nol-teamrun-confirm").classList.contains("nol-button-danger");
    const looks: boolean[] = [];

    const asks: readonly (readonly [() => HTMLElement, string])[] = [[() => conversationRow(SampleData.conversation.title), Resources.deleteConversationLabel],
      [() => conversationRow(scratch.title), Resources.deleteConversationLabel], [() => projectRow(SampleData.otherProject.name), Resources.forgetProjectLabel]];
    for (const [row, label] of asks) {
      await choose(row(), label);
      looks.push(isDanger());
      await answerDialog("nol-teamrun-confirm-dialog .nol-teamrun-cancel");
    }
    await choose(conversationRow(scratch.title), Resources.moveToProjectLabel);
    await pick(SampleData.project.name);
    looks.push(isDanger());
    await answerDialog("nol-teamrun-confirm-dialog .nol-teamrun-cancel");

    expect(looks).toEqual([true, true, true, false]);
  });

  it("forgets a project only after the person confirms, which leaves its folder to the runtime part", async () => {
    await create(t => t.answer(MethodName.ProjectForget, () => null));

    await choose(projectRow(SampleData.otherProject.name), Resources.forgetProjectLabel);
    expect(document.querySelector("nol-teamrun-confirm-dialog")?.textContent).toContain(Resources.formatForgetText(SampleData.otherProject.name));
    await answerDialog("nol-teamrun-confirm-dialog .nol-teamrun-cancel");
    expect(context.count(MethodName.ProjectForget)).toBe(0);

    await choose(projectRow(SampleData.otherProject.name), Resources.forgetProjectLabel);
    await answerDialog("nol-teamrun-confirm-dialog .nol-teamrun-confirm");

    expect(ProjectIdParams.fromJson(requestOf(MethodName.ProjectForget)).projectId).toBe("p2");
    await Wait.until(() => expect(projectNames()).toEqual([SampleData.project.name]));
  });

  it("names its navigation landmark Projects", async () => {
    await create();

    expect(part(element(), "nav").getAttribute("aria-label")).toBe(Resources.projectsViewTitle);
  });

  it("marks the shown conversation in the system's highlight colours under forced colours, which drop its background", async () => {
    await create();
    await store.conversationInView("c2");
    await settle();
    const probe = document.createElement("span");
    probe.style.cssText = "forced-color-adjust: none; background-color: Highlight; color: HighlightText";
    document.body.append(probe);
    try {
      await EmulatedMediaFixture.emulateAsync("forced-colors", "active");
      const highlight = getComputedStyle(probe);
      const shownRow = conversationRow(second.title);

      expect(getComputedStyle(shownRow).backgroundColor).toBe(highlight.backgroundColor);
      expect(getComputedStyle(part(shownRow, ".nol-teamrun-conversation-title")).color).toBe(highlight.color);
      expect(getComputedStyle(conversationRow(SampleData.conversation.title)).backgroundColor).not.toBe(highlight.backgroundColor);
    } finally {
      probe.remove();
      await EmulatedMediaFixture.resetAsync();
    }
  });

  it("draws a running conversation's spinner arc and ring in HighlightText on the shown row's Highlight fill under forced colours, and a Highlight arc over a GrayText ring once another row is shown", async () => {
    await create(t => t.answer(MethodName.MessageListOpen, () => [SampleData.reply.toJson()]));
    await store.conversationInView(SampleData.conversation.id);
    await settle();
    const resolve = (color: string): string => {
      const probe = document.body.appendChild(document.createElement("span"));
      probe.style.cssText = `forced-color-adjust: none; color: ${color}`;
      const resolved = getComputedStyle(probe).color;
      probe.remove();
      return resolved;
    };
    const look = (): readonly string[] => {
      const row = conversationRow(SampleData.conversation.title);
      const ring = getComputedStyle(part(row, ".nol-teamrun-working .nol-spinner-ring"));
      return [getComputedStyle(row).backgroundColor, ring.borderTopColor, ring.borderBottomColor];
    };
    try {
      await EmulatedMediaFixture.emulateAsync("forced-colors", "active");
      const [highlight, text, gray] = ["Highlight", "HighlightText", "GrayText"].map(resolve);
      const shown = look();
      await store.conversationInView("c2");
      await settle();

      expect([shown, look().slice(1)]).toEqual([[highlight, text, text], [highlight, gray]]);
    } finally {
      await EmulatedMediaFixture.resetAsync();
    }
  });

  it("lists New chat and Open folder above the projects, with no Search row, as the earlier app's Explorer had none", async () => {
    await create();

    expect(texts(".nol-teamrun-action .nol-teamrun-label")).toEqual([Resources.newConversationLabel, Resources.openProjectLabel]);
  });

  it("shows New chat, Open folder, then Organizations, with no Teammates section between them", async () => {
    await create();
    const [newChat, openFolder, next] = [...part(element(), ".nol-teamrun-projects").children];

    expect([newChat, openFolder].map(t => t?.querySelector(".nol-teamrun-label")?.textContent?.trim())).toEqual([Resources.newConversationLabel, Resources.openProjectLabel]);
    expect(next?.tagName.toLowerCase()).toBe("nol-section-header");
    expect(next?.querySelector(".nol-section-header-label")?.textContent?.trim()).toBe(Resources.organizationsTitle);
    expect(element().textContent).not.toContain(Resources.teammatesTitle);
  });

  it("lists Open browser right after Open folder, with the Browser's globe, while the Browser module is on, and drops it while the module is off", async () => {
    await create(withBrowser);
    const [, openFolder, openBrowser, next] = [...part(element(), ".nol-teamrun-projects").children];

    expect(texts(".nol-teamrun-action .nol-teamrun-label")).toEqual([Resources.newConversationLabel, Resources.openProjectLabel, Resources.openBrowserLabel]);
    expect([openFolder, openBrowser].map(t => t?.querySelector(".nol-teamrun-glyph")?.textContent?.trim())).toEqual([Resources.openProjectIcon, "language"]);
    expect([openBrowser?.className, openBrowser?.getAttribute("type")]).toEqual([openFolder?.className, "button"]);
    expect(next?.tagName.toLowerCase()).toBe("nol-section-header");

    context.changeDependency("browser", false);
    await settle();
    expect(texts(".nol-teamrun-action .nol-teamrun-label")).toEqual([Resources.newConversationLabel, Resources.openProjectLabel]);

    context.changeDependency("browser", true);
    await settle();
    expect(texts(".nol-teamrun-action .nol-teamrun-label")).toEqual([Resources.newConversationLabel, Resources.openProjectLabel, Resources.openBrowserLabel]);
  });

  it("opens a new empty Browser tab in the person's own browsing from Open browser, by mouse and by Enter and Space, one tab for each", async () => {
    await create(withBrowser);
    const openBrowser = action(Resources.openBrowserLabel);
    const opened = { name: Resources.browserOpenPageCommand, commandArguments: {} };

    await userEvent.click(openBrowser);
    expect(context.ranCommands).toEqual([opened]);

    openBrowser.focus();
    await userEvent.keyboard("{Enter}");
    await userEvent.keyboard(" ");
    await Wait.until(() => expect(context.ranCommands).toEqual([opened, opened, opened]));
    expect(document.activeElement).toBe(openBrowser);
  });

  it("shows no Open browser row when the Browser module is off as the window part starts, and lists it once the module comes on", async () => {
    await create(t => BrowserAvailability.register(t));

    expect(texts(".nol-teamrun-action .nol-teamrun-label")).toEqual([Resources.newConversationLabel, Resources.openProjectLabel]);

    context.changeDependency("browser", true);
    await settle();
    expect(texts(".nol-teamrun-action .nol-teamrun-label")).toEqual([Resources.newConversationLabel, Resources.openProjectLabel, Resources.openBrowserLabel]);
  });

  it("shows no Open browser row while the window doesn't know the Browser module is on", async () => {
    await create();

    expect(texts(".nol-teamrun-action .nol-teamrun-label")).toEqual([Resources.newConversationLabel, Resources.openProjectLabel]);
    expect(element().textContent).not.toContain(Resources.openBrowserLabel);
  });

  it("pins and unpins from the row menu, showing pins first and only there", async () => {
    await create();

    await choose(conversationRow(second.title), Resources.pinLabel);

    expect(layout.pinnedConversations()).toEqual(["c2"]);
    expect(headers()).toEqual([Resources.pinnedTitle, Resources.organizationsTitle, Resources.projectsViewTitle]);
    expect(pinned()).toEqual([second.title]);
    expect(nested()).toEqual([SampleData.conversation.title, other.title]);

    await choose(find<HTMLElement>(".nol-teamrun-pins .nol-teamrun-conversation-row", second.title), Resources.unpinLabel);

    expect(layout.pinnedConversations()).toEqual([]);
    expect(headers()).toEqual([Resources.organizationsTitle, Resources.projectsViewTitle]);
    expect(nested()).toEqual([second.title, SampleData.conversation.title, other.title]);
  });

  it("drops a pin that names a conversation no longer listed", async () => {
    await create(t => t.answer(MethodName.ProjectsLayoutRead, () => ({ pinnedChats: ["gone", "c1"] })));

    await Wait.until(() => expect(pinned()).toEqual([SampleData.conversation.title]));
  });

  it("collapses and opens a project from its twistie and from its name, its row saying whether the project is open", async () => {
    await create();
    const row = (): HTMLElement => projectRow(SampleData.project.name);
    const twistie = (): HTMLElement => part(row(), ".nol-teamrun-twistie");

    expect([row().getAttribute("aria-expanded"), row().getAttribute("aria-owns"), twistie().getAttribute("aria-hidden")]).toEqual(["true", `${Resources.conversationListIdPrefix}p1`, "true"]);
    twistie().click();
    await settle();
    expect([row().getAttribute("aria-expanded"), row().getAttribute("aria-owns")]).toEqual(["false", null]);
    expect(twistie().textContent?.trim()).toBe(Resources.collapsedIcon);
    expect(nested()).toEqual([other.title]);

    part(row(), ".nol-teamrun-project-name").click();
    await settle();
    expect(row().getAttribute("aria-expanded")).toBe("true");
    expect(twistie().textContent?.trim()).toBe(Resources.expandedIcon);
    expect(nested()).toEqual([second.title, SampleData.conversation.title, other.title]);
  });

  describe("its groups", () => {
    const header = (label: string): HTMLElement => find<HTMLElement>("nol-section-header", label);
    const toggle = (label: string): HTMLElement => part(header(label), ".nol-section-header-toggle");
    const states = (): (string | null)[] => [...element().querySelectorAll(".nol-section-header-toggle")].map(t => t.getAttribute("aria-expanded"));
    const controlled = (label: string): HTMLElement | null => document.getElementById(toggle(label).getAttribute("aria-controls") ?? String.empty);

    it("titles Pinned, Projects and Chats, each a button that ends with its caret, says its group is open and names the group it controls", async () => {
      conversations = [SampleData.conversation, second, scratch];
      await create();
      await choose(conversationRow(second.title), Resources.pinLabel);
      const ids = [Resources.pinnedGroupId, Resources.projectsGroupId, Resources.chatsGroupId];
      const titles = [Resources.pinnedTitle, Resources.projectsViewTitle, Resources.chatsTitle];

      expect(headers()).toEqual(["Pinned", "Organizations", "Projects", "Chats"]);
      expect(titles.map(t => [toggle(t).tagName.toLowerCase(), toggle(t).getAttribute("aria-controls"), toggle(t).lastElementChild?.classList.contains("nol-section-header-caret")]))
        .toEqual(ids.map(t => ["button", t, true]));
      expect(states()).toEqual(["true", "true", "true", "true"]);
      expect(ids.map(t => document.getElementById(t))).toEqual([part(element(), ".nol-teamrun-pins"), part(element(), ".nol-teamrun-project-list"),
        part(element(), ".nol-teamrun-chat-list")]);
      expect(part(header(Resources.chatsTitle), ".nol-section-header-icon").textContent?.trim()).toBe(Resources.chatsIcon);
    });

    it("draws each group's caret 0.875rem wide in the default theme", async () => {
      conversations = [SampleData.conversation, second, scratch];
      await create();
      AppearanceFixture.apply(DefaultTheme.theme, ThemeMode.Light);
      try {
        for (const label of [Resources.projectsViewTitle, Resources.chatsTitle]) {
          const caret = part(header(label), ".nol-section-header-caret");
          AppearanceFixture.expectPixels(caret.getBoundingClientRect().width, AppearanceFixture.toPixels(0.875));
          AppearanceFixture.expectPixels(Number.parseFloat(getComputedStyle(caret).fontSize), AppearanceFixture.toPixels(0.875));
        }
      } finally {
        AppearanceFixture.reset();
      }
    });

    it("sets each group's title in capitals, while the rows under it keep their own case", async () => {
      conversations = [SampleData.conversation, second, scratch];
      await create();
      await choose(conversationRow(second.title), Resources.pinLabel);
      const titles = [Resources.pinnedTitle, Resources.projectsViewTitle, Resources.chatsTitle];

      expect(titles.map(t => getComputedStyle(part(header(t), ".nol-section-header-label")).textTransform)).toEqual(["uppercase", "uppercase", "uppercase"]);
      expect(getComputedStyle(conversationRow(second.title)).textTransform).toBe("none");
    });

    it("collapses a group from a click on its title, taking its rows away from the list its title names and leaving the others, then opens it again, saving each change", async () => {
      const saved: unknown[] = [];
      conversations = [SampleData.conversation, second, scratch];
      await create(t => t.answer(MethodName.ProjectsLayoutSave, u => {
        const kept = ProjectsLayoutSaveParams.fromJson(u).layout;
        saved.push(kept[Resources.collapsedGroupsField]);
        return kept;
      }));

      await userEvent.click(toggle(Resources.projectsViewTitle));
      await settle();
      expect([states(), projectNames(), nested(), chats()]).toEqual([["true", "false", "true"], [], [], [scratch.title]]);
      expect([controlled(Resources.projectsViewTitle) === part(element(), ".nol-teamrun-project-list"), controlled(Resources.projectsViewTitle)?.childElementCount]).toEqual([true, 0]);

      await userEvent.click(toggle(Resources.chatsTitle));
      await settle();
      expect([states(), chats()]).toEqual([["true", "false", "false"], []]);

      await userEvent.click(toggle(Resources.projectsViewTitle));
      await settle();
      expect([states(), projectNames(), nested()]).toEqual([["true", "true", "false"], [SampleData.project.name, SampleData.otherProject.name],
        [second.title, SampleData.conversation.title]]);
      expect([controlled(Resources.projectsViewTitle) === part(element(), ".nol-teamrun-project-list"), controlled(Resources.chatsTitle) === part(element(), ".nol-teamrun-chat-list"),
        controlled(Resources.chatsTitle)?.childElementCount]).toEqual([true, true, 0]);
      expect(saved).toEqual([["Projects"], ["Projects", "Chats"], ["Chats"]]);
    });

    it("collapses and opens a group by Enter and by Space on its title, keeping the focus there", async () => {
      await create();
      await choose(conversationRow(second.title), Resources.pinLabel);
      toggle(Resources.pinnedTitle).focus();

      await userEvent.keyboard("{Enter}");
      await settle();
      const afterEnter = [toggle(Resources.pinnedTitle).getAttribute("aria-expanded"), pinned()];
      await userEvent.keyboard(" ");
      await settle();

      expect(afterEnter).toEqual(["false", []]);
      expect([toggle(Resources.pinnedTitle).getAttribute("aria-expanded"), pinned(), document.activeElement === toggle(Resources.pinnedTitle)])
        .toEqual(["true", [second.title], true]);
    });

    it("starts with the groups collapsed before a restart still collapsed, skipping a name it has no group for", async () => {
      conversations = [SampleData.conversation, second, scratch];
      await create(t => t.answer(MethodName.ProjectsLayoutRead, () => ({ pinnedChats: ["c2"], [Resources.collapsedGroupsField]: ["Chats", "Later", "Pinned"] })));

      await Wait.until(() => expect(headers()).toEqual([Resources.pinnedTitle, Resources.organizationsTitle, Resources.projectsViewTitle, Resources.chatsTitle]));
      expect([states(), pinned(), nested(), chats()]).toEqual([["false", "true", "true", "false"], [], [SampleData.conversation.title], []]);
      expect(layout.layout().collapsedGroups).toEqual(["Chats", "Pinned"]);
    });
  });

  it("shows a project's first conversations and the rest on Show more, counting only unpinned ones", async () => {
    conversations = Array.from({ length: 12 }, (_, i) => {
      const at = `2026-09-11T${String(i).padStart(2, "0")}:00:00.000Z`;
      return new Conversation(`n${i}`, "p1", `Talk ${i}`, at, at);
    });
    await create();
    const showMore = (): HTMLElement | null => element().querySelector<HTMLElement>(".nol-teamrun-show-more");

    expect(nested()).toHaveLength(10);
    expect(showMore()?.textContent?.trim()).toBe(Resources.formatShowMore(2));
    layout.togglePin("n11");
    await settle();
    expect(nested()).toHaveLength(10);
    expect(showMore()?.textContent?.trim()).toBe(Resources.formatShowMore(1));

    showMore()?.click();
    await settle();
    expect(nested()).toHaveLength(11);
    expect(showMore()).toBeNull();
  });

  it("orders pins, projects and a project's conversations as the person drops them", async () => {
    await create();
    layout.togglePin("c1");
    layout.togglePin("c3");
    await settle();

    const pins = element().querySelectorAll<HTMLElement>(".nol-teamrun-pins .nol-teamrun-drag-item");
    await dragAsync(itemAt(pins, 1), itemAt(pins, 0));
    await Wait.until(() => expect(pinned()).toEqual([other.title, SampleData.conversation.title]));

    await dragAsync(projectRow(SampleData.otherProject.name), projectRow(SampleData.project.name));
    await Wait.until(() => expect(projectNames()).toEqual([SampleData.otherProject.name, SampleData.project.name]));

    layout.togglePin("c1");
    await settle();
    await dragAsync(dragItemOf(conversationRow(SampleData.conversation.title)), dragItemOf(conversationRow(second.title)));
    await Wait.until(() => expect(nested()).toEqual([SampleData.conversation.title, second.title]));
    expect(context.count(MethodName.ConversationMove)).toBe(0);
    expect(layout.layout().conversationOrderOf("p1")).toEqual(["c1", "c2"]);
  });

  it("orders the chats without a project as the person drops them, keeps Show more's chats behind them, and saves the order under the group's own key", async () => {
    const many = Array.from({ length: Resources.projectConversationCount + 2 }, (_, i) =>
      scratchOf(`s${String(i)}`, `Note ${String(i)}`, new Date(Date.UTC(2026, 8, 1 + i)).toISOString()));
    conversations = [SampleData.conversation, ...many];
    await create();
    const newest = many.toReversed();
    const titles = newest.map(t => t.title);
    const ids = newest.map(t => t.id);

    await dragAsync(dragItemOf(conversationRow(itemAt(titles, 1))), dragItemOf(conversationRow(itemAt(titles, 0))));

    const moved = [itemAt(ids, 1), itemAt(ids, 0), ...ids.slice(2)];
    const movedTitles = [itemAt(titles, 1), itemAt(titles, 0), ...titles.slice(2)];
    await Wait.until(() => expect(chats()).toEqual(movedTitles.slice(0, Resources.projectConversationCount)));
    expect(layout.layout().conversationOrderOf(Resources.chatsOrderKey)).toEqual(moved);
    expect(layout.layout().conversationOrderOf("p1")).toEqual([]);
    expect(context.count(MethodName.ConversationMove)).toBe(0);
    expect(ProjectsLayoutSaveParams.fromJson(requestOf(MethodName.ProjectsLayoutSave)).layout[Resources.chatOrderField]).toEqual({ [Resources.chatsOrderKey]: moved });
    expect(texts(".nol-teamrun-chat-list .nol-teamrun-show-more")).toEqual([Resources.formatShowMore(2)]);

    find<HTMLElement>(".nol-teamrun-chat-list .nol-teamrun-show-more", Resources.formatShowMore(2)).click();
    await settle();

    expect(chats()).toEqual(movedTitles);
  });

  it("shows the chats in the order the layout kept, and in the order another window saves", async () => {
    const older = scratchOf("c6", "Older note", "2026-09-01T08:00:00.000Z");
    conversations = [SampleData.conversation, scratch, older];
    await create(t => t.answer(MethodName.ProjectsLayoutRead, () => ({ [Resources.chatOrderField]: { [Resources.chatsOrderKey]: [older.id, scratch.id] } })));

    expect(chats()).toEqual([older.title, scratch.title]);

    context.emit(EventName.ProjectsLayoutUpdated, { [Resources.chatOrderField]: { [Resources.chatsOrderKey]: [scratch.id, older.id] } });
    await settle();

    expect(chats()).toEqual([scratch.title, older.title]);
  });

  it("puts a new chat behind the ordered chats, as in a project, and a chat the order names no longer leaves no gap", async () => {
    const older = scratchOf("c6", "Older note", "2026-09-01T08:00:00.000Z");
    const created = scratchOf("c7", "New chat", "2026-09-14T08:00:00.000Z");
    conversations = [scratch, older];
    await create(t => t.answer(MethodName.ProjectList, () => []).answer(MethodName.ConversationCreate, () => created.toJson())
      .answer(MethodName.ProjectsLayoutRead, () => ({ [Resources.chatOrderField]: { [Resources.chatsOrderKey]: ["gone", older.id, scratch.id] } })));

    action(Resources.newConversationLabel).click();
    await Wait.until(() => expect(context.keptDocuments.map(u => u.instance)).toEqual([created.id]));
    await settle();

    expect(chats()).toEqual([older.title, scratch.title, created.title]);
  });

  it("drags a chat only within its own list, neither from the Chats group into a project nor from a project into the group", async () => {
    const older = scratchOf("c6", "Older note", "2026-09-01T08:00:00.000Z");
    conversations = [second, scratch, older];
    await create(t => t.answer(MethodName.ProjectList, () => [SampleData.listed(SampleData.project)]));
    const before = [nested(), chats()];

    await dragAsync(dragItemOf(conversationRow(scratch.title)), dragItemOf(conversationRow(second.title)));
    await dropFinished();
    expect([nested(), chats()]).toEqual(before);

    await dragAsync(dragItemOf(conversationRow(second.title)), dragItemOf(conversationRow(older.title)), 0.75);
    await dropFinished();
    expect([nested(), chats()]).toEqual(before);
    expect(context.count(MethodName.ConversationMove)).toBe(0);
  });

  it("saves no order for a chat or a project's conversation released where it started, so the list stays newest first", async () => {
    const older = scratchOf("c6", "Older note", "2026-09-01T08:00:00.000Z");
    conversations = [SampleData.conversation, second, scratch, older];
    await create();
    const saves = context.count(MethodName.ProjectsLayoutSave);

    for (const title of [scratch.title, second.title]) {
      const item = dragItemOf(conversationRow(title));
      const release = await holdDragAsync(item, item);
      expect(document.querySelector(".cdk-drag-preview")).not.toBeNull();
      await release();
      await dropFinished();
    }

    expect(layout.layout().conversationOrderOf(Resources.chatsOrderKey)).toEqual([]);
    expect(layout.layout().conversationOrderOf("p1")).toEqual([]);
    expect(context.count(MethodName.ProjectsLayoutSave)).toBe(saves);
  });

  it("saves no order for a pin or a project released where it started", async () => {
    await create();
    layout.togglePin("c1");
    layout.togglePin("c3");
    await settle();
    const saves = context.count(MethodName.ProjectsLayoutSave);
    const pins = element().querySelectorAll<HTMLElement>(".nol-teamrun-pins .nol-teamrun-drag-item");

    for (const handle of [itemAt(pins, 1), projectRow(SampleData.otherProject.name)]) {
      const release = await holdDragAsync(handle, handle);
      expect(document.querySelector(".cdk-drag-preview")).not.toBeNull();
      await release();
      await dropFinished();
    }

    expect(layout.layout().projectOrder).toEqual([]);
    expect(context.count(MethodName.ProjectsLayoutSave)).toBe(saves);
  });

  it("moves the held pin, not the one now at its old place, when a pin above it is deleted elsewhere during the drag", async () => {
    conversations = Array.from({ length: 4 }, (_, i) => scratchOf(`s${String(i)}`, `Note ${String(i)}`, new Date(Date.UTC(2026, 8, 1 + i)).toISOString()));
    await create();
    for (const conversation of conversations)
      layout.togglePin(conversation.id);
    await settle();
    const titles = pinned();
    const idOf = (title: string): string => Required.of(conversations.find(t => t.title === title)).id;
    const pins = element().querySelectorAll<HTMLElement>(".nol-teamrun-pins .nol-teamrun-drag-item");
    const release = await holdDragAsync(itemAt(pins, 2), itemAt(pins, 0));

    context.emit(EventName.ConversationDeleted, new ConversationIdParams(idOf(itemAt(titles, 0))).toJson());
    await settle();
    await release();
    await dropFinished();

    const kept = [itemAt(titles, 2), itemAt(titles, 1), itemAt(titles, 3)];
    await Wait.until(() => expect(pinned()).toEqual(kept));
    expect(layout.layout().pinnedConversations.slice(0, kept.length)).toEqual(kept.map(idOf));
  });

  it("moves the held project, not the one now at its old place, when another window shifts the projects during the drag", async () => {
    const site = new Project("p3", "site", "D:/site", SampleData.timestamp);
    await create(t => t.answer(MethodName.ProjectList, () => [SampleData.listed(SampleData.project), SampleData.listed(SampleData.otherProject), SampleData.listed(site)])
      .answer(MethodName.ProjectsLayoutRead, () => ({ [Resources.projectOrderField]: ["p1", "p2", "p3"] })));
    expect(projectNames()).toEqual([SampleData.project.name, SampleData.otherProject.name, site.name]);
    const release = await holdDragAsync(projectRow(site.name), projectRow(SampleData.project.name));

    context.emit(EventName.ProjectsLayoutUpdated, { [Resources.projectOrderField]: ["p2", "p3", "p1"] });
    await settle();
    await release();
    await dropFinished();

    await Wait.until(() => expect(layout.layout().projectOrder).toEqual(["p3", "p2", "p1"]));
    await Wait.until(() => expect(projectNames()).toEqual([site.name, SampleData.otherProject.name, SampleData.project.name]));
  });

  describe("a chat deleted elsewhere above a chat held in a drag", () => {
    const dropThirdOnFirstAsDeletedAsync = async (rows: () => string[], orderKey: string): Promise<void> => {
      const titles = rows();
      const idOf = (title: string): string => Required.of(conversations.find(t => t.title === title)).id;
      const third = itemAt(titles, 2);
      const release = await holdDragAsync(dragItemOf(conversationRow(third)), dragItemOf(conversationRow(itemAt(titles, 0))));

      context.emit(EventName.ConversationDeleted, new ConversationIdParams(idOf(itemAt(titles, 0))).toJson());
      await settle();
      await release();
      await dropFinished();

      const kept = [third, itemAt(titles, 1), ...titles.slice(3)];
      await Wait.until(() => expect(rows()).toEqual(kept));
      expect(layout.layout().conversationOrderOf(orderKey)).toEqual(kept.map(idOf));
    };

    it("moves the held chat in the Chats group, not the one now at its old place", async () => {
      conversations = Array.from({ length: 4 }, (_, i) => scratchOf(`s${String(i)}`, `Note ${String(i)}`, new Date(Date.UTC(2026, 8, 1 + i)).toISOString()));
      await create();

      await dropThirdOnFirstAsDeletedAsync(chats, Resources.chatsOrderKey);
    });

    it("moves the held conversation in a project, not the one now at its old place", async () => {
      conversations = Array.from({ length: 4 }, (_, i) => {
        const at = new Date(Date.UTC(2026, 8, 1 + i)).toISOString();
        return new Conversation(`n${String(i)}`, "p1", `Nested ${String(i)}`, at, at);
      });
      await create();

      await dropThirdOnFirstAsDeletedAsync(nested, "p1");
    });
  });

  describe("a row above the held one leaving the list during a drag", () => {
    const noteIdOf = (title: string): string => Required.of(conversations.find(t => t.title === title)).id;
    const deleteNoteAsync = async (title: string): Promise<void> => {
      context.emit(EventName.ConversationDeleted, new ConversationIdParams(noteIdOf(title)).toJson());
      await settle();
    };
    const notes = (): Conversation[] => Array.from({ length: 4 }, (_, i) => scratchOf(`s${String(i)}`, `Note ${String(i)}`, new Date(Date.UTC(2026, 8, 1 + i)).toISOString()));
    const startWithChatsAsync = async (): Promise<void> => {
      conversations = notes();
      await create();
    };
    const conversationItem = (title: string): Element => dragItemOf(conversationRow(title));
    const projects = [SampleData.project, SampleData.otherProject, new Project("p3", "site", "D:/site", SampleData.timestamp), new Project("p4", "tools", "D:/tools", SampleData.timestamp)];
    const projectIdOf = (name: string): string => Required.of(projects.find(t => t.name === name)).id;
    const cases = [
      {
        name: "a pin",
        startAsync: async (): Promise<void> => {
          await startWithChatsAsync();
          for (const conversation of conversations)
            layout.togglePin(conversation.id);
          await settle();
        },
        rows: pinned,
        itemOf: (title: string): Element => find<HTMLElement>(".nol-teamrun-pins .nol-teamrun-drag-item", title),
        leaveAsync: deleteNoteAsync,
        idOf: noteIdOf,
        order: (): readonly string[] => layout.layout().pinnedConversations
      },
      {
        name: "a project",
        startAsync: (): Promise<void> => create(t => t.answer(MethodName.ProjectList, () => projects.map(u => SampleData.listed(u)))
          .answer(MethodName.ProjectsLayoutRead, () => ({ [Resources.projectOrderField]: projects.map(u => u.id) }))
          .answer(MethodName.ProjectForget, () => null)),
        rows: projectNames,
        itemOf: projectRow,
        leaveAsync: async (name: string): Promise<void> => {
          await store.forgetProject(projectIdOf(name));
          await settle();
        },
        idOf: projectIdOf,
        order: (): readonly string[] => layout.layout().projectOrder
      },
      {
        name: "a chat",
        startAsync: startWithChatsAsync,
        rows: chats,
        itemOf: conversationItem,
        leaveAsync: deleteNoteAsync,
        idOf: noteIdOf,
        order: (): readonly string[] => layout.layout().conversationOrderOf(Resources.chatsOrderKey)
      },
      {
        name: "a project's conversation",
        startAsync: async (): Promise<void> => {
          conversations = Array.from({ length: 4 }, (_, i) => {
            const at = new Date(Date.UTC(2026, 8, 1 + i)).toISOString();
            return new Conversation(`n${String(i)}`, "p1", `Nested ${String(i)}`, at, at);
          });
          await create();
        },
        rows: nested,
        itemOf: conversationItem,
        leaveAsync: deleteNoteAsync,
        idOf: noteIdOf,
        order: (): readonly string[] => layout.layout().conversationOrderOf("p1")
      }
    ];

    for (const { name, startAsync, rows, itemOf, leaveAsync, idOf, order } of cases) {
      it(`saves ${name} dropped at the number it started at, which is a new place among the rows left`, async () => {
        await startAsync();
        const titles = rows();
        const held = itemAt(titles, 2);
        const below = itemAt(titles, 3);
        await holdDragAsync(itemOf(held), itemOf(held));

        await leaveAsync(itemAt(titles, 0));
        const release = await moveHeldAsync(pointAt(itemOf(held), 0.5), pointAt(itemOf(below), 0.75));
        await release();
        await dropFinished();

        const moved = [itemAt(titles, 1), below, held];
        await Wait.until(() => expect(rows()).toEqual(moved));
        expect(order().slice(0, moved.length)).toEqual(moved.map(idOf));
      });

      it(`saves no order for ${name} held in place, though its number changed`, async () => {
        await startAsync();
        const titles = rows();
        const held = itemAt(titles, 2);
        const release = await holdDragAsync(itemOf(held), itemOf(held));

        await leaveAsync(itemAt(titles, 0));
        const saves = context.count(MethodName.ProjectsLayoutSave);
        const kept = [...order()];
        await release();
        await dropFinished();
        await settle();

        expect(context.count(MethodName.ProjectsLayoutSave)).toBe(saves);
        expect(order()).toEqual(kept);
        expect(rows()).toEqual(titles.slice(1));
      });
    }
  });

  it("moves a conversation into the project it is dropped on, at the place it is dropped", async () => {
    await create(t => t.answer(MethodName.ConversationMove, u => new Conversation("c2", ConversationMoveParams.fromJson(u).projectId, second.title, second.createdAt, second.updatedAt).toJson()));

    await dragAsync(dragItemOf(conversationRow(second.title)), dragItemOf(conversationRow(other.title)), 0.75);

    await Wait.until(() => expect(context.count(MethodName.ConversationMove)).toBe(1));
    expect(ConversationMoveParams.fromJson(requestOf(MethodName.ConversationMove))).toEqual(new ConversationMoveParams("c2", "p2"));
    expect(layout.layout().conversationOrderOf("p2")).toEqual(["c3", "c2"]);
    expect(layout.layout().conversationOrderOf("p1")).toEqual(["c1"]);
    await Wait.until(() => expect(nested()).toEqual([SampleData.conversation.title, other.title, second.title]));
  });

  it("leaves the conversation and both projects' order as they were when the move is refused", async () => {
    await create(t => t.fail(MethodName.ConversationMove, "Move refused."));
    const before = [layout.layout().conversationOrderOf("p1"), layout.layout().conversationOrderOf("p2")];

    await dragAsync(dragItemOf(conversationRow(second.title)), dragItemOf(conversationRow(other.title)));

    await Wait.until(() => expect(context.noticeText()).toBe("Move refused."));
    expect([layout.layout().conversationOrderOf("p1"), layout.layout().conversationOrderOf("p2")]).toEqual(before);
    expect(nested()).toEqual([second.title, SampleData.conversation.title, other.title]);
  });

  it("posts why each action failed as a notice of its action, with no banner in the view", async () => {
    await create(t => t
      .fail(MethodName.ConversationCreate, "Create refused.")
      .fail(MethodName.ConversationRename, "Rename refused.")
      .fail(MethodName.ConversationDelete, "Delete refused.")
      .fail(MethodName.ProjectForget, "Forget refused.")
      .fail(MethodName.ProjectOpen, "Open refused."));
    action(Resources.newConversationLabel).click();
    await Wait.until(() => expect(context.noticeText()).toBe("Create refused."));
    expect(context.openedDocuments).toEqual([]);

    await choose(conversationRow(second.title), Resources.renameConversationLabel);
    await answerDialog("nol-teamrun-rename-dialog .nol-teamrun-save");
    await Wait.until(() => expect(context.noticeText()).toBe("Rename refused."));

    await choose(conversationRow(second.title), Resources.deleteConversationLabel);
    await answerDialog("nol-teamrun-confirm-dialog .nol-teamrun-confirm");
    await Wait.until(() => expect(context.noticeText()).toBe("Delete refused."));
    expect(nested()).toContain(second.title);

    await choose(projectRow(SampleData.otherProject.name), Resources.forgetProjectLabel);
    await answerDialog("nol-teamrun-confirm-dialog .nol-teamrun-confirm");
    await Wait.until(() => expect(context.noticeText()).toBe("Forget refused."));
    expect(projectNames()).toEqual([SampleData.project.name, SampleData.otherProject.name]);

    context.chosenFolder = "D:/site";
    action(Resources.openProjectLabel).click();
    await Wait.until(() => expect(context.noticeText()).toBe("Open refused."));
    expect(projectNames()).toEqual([SampleData.project.name, SampleData.otherProject.name]);
    expect(context.shownNotices(Resources.chatActionFailedNotice).map(t => t.title)).toEqual([ChatAction.StartChat, ChatAction.RenameChat, ChatAction.DeleteChat,
      ChatAction.ForgetProject, ChatAction.OpenProject].map(t => Resources.chatActionTitles[t]));
    expect(element().querySelector(".nol-teamrun-error")).toBeNull();
  });

  describe("as a tree", () => {
    const fourth = new Conversation("c4", "p2", "Fourth", "2026-09-10T08:00:00.000Z", "2026-09-10T08:00:00.000Z");
    const talks = (count: number): Conversation[] => Array.from({ length: count }, (_, i) => {
      const at = `2026-09-11T${String(i).padStart(2, "0")}:00:00.000Z`;
      return new Conversation(`n${String(i)}`, "p1", `Talk ${String.fromCharCode(65 + i)}`, at, at);
    });
    const treeOf = (label: string): HTMLElement => part(element(), `[role='tree'][aria-label='${label}']`);
    const items = (tree: HTMLElement): HTMLElement[] => [...tree.querySelectorAll<HTMLElement>("[role='treeitem']")];
    const stops = (tree: HTMLElement): HTMLElement[] => items(tree).filter(t => t.tabIndex === 0);
    const press = async (key: string, init: KeyboardEventInit = {}, target: Element | null = document.activeElement): Promise<void> => {
      target?.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true, ...init }));
      await settle();
    };
    const focusOn = async (row: HTMLElement): Promise<void> => {
      row.focus();
      await settle();
    };
    const move: KeyboardEventInit = { ctrlKey: true, shiftKey: true };
    const run = async (name: string): Promise<boolean> => {
      const command = TeamRunCommands.of(context).find(t => t.name === name);
      const isEnabled = command?.isEnabled(null) === true;
      await command?.runAsync(null);
      await settle();
      return isEnabled;
    };
    const up = (): Promise<boolean> => run(Resources.moveRowUpCommand);
    const down = (): Promise<boolean> => run(Resources.moveRowDownCommand);
    const said = (announce: { mock: { calls: unknown[][] } }): unknown[] => announce.mock.calls.map(t => t[0]);

    it("makes Pinned, Projects and Chats named trees with one Tab stop each, on the shown chat, else on the first row", async () => {
      conversations = [SampleData.conversation, second, other, scratch];
      await create();
      layout.togglePin("c3");
      await settle();
      const first = stops(treeOf(Resources.projectsViewTitle));
      await store.conversationInView("c2");
      await settle();
      const projects = treeOf(Resources.projectsViewTitle);

      expect(first).toEqual([projectRow(SampleData.project.name)]);
      expect([stops(treeOf(Resources.pinnedTitle)), stops(projects), stops(treeOf(Resources.chatsTitle))])
        .toEqual([[conversationRow(other.title)], [conversationRow(second.title)], [conversationRow(scratch.title)]]);
      expect(items(projects)).toEqual([projectRow(SampleData.project.name), conversationRow(second.title), conversationRow(SampleData.conversation.title),
        projectRow(SampleData.otherProject.name)]);
      expect(items(projects).map(t => [t.getAttribute("aria-level"), t.getAttribute("aria-expanded")])).toEqual([["1", "true"], ["2", null], ["2", null], ["1", "true"]]);
      expect(part(projects, "[role='group']").id).toBe(`${Resources.conversationListIdPrefix}p1`);
      expect([...element().querySelectorAll(".nol-teamrun-drag-item")].every(t => t.getAttribute("role") === "none")).toBe(true);
      expect([...element().querySelectorAll(".nol-teamrun-row-actions")].map(t => [t.getAttribute("tabindex"), t.getAttribute("aria-hidden")]))
        .toEqual(Array.from({ length: 6 }, () => ["-1", "true"]));
    });

    it.each([
      { platform: "MacIntel", shortcuts: "Meta+Shift+ArrowUp Meta+Shift+ArrowDown" },
      { platform: "Win32", shortcuts: "Control+Shift+ArrowUp Control+Shift+ArrowDown" },
      { platform: "Linux x86_64", shortcuts: "Control+Shift+ArrowUp Control+Shift+ArrowDown" }
    ])("names the move keys on $platform as $shortcuts on the rows that move, and F2 on the chats a person can rename", async ({ platform, shortcuts }) => {
      vi.spyOn(navigator, "platform", "get").mockReturnValue(platform);
      conversations = [SampleData.conversation, second, other, scratch];
      await create();
      layout.togglePin("c3");
      await settle();

      expect([projectRow(SampleData.project.name), conversationRow(second.title), conversationRow(other.title), conversationRow(scratch.title)]
        .map(t => t.getAttribute("aria-keyshortcuts"))).toEqual([shortcuts, `${shortcuts} F2`, `${shortcuts} F2`, `${shortcuts} F2`]);
      expect([Resources.moveRowUpKey, Resources.moveRowDownKey]).toEqual(["Mod+Shift+ArrowUp", "Mod+Shift+ArrowDown"]);
    });

    it("moves the focus with the arrow keys, Home and End, opens and closes a project with Right and Left, and keeps the Tab stop on the row focused last", async () => {
      await create();
      const first = projectRow(SampleData.project.name);
      await focusOn(first);
      const projects = treeOf(Resources.projectsViewTitle);

      await press("ArrowDown");
      expect(document.activeElement).toBe(conversationRow(second.title));
      expect(stops(projects)).toEqual([conversationRow(second.title)]);
      await press("ArrowRight");
      expect(document.activeElement).toBe(conversationRow(second.title));
      await press("ArrowLeft");
      expect(document.activeElement).toBe(first);
      await press("ArrowLeft");
      expect([first.getAttribute("aria-expanded"), nested()]).toEqual(["false", [other.title]]);
      await press("ArrowLeft");
      expect(document.activeElement).toBe(first);
      await press("ArrowRight");
      expect(first.getAttribute("aria-expanded")).toBe("true");
      await press("ArrowRight");
      expect(document.activeElement).toBe(conversationRow(second.title));
      await press("End");
      expect(document.activeElement).toBe(conversationRow(other.title));
      await press("Home");
      expect(document.activeElement).toBe(first);
      action(Resources.newConversationLabel).focus();
      await settle();
      expect(stops(projects)).toEqual([first]);
    });

    it("moves the focus to the next row whose name starts with the letter typed", async () => {
      await create();
      await focusOn(projectRow(SampleData.project.name));

      await press("o");
      await Wait.until(() => expect(document.activeElement).toBe(projectRow(SampleData.otherProject.name)));
      await press("f");
      await Wait.until(() => expect(document.activeElement).toBe(conversationRow(SampleData.conversation.title)));
    });

    it("opens a chat with Enter or Space, opens or closes a project with them, and moves the focus from Show more to the first chat it shows", async () => {
      conversations = [...talks(Resources.projectConversationCount + 1), other];
      await create();
      const newest = nested();

      await focusOn(conversationRow(itemAt(newest, 0)));
      await press("Enter");
      await focusOn(conversationRow(itemAt(newest, 1)));
      await press(" ");
      expect(context.openedDocuments.map(t => t.instance)).toEqual(["n10", "n9"]);
      await focusOn(projectRow(SampleData.otherProject.name));
      await press("Enter");
      expect(projectRow(SampleData.otherProject.name).getAttribute("aria-expanded")).toBe("false");
      await press(" ");
      expect(projectRow(SampleData.otherProject.name).getAttribute("aria-expanded")).toBe("true");
      await focusOn(part(element(), ".nol-teamrun-show-more"));
      await press("Enter");

      expect(nested()).toHaveLength(Resources.projectConversationCount + 2);
      expect(document.activeElement).toBe(conversationRow("Talk A"));
    });

    it("lists an empty project's No chats row as its child, which does nothing", async () => {
      conversations = [SampleData.conversation, second];
      await create();
      const empty = find<HTMLElement>(".nol-teamrun-conversation-list .nol-teamrun-muted", Resources.noConversations);
      await focusOn(projectRow(SampleData.otherProject.name));

      await press("ArrowRight");
      expect([document.activeElement, empty.getAttribute("role"), empty.getAttribute("aria-level"), empty.getAttribute("aria-disabled"), getComputedStyle(empty).cursor])
        .toEqual([empty, "treeitem", "2", "true", "auto"]);
      await press("Enter");
      expect(document.activeElement).toBe(empty);
    });

    it("shows the pointer on the parts that were buttons, the twistie, name, title, Show more and More, and the arrow on the rows' padding and No chats", async () => {
      conversations = talks(Resources.projectConversationCount + 1);
      await create();
      const project = projectRow(SampleData.project.name);
      const chat = conversationRow(itemAt(nested(), 0));
      const empty = find<HTMLElement>(".nol-teamrun-conversation-list .nol-teamrun-muted", Resources.noConversations);

      expect([part(project, ".nol-teamrun-twistie"), part(project, ".nol-teamrun-project-name"), part(chat, ".nol-teamrun-conversation-title"),
        part(element(), ".nol-teamrun-show-more"), part(chat, ".nol-teamrun-row-actions"), project, chat, empty].map(t => getComputedStyle(t).cursor))
        .toEqual(["pointer", "pointer", "pointer", "pointer", "pointer", "auto", "auto", "auto"]);
    });

    it("renames a chat with F2, and leaves F2 with Shift, or on a project, alone", async () => {
      await create();
      await focusOn(projectRow(SampleData.project.name));
      await press("F2");
      await focusOn(conversationRow(second.title));
      await press("F2", { shiftKey: true });
      expect(document.querySelector("nol-teamrun-rename-dialog")).toBeNull();

      await press("F2");
      expect(document.querySelector<HTMLInputElement>("nol-teamrun-rename-dialog .nol-teamrun-rename-title")?.value).toBe(second.title);
      await answerDialog("nol-teamrun-rename-dialog .nol-teamrun-cancel");
      await Wait.until(() => expect(document.activeElement).toBe(conversationRow(second.title)));
    });

    it("keeps the focus on an older chat it renames with F2 as the rename takes it to the top of Chats", async () => {
      const older = scratchOf("c6", "Older note", "2026-09-01T08:00:00.000Z");
      conversations = [scratch, older];
      await create(t => t.answer(MethodName.ConversationRename, u => scratchOf("c6", ConversationRenameParams.fromJson(u).title, "2026-09-14T08:00:00.000Z").toJson()));
      await focusOn(conversationRow(older.title));

      await press("F2");
      const field = document.querySelector<HTMLInputElement>("nol-teamrun-rename-dialog .nol-teamrun-rename-title");
      if (Object.isNull(field))
        throw new Error("The rename dialog shows no title field.");
      field.value = "Newest note";
      field.dispatchEvent(new Event("input"));
      await settle();
      await answerDialog("nol-teamrun-rename-dialog .nol-teamrun-save");

      await Wait.until(() => expect(chats()).toEqual(["Newest note", scratch.title]));
      await Wait.until(() => expect(document.activeElement).toBe(conversationRow("Newest note")));
    });

    it("gives the focus back to an older chat it renames from the row's menu as the rename takes it to the top of Chats", async () => {
      const older = scratchOf("c6", "Older note", "2026-09-01T08:00:00.000Z");
      conversations = [scratch, older];
      await create(t => t.answer(MethodName.ConversationRename, u => scratchOf("c6", ConversationRenameParams.fromJson(u).title, "2026-09-14T08:00:00.000Z").toJson()));
      await focusOn(conversationRow(older.title));

      await press("F10", { shiftKey: true });
      await userEvent.keyboard("{ArrowDown}");
      expect(document.activeElement).toBe(find<HTMLButtonElement>("button[nol-menu-item]", Resources.renameConversationLabel, document));
      await userEvent.keyboard("{Enter}");
      await settle();
      const field = document.querySelector<HTMLInputElement>("nol-teamrun-rename-dialog .nol-teamrun-rename-title");
      if (Object.isNull(field))
        throw new Error("The rename dialog shows no title field.");
      field.value = "Newest note";
      field.dispatchEvent(new Event("input"));
      await settle();
      await answerDialog("nol-teamrun-rename-dialog .nol-teamrun-save");

      await Wait.until(() => expect(chats()).toEqual(["Newest note", scratch.title]));
      await Wait.until(() => expect(document.activeElement).toBe(conversationRow("Newest note")));
    });

    it("leaves the focus where the person moved it while a rename is answered", async () => {
      const older = scratchOf("c6", "Older note", "2026-09-01T08:00:00.000Z");
      let release: () => void = () => undefined;
      conversations = [scratch, older];
      await create(t => t.answer(MethodName.ConversationRename, u => new Promise<JsonValue>(resolve => {
        release = () => resolve(scratchOf("c6", ConversationRenameParams.fromJson(u).title, "2026-09-14T08:00:00.000Z").toJson());
      })));
      await focusOn(conversationRow(older.title));
      await press("F2");
      const field = document.querySelector<HTMLInputElement>("nol-teamrun-rename-dialog .nol-teamrun-rename-title");
      if (Object.isNull(field))
        throw new Error("The rename dialog shows no title field.");
      field.value = "Newest note";
      field.dispatchEvent(new Event("input"));
      await settle();
      await answerDialog("nol-teamrun-rename-dialog .nol-teamrun-save");
      await focusOn(conversationRow(scratch.title));

      release();
      await Wait.until(() => expect(chats()).toEqual(["Newest note", scratch.title]));
      await settle();

      expect(document.activeElement).toBe(conversationRow(scratch.title));
    });

    it("leaves the focus on the page when the person moved it there while a rename is answered", async () => {
      const older = scratchOf("c6", "Older note", "2026-09-01T08:00:00.000Z");
      let release: () => void = () => undefined;
      conversations = [scratch, older];
      await create(t => t.answer(MethodName.ConversationRename, u => new Promise<JsonValue>(resolve => {
        release = () => resolve(scratchOf("c6", ConversationRenameParams.fromJson(u).title, "2026-09-14T08:00:00.000Z").toJson());
      })));
      await focusOn(conversationRow(older.title));
      await press("F2");
      const field = document.querySelector<HTMLInputElement>("nol-teamrun-rename-dialog .nol-teamrun-rename-title");
      if (Object.isNull(field))
        throw new Error("The rename dialog shows no title field.");
      field.value = "Newest note";
      field.dispatchEvent(new Event("input"));
      await settle();
      await answerDialog("nol-teamrun-rename-dialog .nol-teamrun-save");
      expect(document.activeElement).toBe(conversationRow(older.title));
      conversationRow(older.title).blur();

      release();
      await Wait.until(() => expect(chats()).toEqual(["Newest note", scratch.title]));
      await settle();

      expect(document.activeElement).toBe(document.body);
    });

    it("opens a row's menu from the context-menu key and Shift+F10 on its first item, and Escape gives the focus back to the row, not to the More button inside it", async () => {
      await create();
      const menuItems = (): HTMLButtonElement[] => [...document.querySelectorAll<HTMLButtonElement>("button[nol-menu-item]")];
      await focusOn(conversationRow(second.title));

      await press("ContextMenu");
      expect([menuItems().length, document.activeElement]).toEqual([4, find<HTMLButtonElement>("button[nol-menu-item]", Resources.pinLabel, document)]);
      await userEvent.keyboard("{Escape}");
      await Wait.until(() => expect(document.activeElement).toBe(conversationRow(second.title)));
      await focusOn(projectRow(SampleData.project.name));
      await press("F10", { shiftKey: true });
      expect([menuItems().length, document.activeElement]).toEqual([2, find<HTMLButtonElement>("button[nol-menu-item]", Resources.newConversationLabel, document)]);
      await userEvent.keyboard("{Escape}");
      await Wait.until(() => expect(document.activeElement).toBe(projectRow(SampleData.project.name)));
    });

    it("opens a row's menu from a right click, and Escape gives the focus back to the row, not to the More button inside it", async () => {
      await create();
      const menus = (): HTMLElement[] => [...document.querySelectorAll<HTMLElement>("[role='menu']")];
      const row = conversationRow(second.title);
      try {
        await userEvent.click(row, { button: "right" });
        await Wait.until(() => expect([menus().length, menus()[0]?.contains(document.activeElement)]).toEqual([1, true]));
        await userEvent.keyboard("{Escape}");

        await Wait.until(() => expect([menus().length, document.activeElement]).toEqual([0, row]));
      } finally {
        await userEvent.unhover(row);
      }
    });

    it("opens a row's menu from a right click while its More menu is open, closing that one, and Escape gives the focus back to the row, not to the More button", async () => {
      await create();
      const menus = (): HTMLElement[] => [...document.querySelectorAll<HTMLElement>("[role='menu']")];
      const row = conversationRow(second.title);
      const more = part(row, ".nol-teamrun-row-actions");
      try {
        await userEvent.click(more);
        await Wait.until(() => expect([menus().length, more.getAttribute("aria-expanded")]).toEqual([1, "true"]));

        await userEvent.click(row, { button: "right" });
        await Wait.until(() => expect([menus().length, more.getAttribute("aria-expanded"), menus()[0]?.contains(document.activeElement)]).toEqual([1, "false", true]));
        await userEvent.keyboard("{Escape}");

        await Wait.until(() => expect([menus().length, document.activeElement]).toEqual([0, row]));
      } finally {
        await userEvent.unhover(row);
      }
    });

    it("moves a pin, a project and a project's chat among their own rows with Move row up and down, keeping the focus on it and saying where it went", async () => {
      conversations = [SampleData.conversation, second, other, fourth];
      await create();
      layout.togglePin("c3");
      layout.togglePin("c4");
      await settle();
      const announce = vi.spyOn(TestBed.inject(Announcer), "announce");

      await focusOn(conversationRow(other.title));
      expect(await down()).toBe(true);
      expect([pinned(), document.activeElement]).toEqual([[fourth.title, other.title], conversationRow(other.title)]);
      await focusOn(projectRow(SampleData.otherProject.name));
      expect(await up()).toBe(true);
      expect([projectNames(), document.activeElement]).toEqual([[SampleData.otherProject.name, SampleData.project.name], projectRow(SampleData.otherProject.name)]);
      await focusOn(conversationRow(SampleData.conversation.title));
      expect(await up()).toBe(true);
      expect([nested(), document.activeElement]).toEqual([[SampleData.conversation.title, second.title], conversationRow(SampleData.conversation.title)]);

      expect([layout.layout().conversationOrderOf("p1"), context.count(MethodName.ConversationMove)]).toEqual([["c1", "c2"], 0]);
      expect(announce.mock.calls).toEqual([other.title, SampleData.otherProject.name, SampleData.conversation.title].map((t, i) =>
        [Resources.formatRowMoved(t, itemAt([2, 1, 1], i), 2), AnnouncementPoliteness.Polite, { group: Resources.treeMoveGroup }]));
    });

    it("refuses a move past a list's first or last row, under Chats too, saying why", async () => {
      conversations = [SampleData.conversation, second, other, scratch, scratchOf("c6", "Older note", "2026-09-01T08:00:00.000Z")];
      await create();
      const announce = vi.spyOn(TestBed.inject(Announcer), "announce");

      await focusOn(conversationRow(second.title));
      await up();
      await focusOn(conversationRow(SampleData.conversation.title));
      await down();
      await focusOn(conversationRow(scratch.title));
      await up();
      await focusOn(conversationRow("Older note"));
      await down();

      expect([nested(), chats(), document.activeElement]).toEqual([[second.title, SampleData.conversation.title, other.title], [scratch.title, "Older note"],
        conversationRow("Older note")]);
      expect(said(announce)).toEqual([Resources.formatRowMoveRefused(second.title, true), Resources.formatRowMoveRefused(SampleData.conversation.title, false),
        Resources.formatRowMoveRefused(scratch.title, true), Resources.formatRowMoveRefused("Older note", false)]);
    });

    it("moves a chat among the Chats group's rows with Move row up and down, keeping the focus on it and saying where it went", async () => {
      const older = scratchOf("c6", "Older note", "2026-09-01T08:00:00.000Z");
      conversations = [SampleData.conversation, scratch, older];
      await create();
      const announce = vi.spyOn(TestBed.inject(Announcer), "announce");

      await focusOn(conversationRow(scratch.title));
      expect(await down()).toBe(true);

      expect([chats(), document.activeElement]).toEqual([[older.title, scratch.title], conversationRow(scratch.title)]);
      expect([layout.layout().conversationOrderOf(Resources.chatsOrderKey), context.count(MethodName.ConversationMove)]).toEqual([[older.id, scratch.id], 0]);
      expect(said(announce)).toEqual([Resources.formatRowMoved(scratch.title, 2, 2)]);
    });

    it("shows the rest of the chats when a move takes the group's last shown chat below Show more", async () => {
      const many = Array.from({ length: Resources.projectConversationCount + 2 }, (_, i) =>
        scratchOf(`s${String(i)}`, `Note ${String(i)}`, new Date(Date.UTC(2026, 8, 1 + i)).toISOString()));
      conversations = [SampleData.conversation, ...many];
      await create();
      const last = itemAt(chats(), Resources.projectConversationCount - 1);

      await focusOn(conversationRow(last));
      await down();

      expect(chats()).toHaveLength(Resources.projectConversationCount + 2);
      expect([chats()[Resources.projectConversationCount], document.activeElement]).toEqual([last, conversationRow(last)]);
      expect(element().querySelector(".nol-teamrun-chat-list .nol-teamrun-show-more")).toBeNull();
    });

    it("shows the rest of a project's chats when a move takes its last shown chat below Show more", async () => {
      conversations = talks(Resources.projectConversationCount + 2);
      await create();
      const last = itemAt(nested(), Resources.projectConversationCount - 1);

      await focusOn(conversationRow(last));
      await down();

      expect(nested()).toHaveLength(Resources.projectConversationCount + 2);
      expect([nested()[Resources.projectConversationCount], document.activeElement]).toEqual([last, conversationRow(last)]);
      expect(element().querySelector(".nol-teamrun-show-more")).toBeNull();
    });

    it("leaves chords to the window's commands, and keys pressed on a row's More button, to the page", async () => {
      await create();
      const announce = vi.spyOn(TestBed.inject(Announcer), "announce");
      const row = conversationRow(second.title);
      await focusOn(row);

      for (const init of [move, { ...move, altKey: true }, { ...move, metaKey: true }, { ctrlKey: true }, { altKey: true }])
        await press("ArrowDown", init);
      await press("ArrowLeft", move);
      expect(document.activeElement).toBe(row);
      const more = part(row, ".nol-teamrun-row-actions");
      await focusOn(more);
      await press("ArrowDown");

      expect([document.activeElement, nested(), announce.mock.calls]).toEqual([more, [second.title, SampleData.conversation.title, other.title], []]);
    });

    it("enables Move row up and down only while a project or chat row has the focus, not on Show more or No chats, and no longer once the view is gone", async () => {
      conversations = talks(Resources.projectConversationCount + 1);
      await create();
      const announce = vi.spyOn(TestBed.inject(Announcer), "announce");
      const row = conversationRow(itemAt(nested(), 0));
      const targets = CommandTargetsService.of(context);

      expect([await up(), await down()]).toEqual([false, false]);
      await focusOn(part(row, ".nol-teamrun-row-actions"));
      expect(await down()).toBe(false);
      await focusOn(part(element(), ".nol-teamrun-show-more"));
      expect(await down()).toBe(false);
      await focusOn(find<HTMLElement>(".nol-teamrun-conversation-list .nol-teamrun-muted", Resources.noConversations));
      expect(await up()).toBe(false);
      await focusOn(row);
      expect(targets.canMoveRow()).toBe(true);
      fixture.destroy();

      expect([targets.canMoveRow(), announce.mock.calls]).toEqual([false, []]);
    });
  });

  describe.each([
    { look: "the fixture theme", mode: ThemeMode.Light, forcedColors: "none" },
    { look: "dark", mode: ThemeMode.Dark, forcedColors: "none" },
    { look: "forced colors", mode: ThemeMode.Light, forcedColors: "active" }
  ])("in $look", ({ mode, forcedColors }) => {
    const space = (step: number): number => AppearanceFixture.measureLook(`space-${step}`);
    const headerSpace = (): number => AppearanceFixture.measureLook("section-header-space-above");
    const box = (target: Element): DOMRect => target.getBoundingClientRect();
    const closeInset = (): number => AppearanceFixture.measureLook("pill-padding") + (AppearanceFixture.measureLook("icon") - AppearanceFixture.measureLook("tab-action-slot")) / 2;

    beforeAll(() => EmulatedMediaFixture.emulateAsync("forced-colors", forcedColors));

    beforeEach(() => AppearanceFixture.apply(FixtureTheme.theme, mode));

    afterEach(() => AppearanceFixture.reset());

    afterAll(() => EmulatedMediaFixture.resetAsync());

    it("centres a teammate's status dot in the twistie's column and starts its name where a department's name starts", async () => {
      await createOrganization();
      const centre = (target: Element): number => (box(target).left + box(target).right) / 2;
      const department = organizationRow("Marketing");
      const teammate = teammateRow("Grok");

      AppearanceFixture.expectPixels(box(part(teammate, ".nol-teamrun-teammate-name")).left, box(part(department, ".nol-teamrun-organization-name")).left);
      AppearanceFixture.expectPixels(centre(part(teammate, "nol-teamrun-teammate-status .dot")), centre(part(department, ".nol-teamrun-twistie")));
      AppearanceFixture.expectPixels(box(part(teammate, ".nol-teamrun-twistie")).width, box(part(department, ".nol-teamrun-twistie")).width);
    });

    it("puts a missing folder's glyph after the project's name, within the row's inset, keeps the row's height and mutes only that name", async () => {
      await create(withMissingFolder);
      const missing = projectRow(SampleData.otherProject.name);
      const present = projectRow(SampleData.project.name);
      const glyph = part(missing, ".nol-teamrun-folder-missing");

      expect(matchMedia("(forced-colors: active)").matches).toBe(forcedColors === "active");
      AppearanceFixture.expectPixels(box(missing).height, box(present).height);
      AppearanceFixture.expectPixels(box(missing).height, AppearanceFixture.measureLook("tree-row-height"));
      AppearanceFixture.expectPixels(box(glyph).left - box(part(missing, ".nol-teamrun-project-name")).right, space(1));
      expect(box(glyph).right).toBeLessThanOrEqual(box(part(missing, ".nol-teamrun-row-actions")).left);
      AppearanceFixture.expectPixels(box(glyph).top + box(glyph).height / 2, box(missing).top + box(missing).height / 2);
      if (forcedColors === "none") {
        const muted = AppearanceFixture.readColor(FixtureTheme.theme, mode, "text-muted");
        expect([missing, present].map(t => getComputedStyle(part(t, ".nol-teamrun-project-name")).color === muted)).toEqual([true, false]);
      }
    });

    it("scrolls its list over the whole panel, so the scrollbar runs along the panel's end edge from top to bottom, with the view's padding inside the list", async () => {
      conversations = [SampleData.conversation, ...Array.from({ length: Resources.projectConversationCount + 2 }, (_, i) =>
        scratchOf(`s${String(i)}`, `Note ${String(i)}`, new Date(Date.UTC(2026, 8, 1 + i)).toISOString()))];
      await create();
      element().style.width = "16rem";
      element().style.height = "12rem";
      await settle();
      const list = element().querySelector<HTMLElement>(".nol-teamrun-projects") as HTMLElement;
      const panel = box(element());
      const inline = AppearanceFixture.measureLook("content-padding-inline");
      const block = AppearanceFixture.measureLook("view-padding-block");
      const first = box(action(Resources.newConversationLabel));
      const end = (): number => Math.max(...[...list.children].map(t => box(t).bottom));

      expect([getComputedStyle(list).overflowY, list.scrollHeight > list.clientHeight, list.clientLeft, list.clientTop]).toEqual(["auto", true, 0, 0]);
      expect(inline).toBeGreaterThan(0);
      for (const [edge, of] of [[box(list).top, panel.top], [box(list).bottom, panel.bottom], [box(list).left, panel.left], [box(list).right, panel.right]] as const)
        AppearanceFixture.expectPixels(edge, of);
      AppearanceFixture.expectPixels(first.top - panel.top, block);
      AppearanceFixture.expectPixels(first.left - panel.left, inline);
      AppearanceFixture.expectPixels(panel.left + list.clientWidth - first.right, inline);
      list.scrollTop = list.scrollHeight;
      await settle();
      expect(Math.abs(panel.bottom - end() - block - space(2))).toBeLessThanOrEqual(1);
    });

    it("spaces an action row's glyph and label half a rem apart, inside the row's inset, at a tree row's height", async () => {
      await create();
      const row = action(Resources.newConversationLabel);

      expect(matchMedia("(forced-colors: active)").matches).toBe(forcedColors === "active");
      AppearanceFixture.expectPixels(box(row).height, AppearanceFixture.measureLook("tree-row-height"));
      AppearanceFixture.expectPixels(box(part(row, ".nol-teamrun-glyph")).left - box(row).left, space(2));
      AppearanceFixture.expectPixels(box(part(row, ".nol-teamrun-label")).left - box(part(row, ".nol-teamrun-glyph")).right, space(2));
    });

    it("stands each row the tabs' gap, twice their inset, below the row above it, so a hovered row and a selected one below it never touch", async () => {
      const later = scratchOf("c6", "Later", "2026-09-14T08:00:00.000Z");
      const kept = scratchOf("c7", "Kept", "2026-09-15T08:00:00.000Z");
      const saved = scratchOf("c8", "Saved", "2026-09-16T08:00:00.000Z");
      conversations = [SampleData.conversation, second, scratch, later, kept, saved];
      await create();
      await choose(conversationRow(kept.title), Resources.pinLabel);
      await choose(conversationRow(saved.title), Resources.pinLabel);
      const [pinAbove, pinBelow] = [...element().querySelectorAll<HTMLElement>(".nol-teamrun-pins .nol-teamrun-conversation-row")];
      const nestedAbove = conversationRow(second.title);
      const nestedBelow = conversationRow(SampleData.conversation.title);
      const next = projectRow(SampleData.otherProject.name);
      const pairs = [[pinAbove, pinBelow], [projectRow(SampleData.project.name), nestedAbove],
        [nestedAbove, nestedBelow], [nestedBelow, next], [next, find<HTMLElement>(".nol-teamrun-conversation-list .nol-teamrun-muted", Resources.noConversations)],
        [conversationRow(later.title), conversationRow(scratch.title)]];
      const gap = 2 * AppearanceFixture.measureLook("tab-inset");

      await store.conversationInView(SampleData.conversation.id);
      await PointerFixture.hoverAsync(nestedAbove);
      await settle();
      const colors = [nestedAbove, nestedBelow].map(t => getComputedStyle(t).backgroundColor);
      const park = await AppearanceFixture.parkPointerAsync();
      park.remove();

      expect(matchMedia("(forced-colors: active)").matches).toBe(forcedColors === "active");
      expect(gap).toBeGreaterThan(0);
      for (const [above, below] of pairs) {
        if (above === undefined || below === undefined)
          throw new Error("A pair of rows is missing.");
        AppearanceFixture.expectPixels(box(below).top - box(above).bottom, gap);
        AppearanceFixture.expectPixels(box(below).height, AppearanceFixture.measureLook("tree-row-height"));
      }
      expect(nestedBelow.classList).toContain("nol-teamrun-selected");
      if (forcedColors === "none")
        expect(colors).toEqual([AppearanceFixture.readColor(FixtureTheme.theme, mode, "hover"), AppearanceFixture.readColor(FixtureTheme.theme, mode, "selected")]);
    });

    it("stands a project's Show more the tabs' gap below its last shown chat", async () => {
      conversations = Array.from({ length: 12 }, (_, i) => {
        const at = `2026-09-11T${String(i).padStart(2, "0")}:00:00.000Z`;
        return new Conversation(`n${i}`, "p1", `Talk ${i}`, at, at);
      });
      await create();
      const lastShown = [...element().querySelectorAll<HTMLElement>(".nol-teamrun-project-list .nol-teamrun-conversation-row")].at(-1);
      const showMore = part(element(), ".nol-teamrun-project-list .nol-teamrun-show-more");
      if (lastShown === undefined)
        throw new Error("The project shows no chats.");

      expect(matchMedia("(forced-colors: active)").matches).toBe(forcedColors === "active");
      expect(showMore.textContent?.trim()).toBe(Resources.formatShowMore(2));
      AppearanceFixture.expectPixels(box(showMore).top - box(lastShown).bottom, 2 * AppearanceFixture.measureLook("tab-inset"));
      AppearanceFixture.expectPixels(box(showMore).height, AppearanceFixture.measureLook("tree-row-height"));
    });

    it("sets Organizations' top a section header's space under Open folder, as Pinned's top is under Open folder, and the action rows' gap under the pins", async () => {
      await create();
      const header = (label: string): HTMLElement => find<HTMLElement>("nol-section-header", label);
      const openFolder = action(Resources.openProjectLabel);

      expect(matchMedia("(forced-colors: active)").matches).toBe(forcedColors === "active");
      AppearanceFixture.expectPixels(box(header(Resources.organizationsTitle)).top - box(openFolder).bottom, headerSpace());

      await choose(conversationRow(second.title), Resources.pinLabel);

      AppearanceFixture.expectPixels(box(header(Resources.pinnedTitle)).top - box(openFolder).bottom, headerSpace());
      AppearanceFixture.expectPixels(box(header(Resources.organizationsTitle)).top - box(part(element(), ".nol-teamrun-pins")).bottom, rowGap());
    });

    it("stands each section header the action rows' gap and pitch under the row or header above, collapsed or expanded, and the first a section header's space under the actions",
      async () => {
        conversations = [SampleData.conversation, scratch, second];
        await createOrganization();
        await choose(conversationRow(second.title), Resources.pinLabel);
        await settle();
        const header = (label: string): HTMLElement => find<HTMLElement>("nol-section-header", label);
        const below = (title: string, above: Element): number => box(header(title)).top - box(above).bottom;
        const step = (title: string, above: Element): number => box(header(title)).top - box(above).top;
        const lastRowOf = (list: string): HTMLElement => {
          const rows = element().querySelectorAll<HTMLElement>(`${list} .nol-teamrun-row`);
          return itemAt(rows, rows.length - 1);
        };
        const [newChat, openFolder] = [action(Resources.newConversationLabel), action(Resources.openProjectLabel)];
        const actionGap = box(openFolder).top - box(newChat).bottom;
        const pitch = box(openFolder).top - box(newChat).top;
        const expanded = [below(Resources.organizationsTitle, part(element(), ".nol-teamrun-pins")),
          below(Resources.projectsViewTitle, part(element(), ".nol-teamrun-organization-list")), below(Resources.chatsTitle, part(element(), ".nol-teamrun-project-list"))];
        const expandedSteps = [step(Resources.organizationsTitle, lastRowOf(".nol-teamrun-pins")), step(Resources.projectsViewTitle, lastRowOf(".nol-teamrun-organization-list")),
          step(Resources.chatsTitle, lastRowOf(".nol-teamrun-project-list"))];
        const rows = [".nol-teamrun-pins", ".nol-teamrun-organization-list", ".nol-teamrun-project-list"].map(t => part(element(), t).childElementCount);
        for (const title of [Resources.pinnedTitle, Resources.organizationsTitle, Resources.projectsViewTitle, Resources.chatsTitle])
          part(header(title), ".nol-section-header-toggle").click();
        await settle();
        const collapsed = [below(Resources.organizationsTitle, header(Resources.pinnedTitle)), below(Resources.projectsViewTitle, header(Resources.organizationsTitle)),
          below(Resources.chatsTitle, header(Resources.projectsViewTitle))];
        const collapsedSteps = [step(Resources.organizationsTitle, header(Resources.pinnedTitle)), step(Resources.projectsViewTitle, header(Resources.organizationsTitle)),
          step(Resources.chatsTitle, header(Resources.projectsViewTitle))];

        expect(matchMedia("(forced-colors: active)").matches).toBe(forcedColors === "active");
        expect([rows.every(t => t > 0), element().querySelector(".nol-teamrun-organization-row, .nol-teamrun-project-row, .nol-teamrun-conversation-row")]).toEqual([true, null]);
        for (const gap of [...expanded, ...collapsed])
          AppearanceFixture.expectPixels(gap, actionGap);
        for (const distance of [...expandedSteps, ...collapsedSteps])
          AppearanceFixture.expectPixels(distance, pitch);
        AppearanceFixture.expectPixels(box(header(Resources.pinnedTitle)).top - box(openFolder).bottom, headerSpace());
      });

    it("stands Open folder the rows' gap under New chat, Organizations a section header's space under it, Projects the rows' gap under Organizations with none and Chats the rows' gap under Projects, each at a tree row's height", async () => {
      conversations = [SampleData.conversation, scratch];
      await create();
      const header = (label: string): HTMLElement => find<HTMLElement>("nol-section-header", label);
      part(header(Resources.projectsViewTitle), ".nol-section-header-toggle").click();
      await settle();
      const [newChat, openFolder] = [action(Resources.newConversationLabel), action(Resources.openProjectLabel)];
      const [organizations, projects, chats] = [header(Resources.organizationsTitle), header(Resources.projectsViewTitle), header(Resources.chatsTitle)];
      const height = AppearanceFixture.measureLook("tree-row-height");

      expect(element().querySelector(".nol-teamrun-project-row")).toBeNull();
      expect(height).toBeLessThan(AppearanceFixture.measureLook("section-header-height"));
      for (const row of [newChat, openFolder, organizations, projects, chats])
        AppearanceFixture.expectPixels(box(row).height, height);
      AppearanceFixture.expectPixels(box(openFolder).top - box(newChat).bottom, rowGap());
      AppearanceFixture.expectPixels(box(organizations).top - box(openFolder).bottom, headerSpace());
      AppearanceFixture.expectPixels(box(projects).top - box(organizations).bottom, rowGap());
      AppearanceFixture.expectPixels(box(chats).top - box(projects).bottom, rowGap());
    });

    it("draws Open browser as Open folder is drawn, the rows' gap under it, with its glyph and label at Open folder's insets and colours, and Organizations a step under it", async () => {
      await create(withBrowser);
      const header = (label: string): HTMLElement => find<HTMLElement>("nol-section-header", label);
      const [openFolder, openBrowser] = [action(Resources.openProjectLabel), action(Resources.openBrowserLabel)];
      const inset = (row: HTMLElement, selector: string): readonly number[] => [box(part(row, selector)).left - box(row).left, box(part(row, selector)).width,
        box(part(row, selector)).top - box(row).top];
      const colors = (row: HTMLElement): readonly string[] => [getComputedStyle(row).backgroundColor, getComputedStyle(part(row, ".nol-teamrun-glyph")).color,
        getComputedStyle(part(row, ".nol-teamrun-label")).color];

      expect(matchMedia("(forced-colors: active)").matches).toBe(forcedColors === "active");
      expect([box(openBrowser).left, box(openBrowser).width]).toEqual([box(openFolder).left, box(openFolder).width]);
      AppearanceFixture.expectPixels(box(openBrowser).height, box(openFolder).height);
      AppearanceFixture.expectPixels(box(openBrowser).top - box(openFolder).bottom, rowGap());
      AppearanceFixture.expectPixels(box(header(Resources.organizationsTitle)).top - box(openBrowser).bottom, headerSpace());
      expect(inset(openBrowser, ".nol-teamrun-glyph")).toEqual(inset(openFolder, ".nol-teamrun-glyph"));
      expect(inset(openBrowser, ".nol-teamrun-label")[0]).toBe(inset(openFolder, ".nol-teamrun-label")[0]);
      expect(colors(openBrowser)).toEqual(colors(openFolder));
    });

    it("sets Chats the rows' gap under the projects, with its rows at the pins' inset and height and their actions at a tab close's inset", async () => {
      conversations = [SampleData.conversation, scratch];
      await create();
      const row = conversationRow(scratch.title);

      AppearanceFixture.expectPixels(box(find<HTMLElement>("nol-section-header", Resources.chatsTitle)).top - box(part(element(), ".nol-teamrun-project-list")).bottom,
        rowGap());
      AppearanceFixture.expectPixels(box(row).height, AppearanceFixture.measureLook("tree-row-height"));
      AppearanceFixture.expectPixels(box(part(row, ".nol-teamrun-conversation-title")).left - box(row).left, space(2));
      AppearanceFixture.expectPixels(box(row).right - box(part(row, ".nol-teamrun-row-actions")).right, closeInset());
    });

    it("spaces the Chats group's rows and its Show more as the pins' rows, at the pins' start", async () => {
      const many = Array.from({ length: Resources.projectConversationCount + 1 }, (_, i) =>
        scratchOf(`s${String(i)}`, `Note ${String(i)}`, new Date(Date.UTC(2026, 8, 1 + i)).toISOString()));
      conversations = [SampleData.conversation, second, ...many];
      await create();
      layout.togglePin("c1");
      layout.togglePin("c2");
      await settle();
      const pins = [...element().querySelectorAll(".nol-teamrun-pins .nol-teamrun-conversation-row")];
      const rows = [...element().querySelectorAll(".nol-teamrun-chat-list .nol-teamrun-conversation-row")];
      const gap = box(itemAt(pins, 1)).top - box(itemAt(pins, 0)).bottom;

      expect(gap).toBeGreaterThan(0);
      AppearanceFixture.expectPixels(box(itemAt(rows, 1)).top - box(itemAt(rows, 0)).bottom, gap);
      AppearanceFixture.expectPixels(box(part(element(), ".nol-teamrun-chat-list .nol-teamrun-show-more")).top - box(itemAt(rows, rows.length - 1)).bottom, gap);
      AppearanceFixture.expectPixels(box(itemAt(rows, 0)).left, box(itemAt(pins, 0)).left);
      AppearanceFixture.expectPixels(box(itemAt(rows, 0)).width, box(itemAt(pins, 0)).width);
    });

    it("starts Pinned, Projects and Chats each with its own icon, half a rem before its label and centred on it", async () => {
      conversations = [SampleData.conversation, second, scratch];
      await create();
      await choose(conversationRow(second.title), Resources.pinLabel);

      const headings: readonly (readonly [string, string])[] = [
        [Resources.pinnedTitle, Resources.pinnedIcon], [Resources.projectsViewTitle, Resources.projectsIcon], [Resources.chatsTitle, Resources.chatsIcon]
      ];

      for (const [title, glyph] of headings) {
        const header = find<HTMLElement>("nol-section-header", title);
        const icon = part(header, ".nol-section-header-icon");
        const label = part(header, ".nol-section-header-label");
        expect([icon.textContent?.trim(), label.textContent?.trim()]).toEqual([glyph, title]);
        AppearanceFixture.expectPixels(box(icon).left, box(header).left + Number.parseFloat(getComputedStyle(part(header, ".nol-section-header-toggle")).paddingInlineStart));
        AppearanceFixture.expectPixels(box(label).left - box(icon).right, space(2));
        AppearanceFixture.expectPixels(box(icon).top + box(icon).height / 2, box(label).top + box(label).height / 2);
        AppearanceFixture.expectPixels(box(icon).width, AppearanceFixture.measureLook("icon"));
      }
    });

    it("starts each heading's rows at its label's edge, with the row's fill a row padding before the text and running to the row's end", async () => {
      conversations = [SampleData.conversation, second, scratch];
      await create();
      await choose(conversationRow(second.title), Resources.pinLabel);
      const labelOf = (title: string): DOMRect => box(part(find<HTMLElement>("nol-section-header", title), ".nol-section-header-label"));
      const end = box(part(element(), ".nol-teamrun-action")).right;
      const rows: [string, HTMLElement, HTMLElement][] = [
        [Resources.pinnedTitle, itemAt(element().querySelectorAll<HTMLElement>(".nol-teamrun-pins .nol-teamrun-conversation-row"), 0), part(element(), ".nol-teamrun-pins .nol-teamrun-conversation-title")],
        [Resources.projectsViewTitle, projectRow(SampleData.project.name), part(projectRow(SampleData.project.name), ".nol-teamrun-project-name")],
        [Resources.chatsTitle, conversationRow(scratch.title), part(conversationRow(scratch.title), ".nol-teamrun-conversation-title")]
      ];

      for (const [title, row, text] of rows) {
        AppearanceFixture.expectPixels(box(text).left, labelOf(title).left);
        AppearanceFixture.expectPixels(box(text).left - box(row).left, space(2));
        AppearanceFixture.expectPixels(box(row).right, end);
        AppearanceFixture.expectPixels(box(row).height, AppearanceFixture.measureLook("tree-row-height"));
        AppearanceFixture.expectPixels(box(find<HTMLElement>("nol-section-header", title)).height, AppearanceFixture.measureLook("tree-row-height"));
      }
    });

    it("sets each heading in capitals, in the small text size below a label's and the rows' text, in the full text colour, at a tree row's height",
      async () => {
        conversations = [SampleData.conversation, second, scratch];
        await create();
        await choose(conversationRow(second.title), Resources.pinLabel);
        const titles = [Resources.pinnedTitle, Resources.projectsViewTitle, Resources.chatsTitle];
        const theme = (token: string): string => AppearanceFixture.readColor(FixtureTheme.theme, mode, token);
        const probe = document.body.appendChild(document.createElement("div"));
        probe.style.color = "CanvasText";
        const canvasText = getComputedStyle(probe).color;
        probe.remove();
        const labelOf = (title: string): CSSStyleDeclaration => getComputedStyle(part(find<HTMLElement>("nol-section-header", title), ".nol-section-header-label"));

        for (const title of titles) {
          expect([labelOf(title).textTransform, labelOf(title).color]).toEqual(["uppercase", forcedColors === "active" ? canvasText : theme("text")]);
          AppearanceFixture.expectPixels(box(find<HTMLElement>("nol-section-header", title)).height, AppearanceFixture.measureLook("tree-row-height"));
        }
        document.documentElement.style.setProperty("--nol-text-panel", "1rem");
        try {
          const sizes = { small: AppearanceFixture.measureLook("text-small"), label: AppearanceFixture.measureLook("text-label"),
            row: Number.parseFloat(getComputedStyle(part(conversationRow(scratch.title), ".nol-teamrun-conversation-title")).fontSize) };

          expect([sizes.small < sizes.label, sizes.label < sizes.row]).toEqual([true, true]);
          for (const title of titles)
            AppearanceFixture.expectPixels(Number.parseFloat(labelOf(title).fontSize), sizes.small);
        } finally {
          document.documentElement.style.removeProperty("--nol-text-panel");
        }
      });

    const rowGap = (): number => {
      const probe = element().appendChild(document.createElement("div"));
      probe.style.cssText = "height: var(--nol-row-gap, calc(2 * var(--nol-tab-inset)))";
      const gap = box(probe).height;
      probe.remove();
      return gap;
    };

    const expectGapsBelowHeadings = async (firsts: [string, HTMLElement][]): Promise<void> => {
      const gap = rowGap();

      expect(gap).toBeGreaterThan(0);
      for (const [title, row] of firsts) {
        const header = find<HTMLElement>("nol-section-header", title);
        AppearanceFixture.expectPixels(box(row).top - box(header).bottom, gap);
        await userEvent.hover(part(header, ".nol-section-header-toggle"));
        AppearanceFixture.expectPixels(box(row).top - box(header).bottom, gap);
        await userEvent.unhover(part(header, ".nol-section-header-toggle"));
      }
    };

    it("sets each group's first row apart from its heading by the gap between rows, so a highlighted heading and row never touch", async () => {
      conversations = [SampleData.conversation, second, scratch];
      await create();
      await choose(conversationRow(second.title), Resources.pinLabel);
      const firsts: [string, HTMLElement][] = [
        [Resources.pinnedTitle, itemAt(element().querySelectorAll<HTMLElement>(".nol-teamrun-pins .nol-teamrun-conversation-row"), 0)],
        [Resources.projectsViewTitle, projectRow(SampleData.project.name)],
        [Resources.chatsTitle, itemAt(element().querySelectorAll<HTMLElement>(".nol-teamrun-chat-list .nol-teamrun-conversation-row"), 0)]
      ];
      await store.conversationInView(scratch.id);
      await settle();

      await expectGapsBelowHeadings(firsts);
    });

    it("sets the No projects line apart from the Projects heading by the gap between rows, with and without the heading's highlight", async () => {
      conversations = [];
      await create(t => t.answer(MethodName.ProjectList, () => []));

      await expectGapsBelowHeadings([[Resources.projectsViewTitle, part(element(), ".nol-teamrun-projects > .nol-teamrun-muted")]]);
    });

    it("shows chat titles in the muted colour, and the marked or hovered one in the full text colour", async () => {
      conversations = [SampleData.conversation, second, scratch];
      await create();
      await store.conversationInView(second.id);
      await settle();
      const colorOf = (row: HTMLElement): string => getComputedStyle(part(row, ".nol-teamrun-conversation-title")).color;
      await userEvent.hover(find<HTMLElement>("nol-section-header", Resources.projectsViewTitle));
      const resting = [colorOf(conversationRow(scratch.title)), colorOf(conversationRow(SampleData.conversation.title))];
      const marked = colorOf(conversationRow(second.title));
      await userEvent.hover(conversationRow(scratch.title));
      const hovered = colorOf(conversationRow(scratch.title));
      await userEvent.unhover(conversationRow(scratch.title));
      const theme = (token: string): string => AppearanceFixture.readColor(FixtureTheme.theme, mode, token);
      const probe = document.body.appendChild(document.createElement("div"));
      probe.style.color = "HighlightText";
      const highlight = getComputedStyle(probe).color;
      probe.remove();

      expect([...resting, hovered, marked]).toEqual(forcedColors === "active"
        ? [resting[0], resting[0], hovered, highlight]
        : [theme("text-muted"), theme("text-muted"), theme("text"), theme("text")]);
    });

    it("stands each group's caret a quarter rem after its title, at the kit's section-header caret size in the title's text colour and centred on it, pointing down while open and turned a quarter while closed", async () => {
      conversations = [SampleData.conversation, second, scratch];
      await create();
      await choose(conversationRow(second.title), Resources.pinLabel);
      const header = (label: string): HTMLElement => find<HTMLElement>("nol-section-header", label);
      const projects = header(Resources.projectsViewTitle);
      const height = box(projects).height;

      expect(matchMedia("(forced-colors: active)").matches).toBe(forcedColors === "active");
      for (const label of [Resources.pinnedTitle, Resources.projectsViewTitle, Resources.chatsTitle]) {
        const caret = part(header(label), ".nol-section-header-caret");
        const title = part(header(label), ".nol-section-header-label");
        AppearanceFixture.expectPixels(box(caret).left - box(title).right, space(1));
        AppearanceFixture.expectPixels(box(caret).width, AppearanceFixture.measureLook("section-header-caret"));
        AppearanceFixture.expectPixels(Number.parseFloat(getComputedStyle(caret).fontSize), AppearanceFixture.measureLook("section-header-caret"));
        expect(getComputedStyle(caret).color).toBe(getComputedStyle(title).color);
        AppearanceFixture.expectPixels(box(caret).top + box(caret).height / 2, box(title).top + box(title).height / 2);
        expect(getComputedStyle(caret).rotate).toBe("none");
      }

      part(projects, ".nol-section-header-toggle").focus();
      await userEvent.keyboard("{Enter}");
      await settle();

      expect(getComputedStyle(part(projects, ".nol-section-header-caret")).rotate).toBe("-90deg");
      AppearanceFixture.expectPixels(box(projects).height, height);
      AppearanceFixture.expectPixels(box(header(Resources.chatsTitle)).top - box(projects).bottom, rowGap());
    });

    it("starts a project's name as typed, with its twistie in the gutter centred on the headings' icons", async () => {
      await create();
      const row = projectRow(SampleData.project.name);
      const name = part(row, ".nol-teamrun-project-name");
      const twistie = part(row, ".nol-teamrun-twistie");
      const icon = box(part(find<HTMLElement>("nol-section-header", Resources.projectsViewTitle), ".nol-section-header-icon"));
      const style = getComputedStyle(name);

      AppearanceFixture.expectPixels(box(row).height, AppearanceFixture.measureLook("tree-row-height"));
      AppearanceFixture.expectPixels(box(twistie).left + box(twistie).width / 2, icon.left + icon.width / 2);
      AppearanceFixture.expectPixels(box(twistie).top + box(twistie).height / 2, box(name).top + box(name).height / 2);
      AppearanceFixture.expectPixels(box(twistie).right, box(row).left);
      expect([style.textTransform, style.letterSpacing]).toEqual(["none", "normal"]);
    });

    it("hangs an organization's twistie in the gutter centred on the headings' icons, a department's one nested step in, and starts a department's name with its teammates' names", async () => {
      await createOrganization();
      const top = organizationRow(organization.name);
      const department = organizationRow("Marketing");
      const topTwistie = part(top, ".nol-teamrun-twistie");
      const twistie = part(department, ".nol-teamrun-twistie");
      const name = part(department, ".nol-teamrun-organization-name");
      const icon = box(part(find<HTMLElement>("nol-section-header", Resources.organizationsTitle), ".nol-section-header-icon"));

      for (const row of [top, department])
        AppearanceFixture.expectPixels(box(row).height, AppearanceFixture.measureLook("tree-row-height"));
      AppearanceFixture.expectPixels(box(topTwistie).left + box(topTwistie).width / 2, icon.left + icon.width / 2);
      AppearanceFixture.expectPixels(box(topTwistie).right, box(top).left);
      AppearanceFixture.expectPixels(box(twistie).right, box(department).left);
      AppearanceFixture.expectPixels(box(twistie).left - box(topTwistie).left, AppearanceFixture.measureLook("icon") + space(1));
      AppearanceFixture.expectPixels(box(twistie).top + box(twistie).height / 2, box(name).top + box(name).height / 2);
      AppearanceFixture.expectPixels(box(name).left, box(part(teammateRow("Grok"), ".nol-teamrun-teammate-name")).left);
      AppearanceFixture.expectPixels(box(name).left, box(part(organizationRow("DevOps"), ".nol-teamrun-organization-name")).left);
    });

    it("indents a project's conversations one step past its name, and ends each row's actions as far from the row's end as a tab's close button", async () => {
      await create();
      const conversation = conversationRow(second.title);
      const project = projectRow(SampleData.project.name);
      const title = part(conversation, ".nol-teamrun-conversation-title");

      AppearanceFixture.expectPixels(box(conversation).height, AppearanceFixture.measureLook("tree-row-height"));
      AppearanceFixture.expectPixels(box(title).left - box(part(project, ".nol-teamrun-project-name")).left, AppearanceFixture.measureLook("icon") + space(1));
      AppearanceFixture.expectPixels(box(title).left - box(conversation).left, space(2));
      AppearanceFixture.expectPixels(box(conversation).right, box(project).right);
      AppearanceFixture.expectPixels(box(conversation).right - box(part(conversation, ".nol-teamrun-row-actions")).right, closeInset());
      AppearanceFixture.expectPixels(box(project).right - box(part(project, ".nol-teamrun-row-actions")).right, closeInset());
    });

    it.each(["ltr", "rtl"])("in %s, sets a project's, a chat's and a pin's actions in a tab action's slot at a tab close's inset from the row's end, with a tab close's hover fill, a running chat's spinner a tab's gap before it", async direction => {
      conversations = [SampleData.conversation, second, scratch];
      await create(t => t.answer(MethodName.MessageListOpen, () => [SampleData.reply.toJson()]));
      layout.togglePin("c2");
      await settle();
      element().dir = direction;
      await settle();
      const ends = (row: HTMLElement): [number, number] => {
        const [frame, more] = [box(row), box(part(row, ".nol-teamrun-row-actions"))];
        return direction === "rtl" ? [more.left - frame.left, more.width] : [frame.right - more.right, more.width];
      };
      const running = conversationRow(SampleData.conversation.title);
      const [spinner, more] = [box(part(running, ".nol-teamrun-working")), box(part(running, ".nol-teamrun-row-actions"))];

      for (const row of [projectRow(SampleData.project.name), running, conversationRow(scratch.title), find<HTMLElement>(".nol-teamrun-pins .nol-teamrun-conversation-row", second.title)]) {
        const [inset, width] = ends(row);
        AppearanceFixture.expectPixels(inset, closeInset());
        AppearanceFixture.expectPixels(width, AppearanceFixture.measureLook("tab-action-slot"));
        const fill = getComputedStyle(part(row, ".nol-teamrun-row-actions"), "::before");
        AppearanceFixture.expectPixels(parseFloat(fill.width), AppearanceFixture.measureLook("tab-close"));
        AppearanceFixture.expectPixels(parseFloat(fill.height), AppearanceFixture.measureLook("tab-close"));
        for (const corner of [fill.borderTopLeftRadius, fill.borderTopRightRadius, fill.borderBottomRightRadius, fill.borderBottomLeftRadius])
          AppearanceFixture.expectPixels(parseFloat(corner), AppearanceFixture.measureLook("radius-small"));
      }
      AppearanceFixture.expectPixels(direction === "rtl" ? spinner.left - more.right : more.left - spinner.right, space(1));
    });

    it("draws a waiting conversation's raised hand at the spinner's size and place, centred in the row", async () => {
      await create(t => t.answer(MethodName.MessageListOpen, () => [SampleData.withStatus(SampleData.reply, MessageStatus.AwaitingApproval).toJson()]));
      await settle();
      const row = conversationRow(SampleData.conversation.title);
      const glyph = box(part(row, ".nol-teamrun-waiting"));
      const spinner = AppearanceFixture.measureLook("spinner");

      AppearanceFixture.expectPixels(glyph.width, spinner);
      AppearanceFixture.expectPixels(glyph.height, spinner);
      AppearanceFixture.expectPixels(glyph.top + glyph.height / 2, box(row).top + box(row).height / 2);
      expect(glyph.right).toBeLessThanOrEqual(box(part(row, ".nol-teamrun-row-actions")).left);
      const color = getComputedStyle(part(row, ".nol-teamrun-waiting")).color;

      context.emit(EventName.MessageUpdated, SampleData.withStatus(SampleData.reply, MessageStatus.Running).toJson());
      await settle();
      const working = part(row, ".nol-teamrun-working");
      AppearanceFixture.expectPixels(box(working).left, glyph.left);
      AppearanceFixture.expectPixels(box(working).width, glyph.width);
      expect(color).toBe(getComputedStyle(working).color);
    });

    it("outlines a focused row inside its edges, at its height, and starts its title where it was", async () => {
      await create();
      const row = conversationRow(second.title);
      const border = AppearanceFixture.measureLook("border-width");
      const before = [box(row).height, box(part(row, ".nol-teamrun-conversation-title")).left - box(row).left];
      const probe = document.body.appendChild(document.createElement("div"));
      probe.style.color = forcedColors === "active" ? "Highlight" : "var(--nol-accent)";

      row.focus();
      await settle();
      const style = getComputedStyle(row);

      expect([document.activeElement, style.outlineStyle, style.outlineColor]).toEqual([row, "solid", getComputedStyle(probe).color]);
      AppearanceFixture.expectPixels(Number.parseFloat(style.outlineWidth), (forcedColors === "active" ? 2 : 1) * border);
      AppearanceFixture.expectPixels(Number.parseFloat(style.outlineOffset), -border);
      AppearanceFixture.expectPixels(box(row).height, itemAt(before, 0));
      AppearanceFixture.expectPixels(box(row).height, AppearanceFixture.measureLook("tree-row-height"));
      AppearanceFixture.expectPixels(box(part(row, ".nol-teamrun-conversation-title")).left - box(row).left, itemAt(before, 1));
      probe.remove();
    });

    it("marks the selected project's row while no chat is marked in the selected fill, or Highlight under forced colours with its name and glyphs in HighlightText, a missing folder's name staying muted otherwise, at the row's height", async () => {
      await create(withMissingFolder);
      const row = projectRow(SampleData.otherProject.name);
      const parts = [".nol-teamrun-project-name", ".nol-teamrun-twistie .nol-teamrun-glyph", ".nol-teamrun-folder-missing"].map(t => part(row, t));
      const colors = (): readonly string[] => parts.map(t => getComputedStyle(t).color);
      const height = box(row).height;
      const unmarked = colors();
      const probe = document.body.appendChild(document.createElement("div"));
      probe.style.cssText = forcedColors === "active" ? "forced-color-adjust: none; background-color: Highlight; color: HighlightText" : "background-color: var(--nol-selected)";

      await store.selectProject(SampleData.otherProject.id);
      await settle();

      expect(matchMedia("(forced-colors: active)").matches).toBe(forcedColors === "active");
      expect([row.getAttribute("aria-selected"), projectRow(SampleData.project.name).getAttribute("aria-selected")]).toEqual(["true", "false"]);
      expect(getComputedStyle(row).backgroundColor).toBe(getComputedStyle(probe).backgroundColor);
      expect(colors()).toEqual(forcedColors === "active" ? parts.map(() => getComputedStyle(probe).color) : unmarked);
      if (forcedColors === "none")
        expect(colors()[0]).toBe(AppearanceFixture.readColor(FixtureTheme.theme, mode, "text-muted"));
      AppearanceFixture.expectPixels(box(row).height, height);
      AppearanceFixture.expectPixels(box(row).height, AppearanceFixture.measureLook("tree-row-height"));
      probe.remove();
    });

    it("fades a row's actions in over 120ms when the row takes focus", async () => {
      await create();
      const actions = part(conversationRow(second.title), ".nol-teamrun-row-actions");
      const style = getComputedStyle(actions);

      expect([style.opacity, style.transitionProperty, style.transitionDuration]).toEqual(["0", "opacity", "0.12s"]);
      actions.focus();
      await Wait.until(() => expect(getComputedStyle(actions).opacity).toBe("1"));
    });

    it("sets the Organizations group's organization as a project, a teammate in no department as a project's chat, and a department's teammate a step further, each a tree row high", async () => {
      await createOrganization();
      const project = projectRow(SampleData.project.name);
      const chat = conversationRow(SampleData.conversation.title);
      const top = organizationRow(organization.name);
      const step = AppearanceFixture.measureLook("icon") + AppearanceFixture.measureLook("space-1");
      const nameLeft = (row: HTMLElement, selector: string): number => box(part(row, selector)).left;

      AppearanceFixture.expectPixels(nameLeft(top, ".nol-teamrun-organization-name"), nameLeft(project, ".nol-teamrun-project-name"));
      AppearanceFixture.expectPixels(nameLeft(teammateRow("Grok"), ".nol-teamrun-teammate-name"), nameLeft(chat, ".nol-teamrun-conversation-title"));
      AppearanceFixture.expectPixels(nameLeft(teammateRow("Agy"), ".nol-teamrun-teammate-name"), nameLeft(chat, ".nol-teamrun-conversation-title") + step);
      for (const row of [top, organizationRow("DevOps"), teammateRow("Grok"), teammateRow("Agy")])
        AppearanceFixture.expectPixels(box(row).height, AppearanceFixture.measureLook("tree-row-height"));
    });
  });

  it("shows a row's actions without a fade, and rearranges rows during a drag without a transition, when the person prefers reduced motion", async () => {
    await EmulatedMediaFixture.emulateAsync("prefers-reduced-motion", "reduce");
    try {
      await create();
      const actions = part(conversationRow(second.title), ".nol-teamrun-row-actions");
      const list = part(element(), ".nol-teamrun-project-list");
      const release = await holdDragAsync(projectRow(SampleData.otherProject.name), projectRow(SampleData.project.name));
      const moving = dragItemOf(projectRow(SampleData.project.name));
      const dragging = [list.classList.contains("cdk-drop-list-dragging"), moving.classList.contains("cdk-drag-placeholder"), getComputedStyle(moving).transitionDuration];
      await release();

      expect(getComputedStyle(actions).transitionDuration).toBe("0s");
      expect(dragging).toEqual([true, false, "0s"]);
    }
    finally {
      await EmulatedMediaFixture.resetAsync();
    }
  });

  describe("the Organizations group", () => {
    it("lists Pinned, then Organizations, then Projects, then Chats, in the view, in Tab order and in the order a screen reader reads the groups", async () => {
      conversations = [SampleData.conversation, scratch, second];
      await createOrganization();
      await choose(conversationRow(second.title), Resources.pinLabel);
      await settle();
      const order = [Resources.pinnedTitle, Resources.organizationsTitle, Resources.projectsViewTitle, Resources.chatsTitle];
      const tops = order.map(t => find<HTMLElement>("nol-section-header", t).getBoundingClientRect().top);
      const toggles = [...element().querySelectorAll(".nol-section-header-toggle")].map(t => t.closest("nol-section-header")?.querySelector(".nol-section-header-label")?.textContent?.trim());

      expect(headers()).toEqual(order);
      expect(tops).toEqual([...tops].sort((a, b) => a - b));
      expect([toggles, element().querySelectorAll("[tabindex]:not([tabindex='0']):not([tabindex='-1'])").length]).toEqual([order, 0]);
      expect([...element().querySelectorAll("[role='tree']")].map(t => t.getAttribute("aria-label"))).toEqual(order);
    });

    it("lists each organization with its own teammates in no department first, with no group for them, then each department by its path with its teammates by name, and keeps Organization chats out of Chats", async () => {
      conversations = [SampleData.conversation, scratch, grokChat];
      await createOrganization();
      const levels = [...element().querySelectorAll(".nol-teamrun-organization-list [role='treeitem']")].map(t => t.getAttribute("aria-level"));

      expect(headers()).toEqual([Resources.organizationsTitle, Resources.projectsViewTitle, Resources.chatsTitle]);
      expect(names()).toEqual([organization.name, "Grok", "Opus 1", "Marketing", "DevOps", "Agy", "Builder", "Sol", "DevOps \u203a Infra", "Mia", "Labs", "Research", "Nova"]);
      expect(levels).toEqual(["1", "2", "2", "2", "2", "3", "3", "3", "2", "3", "1", "2", "3"]);
      expect(chats()).toEqual([scratch.title]);
      expect(/no department/iu.test(element().querySelector(".nol-teamrun-organization-list")?.textContent ?? "")).toBe(false);
    });

    it("folds a department and the organization from their twisties, saving each", async () => {
      await createOrganization();
      part(organizationRow("DevOps"), ".nol-teamrun-twistie").click();
      await settle();
      const folded = [names(), organizationRow("DevOps").getAttribute("aria-expanded"), layout.layout().isProjectCollapsed("devops")];
      part(organizationRow(organization.name), ".nol-teamrun-twistie").click();
      await settle();

      expect(folded).toEqual([[organization.name, "Grok", "Opus 1", "Marketing", "DevOps", infra, "Mia", "Labs", "Research", "Nova"], "false", true]);
      await Wait.until(() => expect(context.requests.filter(t => t.method === FakeWindowPartContext.qualify(MethodName.ProjectsLayoutSave))
        .map(t => ProjectsLayoutSaveParams.fromJson(t.parameters).layout[Resources.collapsedProjectsField])).toEqual([["devops"], ["devops", myOrganizationKey]]));
      expect(names()).toEqual([organization.name, "Labs", "Research", "Nova"]);
    });

    it("starts a department folded before a restart still folded", async () => {
      await createOrganization(t => t.answer(MethodName.ProjectsLayoutRead, () => ({ [Resources.collapsedProjectsField]: ["infra"] })));

      expect([names().includes("Mia"), organizationRow(infra).getAttribute("aria-expanded")]).toEqual([false, "false"]);
    });

    it("shows a department's type icon in its color before its name, centred on it, and no icon for a type without one", async () => {
      await createOrganization();
      const lab = new NodeType("lab", "Lab", "science", "teal", SampleData.timestamp, SampleData.timestamp);
      context.emit(EventName.OrganizationChanged, new Organization(labs.id, labs.name, null, labs.order, SampleData.timestamp, SampleData.timestamp,
        [SampleData.departmentType, lab], [new Department("research", "Research", lab.id, OrganizationParent.person, null, 0, "c", "u")], labs.placements).toJson());
      await Wait.until(() => expect(organizationRow("Research").querySelector("nol-teamrun-organization-type-icon .material-symbols-rounded")?.textContent).toBe("science"));
      const icon = part(organizationRow("Research"), "nol-teamrun-organization-type-icon .material-symbols-rounded");
      const name = part(organizationRow("Research"), ".nol-teamrun-organization-name");
      const probe = document.createElement("span");
      probe.style.color = "var(--nol-swatch-teal)";
      organizationRow("Research").append(probe);
      const middle = (target: Element): number => (target.getBoundingClientRect().top + target.getBoundingClientRect().bottom) / 2;

      expect(icon.getBoundingClientRect().right).toBeLessThanOrEqual(name.getBoundingClientRect().left);
      AppearanceFixture.expectPixels(middle(icon), middle(name));
      expect([getComputedStyle(icon).color, organizationRow("Marketing").querySelector("nol-teamrun-organization-type-icon .material-symbols-rounded")]).toEqual([getComputedStyle(probe).color, null]);
      probe.remove();
    });

    it("collapses the group from its title, saving it", async () => {
      await createOrganization();
      part(find<HTMLElement>("nol-section-header", Resources.organizationsTitle), ".nol-section-header-toggle").click();
      await settle();

      expect([names(), layout.layout().isGroupCollapsed(ProjectsGroup.Organizations)]).toEqual([[], true]);
    });

    it("opens a teammate's Organization chat in its own organization from its row, asking the engine for one when the teammate has none there yet", async () => {
      conversations = [SampleData.conversation, organizationChatOf("o3", grok, labs.id), grokChat];
      await createOrganization(t => t.answer(MethodName.OrganizationChatOpen, () => organizationChatOf("o2", nova, labs.id).toJson()));

      part(teammateRow("Grok"), ".nol-teamrun-teammate-name").click();
      await settle();
      const existing = [opened(), context.count(MethodName.OrganizationChatOpen)];
      teammateRow("Nova").focus();
      await userEvent.keyboard("{Enter}");
      await Wait.until(() => expect(opened()).toHaveLength(2));
      const asked = OrganizationChat.fromJson(requestOf(MethodName.OrganizationChatOpen));

      expect(existing).toEqual([[`${Resources.conversationDocumentName} o1`], 0]);
      expect([opened()[1], asked.organizationId, asked.teammateId]).toEqual([`${Resources.conversationDocumentName} o2`, labs.id, nova.id]);
    });

    it("opens nothing when the engine refuses a teammate's Organization chat", async () => {
      await createOrganization(t => t.fail(MethodName.OrganizationChatOpen, "No chat."));

      part(teammateRow("Opus 1"), ".nol-teamrun-teammate-name").click();
      await Wait.until(() => expect(context.count(MethodName.OrganizationChatOpen)).toBe(1));
      await settle();

      expect([opened(), context.lines.filter(t => t === Resources.formatOrganizationChatNotOpened("RuntimeRequestException: No chat."))]).toEqual([[], [Resources.formatOrganizationChatNotOpened("RuntimeRequestException: No chat.")]]);
    });

    it("lists a teammate placed in two organizations under each, and opens from each row that organization's own Organization chat for it", async () => {
      const both = labs.withTree(labs.departments, [...labs.placements, placementOf("grok", null, 0)]);
      conversations = [SampleData.conversation, grokChat, organizationChatOf("o3", grok, labs.id)];
      await createOrganization(t => t.answer(MethodName.OrganizationList, () => [organization.toJson(), both.toJson()]));
      const rows = (): HTMLElement[] => [...element().querySelectorAll<HTMLElement>(".nol-teamrun-teammate-row")].filter(u => u.textContent?.includes("Grok") === true);
      const listed = rows().length;
      for (const row of rows()) {
        part(row, ".nol-teamrun-teammate-name").click();
        await settle();
      }

      expect([listed, opened(), context.count(MethodName.OrganizationChatOpen)]).toEqual([2, [`${Resources.conversationDocumentName} o1`,
        `${Resources.conversationDocumentName} o3`], 0]);
    });

    it("opens each organization's own Organization view, under its name, from the organization's name, by Enter and from its row menu", async () => {
      await createOrganization();
      const views = (): string[] => context.openedDocuments.map(t => `${t.name} ${t.instance} ${t.title}`);
      const mine = `${Resources.organizationDocumentName} ${organization.id} ${organization.name}`;

      part(organizationRow(organization.name), ".nol-teamrun-organization-name").click();
      organizationRow(organization.name).focus();
      await userEvent.keyboard("{Enter}");
      await choose(organizationRow(organization.name), Resources.openOrganizationLabel);
      part(organizationRow(labs.name), ".nol-teamrun-organization-name").click();

      expect(views()).toEqual([mine, mine, mine, `${Resources.organizationDocumentName} ${labs.id} ${labs.name}`]);
    });

    it("marks a teammate whose Organization chat is shown, and shows the chat rows' spinner while its reply runs", async () => {
      conversations = [SampleData.conversation, grokChat];
      const running = new Message("m9", "o1", 1, MessageAuthor.Provider, "m8", MessageStatus.Running, [], SampleData.provenance, SampleData.timestamp, SampleData.timestamp, null);
      await createOrganization(t => t.answer(MethodName.MessageListOpen, () => [running.toJson()]));
      await store.conversationInView("o1");
      await settle();

      expect([teammateRow("Grok").getAttribute("aria-selected"), teammateRow("Grok").classList.contains("nol-teamrun-selected"), teammateRow("Opus 1").getAttribute("aria-selected")])
        .toEqual(["true", true, "false"]);
      expect([!Object.isNull(teammateRow("Grok").querySelector(".nol-teamrun-working nol-spinner")), teammateRow("Opus 1").querySelector(".nol-teamrun-working")]).toEqual([true, null]);
    });

    it("keeps an Organization chat out of Pinned and out of a project it was moved into, and still marks it on its teammate's row", async () => {
      const moved = new Conversation("o5", SampleData.project.id, opus.name, at, at, false, null, null, false, "/data/chats/o5", false, [], false, false, null,
        new OrganizationChat(organization.id, opus.id));
      conversations = [SampleData.conversation, grokChat, moved];
      await createOrganization();
      layout.togglePin(grokChat.id);
      await settle();
      await store.conversationInView(moved.id);
      await settle();

      expect([layout.pinnedConversations(), headers().includes(Resources.pinnedTitle), pinned()]).toEqual([[grokChat.id], false, []]);
      expect(nested()).not.toContain(opus.name);
      expect([teammateRow("Opus 1").getAttribute("aria-selected"), teammateRow("Grok").getAttribute("aria-selected")]).toEqual(["true", "false"]);
    });

    it("lists a teammate under a teammate with that teammate's department, a department under a teammate by its own path, and an empty organization beside a full one", async () => {
      const team = new Organization("team", "Team", null, 0, SampleData.timestamp, SampleData.timestamp, [SampleData.departmentType], [
        new Department("ops", "Ops", "department", OrganizationParent.person, null, 0, "c", "u"),
        new Department("design", "Design", "department", OrganizationParent.teammate(grok.id), null, 0, "c", "u")
      ], [
        new TeammatePlacement(grok.id, OrganizationParent.person, 0),
        new TeammatePlacement(zed.id, OrganizationParent.teammate(grok.id), 0),
        new TeammatePlacement(opus.id, OrganizationParent.department("ops"), 0),
        new TeammatePlacement(mia.id, OrganizationParent.teammate(opus.id), 0),
        new TeammatePlacement(builder.id, OrganizationParent.department("design"), 0)
      ]);
      const empty = new Organization("empty", "Empty", null, 1, SampleData.timestamp, SampleData.timestamp, [SampleData.departmentType], [], []);
      await create(t => t.answer(MethodName.TeammateList, () => [grok, opus, builder, mia, zed].map(u => u.toJson()))
        .answer(MethodName.OrganizationList, () => [team.toJson(), empty.toJson()]));
      await Wait.until(() => expect(names()).toContain(empty.name));
      const levels = [...element().querySelectorAll(".nol-teamrun-organization-list [role='treeitem']")].map(t => t.getAttribute("aria-level"));

      expect(names()).toEqual([team.name, "Grok", "Zed", "Ops", "Mia", "Opus 1", "Design", "Builder", empty.name]);
      expect(levels).toEqual(["1", "2", "2", "2", "3", "3", "2", "3", "1"]);
    });

    it("shows the Organizations group for an organization with no teammate and no department, and its header with \"+\" and no rows while there is no organization", async () => {
      await create(t => t.answer(MethodName.TeammateList, () => [grok].map(u => u.toJson()))
        .answer(MethodName.OrganizationList, () => [SampleData.organizationOf([], []).toJson()]));
      await Wait.until(() => expect(names()).toEqual([organization.name]));
      const shown = headers();
      context.emit(EventName.OrganizationRemoved, new OrganizationIdParams(organization.id).toJson());
      await settle();
      const list = element().querySelector(".nol-teamrun-organization-list");
      const header = find<HTMLElement>("nol-section-header", Resources.organizationsTitle);

      expect(shown).toEqual([Resources.organizationsTitle, Resources.projectsViewTitle]);
      expect([headers(), names(), list?.childElementCount, list?.getAttribute("role"), list?.getAttribute("aria-label")])
        .toEqual([[Resources.organizationsTitle, Resources.projectsViewTitle], [], 0, null, null]);
      expect(part(header, "button.nol-teamrun-new-organization").getAttribute("aria-label")).toBe(Resources.newOrganizationTitle);
    });

    it("creates an organization from \"+\" on the group's header with the name the person saves, and leaves it when they close the dialog", async () => {
      await createOrganization(t => t.answer(MethodName.OrganizationCreate, u => new Organization("studio", OrganizationCreateParams.fromJson(u).name, null, 2,
        SampleData.timestamp, SampleData.timestamp, [SampleData.departmentType], [], []).toJson()));
      const header = find<HTMLElement>("nol-section-header", Resources.organizationsTitle);
      const add = part(header, "button.nol-teamrun-new-organization");
      const creates = (): OrganizationCreateParams[] => context.requests.filter(t => t.method === FakeWindowPartContext.qualify(MethodName.OrganizationCreate))
        .map(t => OrganizationCreateParams.fromJson(t.parameters));

      add.click();
      await settle();
      const field = document.querySelector<HTMLInputElement>("nol-teamrun-rename-dialog .nol-teamrun-rename-title");
      const shown = [document.querySelector("nol-teamrun-rename-dialog .nol-dialog-title")?.textContent, field?.value, field?.getAttribute("aria-label"),
        document.querySelector<HTMLButtonElement>("nol-teamrun-rename-dialog .nol-teamrun-save")?.disabled];
      await answerDialog("nol-teamrun-rename-dialog .nol-teamrun-cancel");
      const closed = creates().length;
      add.click();
      await settle();
      const again = document.querySelector<HTMLInputElement>("nol-teamrun-rename-dialog .nol-teamrun-rename-title");
      if (Object.isNull(again))
        throw new Error("The new organization dialog shows no name field.");
      again.value = " Studio ";
      again.dispatchEvent(new Event("input"));
      await settle();
      await answerDialog("nol-teamrun-rename-dialog .nol-teamrun-save");
      await Wait.until(() => expect(creates()).toEqual([new OrganizationCreateParams("Studio", null)]));
      context.emit(EventName.OrganizationChanged, new Organization("studio", "Studio", null, 2, SampleData.timestamp, SampleData.timestamp, [SampleData.departmentType], [], []).toJson());
      await settle();

      expect([add.getAttribute("aria-label"), add.hasAttribute("nolsectionheaderaction")]).toEqual([Resources.newOrganizationTitle, true]);
      expect([shown, closed]).toEqual([[Resources.newOrganizationTitle, "", Resources.organizationNameFieldLabel, true], 0]);
      expect(names().at(-1)).toBe("Studio");
    });

    const organizationMenu = async (name: string): Promise<string[]> => {
      organizationRow(name).querySelector<HTMLButtonElement>(".nol-teamrun-row-actions")?.click();
      await settle();
      const labels = texts("button[nol-menu-item] .nol-menu-item-label", itemAt([...document.querySelectorAll("nol-menu")], 0));
      await userEvent.keyboard("{Escape}");
      await settle();
      return labels;
    };
    const updates = (): OrganizationUpdateParams[] => context.requests.filter(t => t.method === FakeWindowPartContext.qualify(MethodName.OrganizationUpdate))
      .map(t => OrganizationUpdateParams.fromJson(t.parameters));
    const withFolder = (folder: string | null): Organization => new Organization(organization.id, organization.name, folder, organization.order,
      SampleData.timestamp, SampleData.timestamp, [SampleData.departmentType], organization.departments, organization.placements);

    it("renames an organization with the name the person saves, under the organization's own heading, and leaves it when they close the dialog", async () => {
      await createOrganization(t => t.answer(MethodName.OrganizationUpdate, () => null));

      await choose(organizationRow(organization.name), Resources.renameConversationLabel);
      const field = document.querySelector<HTMLInputElement>("nol-teamrun-rename-dialog .nol-teamrun-rename-title");
      const shown = [document.querySelector("nol-teamrun-rename-dialog .nol-dialog-title")?.textContent, field?.value, field?.getAttribute("aria-label")];
      await answerDialog("nol-teamrun-rename-dialog .nol-teamrun-cancel");
      const closed = updates().length;
      await choose(organizationRow(organization.name), Resources.renameConversationLabel);
      const again = document.querySelector<HTMLInputElement>("nol-teamrun-rename-dialog .nol-teamrun-rename-title");
      if (Object.isNull(again))
        throw new Error("The rename dialog shows no name field.");
      again.value = " Studio ";
      again.dispatchEvent(new Event("input"));
      await settle();
      await answerDialog("nol-teamrun-rename-dialog .nol-teamrun-save");

      expect([shown, closed]).toEqual([[Resources.renameOrganizationTitle, organization.name, Resources.organizationNameFieldLabel], 0]);
      await Wait.until(() => expect(updates()).toEqual([new OrganizationUpdateParams(organization.id, "Studio", undefined)]));
      expect(document.querySelector("nol-teamrun-rename-dialog")).toBeNull();
    });

    it("limits a new or renamed organization's name to the engine's limit in the dialog, saying the limit", async () => {
      await createOrganization();
      const limitOf = async (open: () => Promise<void>): Promise<unknown[]> => {
        await open();
        const field = document.querySelector<HTMLInputElement>("nol-teamrun-rename-dialog .nol-teamrun-rename-title");
        if (Object.isNull(field))
          throw new Error("The dialog shows no name field.");
        const saveAt = async (length: number): Promise<unknown[]> => {
          field.value = "a".repeat(length);
          field.dispatchEvent(new Event("input"));
          await settle();
          return [document.querySelector<HTMLButtonElement>("nol-teamrun-rename-dialog .nol-teamrun-save")?.disabled,
            document.querySelector("nol-teamrun-rename-dialog .nol-teamrun-dialog-error")?.textContent?.trim() ?? null];
        };
        const shown = [await saveAt(Resources.organizationNameMaxLength + 1), await saveAt(Resources.organizationNameMaxLength)];
        await answerDialog("nol-teamrun-rename-dialog .nol-teamrun-cancel");
        return shown;
      };

      const created = await limitOf(async () => {
        part(find<HTMLElement>("nol-section-header", Resources.organizationsTitle), "button.nol-teamrun-new-organization").click();
        await settle();
      });
      const renamed = await limitOf(() => choose(organizationRow(organization.name), Resources.renameConversationLabel));

      const expected = [[true, Resources.formatNameTooLong(Resources.organizationNameMaxLength)], [false, null]];
      expect([created, renamed]).toEqual([expected, expected]);
      expect(new OrganizationCreateParams("a".repeat(Resources.organizationNameMaxLength), null).name).toHaveLength(Resources.organizationNameMaxLength);
      expect(() => new OrganizationCreateParams("a".repeat(Resources.organizationNameMaxLength + 1), null)).toThrow();
    });

    it("sets, changes and clears an organization's default folder from its row menu, showing the folder as the row's tooltip", async () => {
      await createOrganization(t => t.answer(MethodName.OrganizationUpdate, () => null));
      const tooltip = (): string => {
        const found = fixture.debugElement.queryAll(By.css(".nol-teamrun-organization-row")).find(t => t.nativeElement === organizationRow(organization.name));
        if (Object.isUndefined(found))
          throw new Error("The organization's row is not shown.");
        return found.injector.get(TooltipDirective).text();
      };
      const before = [await organizationMenu(organization.name), tooltip()];

      await choose(organizationRow(organization.name), Resources.setOrganizationFolderLabel);
      const unchosen = [context.folderChoices, updates().length];
      context.chosenFolder = "D:/studio";
      await choose(organizationRow(organization.name), Resources.setOrganizationFolderLabel);
      await Wait.until(() => expect(updates()).toHaveLength(1));
      context.emit(EventName.OrganizationChanged, withFolder("D:/studio").toJson());
      await settle();
      const after = [await organizationMenu(organization.name), tooltip()];
      context.chosenFolder = "E:/other";
      await choose(organizationRow(organization.name), Resources.changeOrganizationFolderLabel);
      await choose(organizationRow(organization.name), Resources.clearOrganizationFolderLabel);
      await Wait.until(() => expect(updates()).toHaveLength(3));

      expect(before).toEqual([[Resources.openOrganizationLabel, Resources.renameConversationLabel, Resources.setOrganizationFolderLabel, Resources.organizationDeleteLabel],
        organization.name]);
      expect(unchosen).toEqual([1, 0]);
      expect(after).toEqual([[Resources.openOrganizationLabel, Resources.renameConversationLabel, Resources.changeOrganizationFolderLabel, Resources.clearOrganizationFolderLabel,
        Resources.organizationDeleteLabel], "D:/studio"]);
      expect(updates()).toEqual([new OrganizationUpdateParams(organization.id, undefined, "D:/studio"),
        new OrganizationUpdateParams(organization.id, undefined, "E:/other"), new OrganizationUpdateParams(organization.id, undefined, null)]);
    });

    it("deletes an organization only after the person confirms, closes its view, lists its chats under Chats again, and deletes the last one the same way", async () => {
      const novaChat = organizationChatOf("o9", nova, labs.id);
      conversations = [novaChat];
      await createOrganization(t => t.answer(MethodName.OrganizationDelete, () => null));
      const before = chats();
      const deletes = (): string[] => context.requests.filter(t => t.method === FakeWindowPartContext.qualify(MethodName.OrganizationDelete))
        .map(t => OrganizationIdParams.fromJson(t.parameters).organizationId);

      await choose(organizationRow(labs.name), Resources.organizationDeleteLabel);
      const asked = [document.querySelector("nol-teamrun-confirm-dialog .nol-dialog-title")?.textContent, dialogText()];
      await answerDialog("nol-teamrun-confirm-dialog .nol-teamrun-cancel");
      const cancelled = deletes().length;
      await choose(organizationRow(labs.name), Resources.organizationDeleteLabel);
      await answerDialog("nol-teamrun-confirm-dialog .nol-teamrun-confirm");
      await Wait.until(() => expect(deletes()).toEqual([labs.id]));
      conversations = [novaChat.withoutOrganizationChat()];
      context.emit(EventName.OrganizationRemoved, new OrganizationIdParams(labs.id).toJson());
      context.emit(EventName.StateInvalidated, null);
      await Wait.until(() => expect(chats()).toEqual([nova.name]));

      expect(before).toEqual([]);
      expect(context.closedDocuments).toContainEqual({ name: Resources.organizationDocumentName, instance: labs.id });
      expect([asked, cancelled]).toEqual([[Resources.deleteOrganizationTitle, Resources.formatDeleteOrganizationText(labs.name)], 0]);
      const lastMenu = await organizationMenu(organization.name);
      await choose(organizationRow(organization.name), Resources.organizationDeleteLabel);
      const askedLast = dialogText();
      await answerDialog("nol-teamrun-confirm-dialog .nol-teamrun-confirm");
      await Wait.until(() => expect(deletes()).toEqual([labs.id, organization.id]));
      context.emit(EventName.OrganizationRemoved, new OrganizationIdParams(organization.id).toJson());
      await settle();
      const emptied = [headers().includes(Resources.organizationsTitle), names()];
      context.emit(EventName.OrganizationChanged, new Organization("studio", "Studio", null, 0, SampleData.timestamp, SampleData.timestamp, [SampleData.departmentType], [], []).toJson());
      await Wait.until(() => expect(names()).toEqual(["Studio"]));

      expect([names().includes(labs.name), lastMenu])
        .toEqual([false, [Resources.openOrganizationLabel, Resources.renameConversationLabel, Resources.setOrganizationFolderLabel, Resources.organizationDeleteLabel]]);
      expect([askedLast, emptied]).toEqual([Resources.formatDeleteOrganizationText(organization.name), [true, []]]);
      expect(context.closedDocuments).toContainEqual({ name: Resources.organizationDocumentName, instance: organization.id });
    });

    it("logs an organization change the engine refuses", async () => {
      await createOrganization(t => t.fail(MethodName.OrganizationUpdate, "Taken."));
      context.chosenFolder = "D:/studio";

      await choose(organizationRow(organization.name), Resources.setOrganizationFolderLabel);

      await Wait.until(() => expect(context.lines).toContain(Resources.formatOrganizationActionFailed("RuntimeRequestException: Taken.")));
    });

    const teammateMenu = async (name: string): Promise<string[]> => {
      teammateRow(name).querySelector<HTMLButtonElement>(".nol-teamrun-row-actions")?.click();
      await settle();
      const labels = texts("button[nol-menu-item] .nol-menu-item-label", itemAt([...document.querySelectorAll("nol-menu")], 0));
      await userEvent.keyboard("{Escape}");
      await settle();
      return labels;
    };
    const teammateMoveMenu = async (name: string): Promise<string[]> => {
      await choose(teammateRow(name), Resources.moveToProjectLabel);
      const labels = menuLabels();
      await userEvent.keyboard("{Escape}");
      await userEvent.keyboard("{Escape}");
      await settle();
      return labels;
    };
    const teammateTooltip = (name: string): string => {
      const found = fixture.debugElement.queryAll(By.css(".nol-teamrun-teammate-row")).find(t => t.nativeElement === teammateRow(name));
      if (Object.isUndefined(found))
        throw new Error("The teammate's row is not shown.");
      return found.injector.get(TooltipDirective).text();
    };
    const grokInFolder = grokChat.withAttachedFolder("D:/grok", at);
    const opusInProject = organizationChatOf("o6", opus).withProjectId(SampleData.project.id, at);

    it("shows where each teammate's Organization chat works on hover: its folder, its project's folder, the organization's folder or the teammate's name", async () => {
      conversations = [SampleData.conversation, grokInFolder, opusInProject];
      await createOrganization();
      const before = [teammateTooltip("Grok"), teammateTooltip("Opus 1"), teammateTooltip("Agy")];
      context.emit(EventName.OrganizationChanged, withFolder("D:/org").toJson());
      await settle();

      expect([before, teammateTooltip("Agy")]).toEqual([["D:/grok", SampleData.project.rootPath, "Agy"], "D:/org"]);
    });

    it("offers a teammate's row the chat's folder actions, opening its Organization chat first when it has none", async () => {
      conversations = [SampleData.conversation, grokInFolder, opusInProject];
      await createOrganization(t => t.answer(MethodName.OrganizationChatOpen, () => organizationChatOf("o7", agy).toJson())
        .answer(MethodName.ChatFolderAttach, u => organizationChatOf("o7", agy).withAttachedFolder(ChatFolderAttachParams.fromJson(u).folder, at).toJson())
        .answer(MethodName.ChatFolderDetach, () => grokChat.toJson())
        .answer(MethodName.ConversationMove, u => opusInProject.withProjectId(ConversationMoveParams.fromJson(u).projectId, at).toJson()));
      const menus = [await teammateMenu("Agy"), await teammateMenu("Grok"), await teammateMenu("Opus 1")];
      const moves = [await teammateMoveMenu("Agy"), await teammateMoveMenu("Grok")];
      await choose(teammateRow("Opus 1"), Resources.moveToAnotherProjectLabel);
      const opusMoves = menuLabels();
      await pick(SampleData.otherProject.name);
      await Wait.until(() => expect(context.count(MethodName.ConversationMove)).toBe(1));
      await choose(teammateRow("Grok"), Resources.moveToProjectLabel);
      await pick(Resources.moveToFolderLabel);
      const unchosen = context.folderChoices;
      await choose(teammateRow("Grok"), Resources.detachFolderLabel);
      await Wait.until(() => expect(context.count(MethodName.ChatFolderDetach)).toBe(1));
      context.chosenFolder = "D:/agy";
      await choose(teammateRow("Agy"), Resources.attachFolderLabel);
      await Wait.until(() => expect(context.count(MethodName.ChatFolderAttach)).toBe(1));
      const attached = ChatFolderAttachParams.fromJson(requestOf(MethodName.ChatFolderAttach));

      expect(menus).toEqual([[Resources.moveToProjectLabel, Resources.attachFolderLabel],
        [Resources.moveToProjectLabel, Resources.replaceFolderLabel, Resources.detachFolderLabel], [Resources.moveToAnotherProjectLabel]]);
      expect(moves).toEqual([[SampleData.project.name, SampleData.otherProject.name, Resources.moveToFolderLabel],
        [SampleData.project.name, SampleData.otherProject.name, Resources.moveToFolderLabel]]);
      expect(opusMoves).toEqual([SampleData.otherProject.name, Resources.moveToFolderLabel]);
      expect([ConversationMoveParams.fromJson(requestOf(MethodName.ConversationMove)).projectId, unchosen]).toEqual([SampleData.otherProject.id, 1]);
      expect([ConversationIdParams.fromJson(requestOf(MethodName.ChatFolderDetach)).conversationId, context.count(MethodName.OrganizationChatOpen)])
        .toEqual([grokChat.id, 1]);
      expect([attached.chatId, attached.folder]).toEqual(["o7", "D:/agy"]);
    });

    it("leaves a teammate's folder alone when the engine opens it no Organization chat", async () => {
      await createOrganization(t => t.fail(MethodName.OrganizationChatOpen, "No chat."));
      context.chosenFolder = "D:/agy";

      await choose(teammateRow("Agy"), Resources.attachFolderLabel);
      await Wait.until(() => expect(context.count(MethodName.OrganizationChatOpen)).toBe(1));
      await settle();

      expect([context.folderChoices, context.count(MethodName.ChatFolderAttach)]).toEqual([0, 0]);
    });

    it("shows each teammate's status as a dot alone before its name, named for a screen reader", async () => {
      await createOrganization();
      const dot = part(teammateRow("Grok"), "nol-teamrun-teammate-status .dot");

      expect([dot.getAttribute("role"), dot.getAttribute("aria-label"), teammateRow("Grok").querySelector("nol-teamrun-teammate-status .label")])
        .toEqual(["img", Resources.teammateStatusLabels[TeammateStatus.Idle], null]);
    });
  });

  describe("under forced colours and at 200% zoom", () => {
    it("keeps every control, state and focus ring in the projects view visible under forced colours", async () => {
      await create();
      await AccessibilityFixture.expectVisibleForcedAsync(element());
    });

    it("neither cuts, crosses nor loses a control in the projects view at 200% zoom", async () => {
      await create();
      await AccessibilityFixture.expectFitsZoomedAsync(element(), settle);
    });
  });

  describe("by keyboard and screen reader", () => {
    it("reaches every control in the projects view by keyboard, with a visible ring", async () => {
      await create();
      expect(await AccessibilityFixture.expectKeyboardAsync(element())).toBeGreaterThan(0);
    });

    it("names every control, dialog, list and image in the projects view", async () => {
      await create();
      expect(AccessibilityFixture.expectNamed(element())).toBeGreaterThan(0);
    });
  });
});
