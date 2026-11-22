/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */
import { type ComponentFixture, TestBed } from "@angular/core/testing";

import "@noldova/context.core";
import type { JsonValue } from "@noldova/context.json";
import { WindowPartTokens } from "@noldova/desktop.window";
import { ChatFolderAttachParams, Conversation, ConversationListParams, ConversationMoveParams, MethodName, OrganizationChat, ProjectOpenParams,
  TeammateIdParams } from "@noldova/teamrun.protocol";
import { userEvent } from "vitest/browser";

import { OrganizationCardComponent } from "../../../../src/app/components/organization-card/organization-card.component";
import { ChatStoreService } from "../../../../src/app/services/chat-store.service";
import { OrganizationLayoutService } from "../../../../src/app/services/organization-layout.service";
import { OrganizationStoreService } from "../../../../src/app/services/organization-store.service";
import { ProjectsLayoutService } from "../../../../src/app/services/projects-layout.service";
import { Resources } from "../../../../src/resources";
import { FakeWindowPartContext } from "../../../fixtures/fake-window-part-context.fixture";
import { SampleData } from "../../../fixtures/sample-data.fixture";
import { TeammateFixture } from "../../../fixtures/teammate.fixture";
import { Wait } from "../../../fixtures/wait.fixture";

describe("OrganizationCardComponent's folder", () => {
  const chat = new Conversation("org-alice", null, "Organization · Alice", SampleData.timestamp, SampleData.timestamp, false, null, null, false, null, false, [],
    false, false, null, new OrganizationChat("my-organization", "alice"));
  let context: FakeWindowPartContext;
  let fixture: ComponentFixture<OrganizationCardComponent>;
  let kept: readonly Conversation[];
  let opened: string[];
  let attachAnswer: (folder: string) => JsonValue | Promise<JsonValue>;

  const menuItems = (): HTMLButtonElement[] => [...document.querySelectorAll<HTMLButtonElement>("button[nol-menu-item]")];
  const labels = (): string[] => menuItems().map(t => t.querySelector(".nol-menu-item-label")?.textContent?.trim() ?? "");
  const menuItem = (label: string): HTMLButtonElement => {
    const found = menuItems().find(t => t.querySelector(".nol-menu-item-label")?.textContent?.trim() === label);
    if (Object.isUndefined(found))
      throw new Error(`No menu item reads ${label}.`);
    return found;
  };
  const worksIn = (): string | undefined => document.querySelector("nol-menu-group.works-in .nol-menu-label")?.textContent?.trim();
  const settle = async (): Promise<void> => {
    await fixture.whenStable();
    await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
    await fixture.whenStable();
  };
  const element = (): HTMLElement => {
    const native: unknown = fixture.nativeElement;
    if (!(native instanceof HTMLElement))
      throw new Error("The fixture has no element.");
    return native;
  };
  const openMenu = async (): Promise<void> => {
    element().querySelector<HTMLButtonElement>(".tune")?.click();
    await settle();
    await Wait.until(() => expect(menuItems().length).toBeGreaterThan(0));
  };
  const closeMenu = async (): Promise<void> => {
    await userEvent.keyboard("{Escape}");
    await Wait.until(() => expect(menuItems()).toEqual([]));
  };
  const choose = async (label: string): Promise<void> => {
    await openMenu();
    menuItem(label).click();
    await settle();
  };
  const placeOf = (): Conversation | null => ChatStoreService.of(context).organizationChatOf("alice");
  const create = async (answer: (context: FakeWindowPartContext) => void = () => undefined): Promise<void> => {
    context = SampleData.createContext();
    const data = new TeammateFixture(context);
    context.answer(MethodName.ConversationList, t => ConversationListParams.fromJson(t).projectId === SampleData.project.id ? [SampleData.conversation.toJson()]
      : kept.map(u => u.toJson()))
      .answer(MethodName.OrganizationChatOpen, t => {
        opened.push(TeammateIdParams.fromJson(t).teammateId);
        return chat.toJson();
      })
      .answer(MethodName.ChatFolderAttach, t => attachAnswer(ChatFolderAttachParams.fromJson(t).folder))
      .answer(MethodName.ChatFolderDetach, () => chat.toJson())
      .answer(MethodName.ConversationFolderCount, () => 0)
      .answer(MethodName.ConversationMove, t => chat.withProjectId(ConversationMoveParams.fromJson(t).projectId, SampleData.timestamp).toJson());
    answer(context);
    TestBed.configureTestingModule({ providers: [{ provide: WindowPartTokens.context, useValue: context }] });
    fixture = TestBed.createComponent(OrganizationCardComponent);
    fixture.componentRef.setInput("teammate", data.alice);
    fixture.autoDetectChanges();
    await Wait.until(() => expect(ChatStoreService.of(context).loaded()).toBe(true));
    await settle();
  };

  beforeEach(() => {
    kept = [];
    opened = [];
    attachAnswer = folder => chat.withAttachedFolder(folder, SampleData.timestamp).withFolder(folder).toJson();
  });

  afterEach(async () => {
    await closeMenu();
    OrganizationStoreService.release(context);
    OrganizationLayoutService.release(context);
    ChatStoreService.release(context);
    ProjectsLayoutService.release(context);
  });

  it("says the teammate's Organization chat works in its own folder, attaches the folder the person chooses, then offers to replace or detach it", async () => {
    kept = [chat];
    await create();
    await openMenu();
    const before = [worksIn(), labels().slice(-2)];
    await closeMenu();

    context.chosenFolder = "D:/work/site";
    await choose(Resources.attachFolderLabel);
    await Wait.until(() => expect(placeOf()?.attachedFolder).toBe("D:/work/site"));
    await openMenu();
    const after = [worksIn(), labels().slice(-3)];
    menuItem(Resources.detachFolderLabel).click();
    await Wait.until(() => expect(placeOf()?.attachedFolder).toBeNull());

    expect([before, after, opened]).toEqual([
      ["Alice works in its own folder", [Resources.moveToProjectLabel, Resources.attachFolderLabel]],
      ["Alice works in site", [Resources.moveToProjectLabel, Resources.replaceFolderLabel, Resources.detachFolderLabel]],
      []]);
  });

  it("opens the teammate's Organization chat first when it has none, then moves it into the project the person picks, after which only another project is offered", async () => {
    await create();
    await choose(Resources.moveToProjectLabel);
    await Wait.until(() => expect(labels()).toContain(SampleData.project.name));
    menuItem(SampleData.project.name).click();
    await Wait.until(() => expect(context.count(MethodName.ConversationMove)).toBe(1));
    await Wait.until(() => expect(placeOf()?.projectId).toBe(SampleData.project.id));
    await openMenu();

    expect([opened, ConversationMoveParams.fromJson(context.parametersOf(MethodName.ConversationMove)), worksIn(), labels().slice(-1)]).toEqual([
      ["alice"], new ConversationMoveParams("org-alice", SampleData.project.id), `Alice works in ${SampleData.project.name}`, [Resources.moveToAnotherProjectLabel]]);
  });

  it("moves the teammate's Organization chat into the folder the person picks, opening that folder as a project first", async () => {
    kept = [chat];
    await create(t => t.answer(MethodName.ProjectOpen, () => SampleData.otherProject.toJson()));
    context.chosenFolder = "D:/work/site";
    await choose(Resources.moveToProjectLabel);
    await Wait.until(() => expect(labels()).toContain(Resources.moveToFolderLabel));
    menuItem(Resources.moveToFolderLabel).click();
    await Wait.until(() => expect(placeOf()?.projectId).toBe(SampleData.otherProject.id));

    expect([ProjectOpenParams.fromJson(context.parametersOf(MethodName.ProjectOpen)), ConversationMoveParams.fromJson(context.parametersOf(MethodName.ConversationMove))])
      .toEqual([new ProjectOpenParams("D:/work/site"), new ConversationMoveParams("org-alice", SampleData.otherProject.id)]);
  });

  it("says the chat works in its own folder once it moves into a project the window doesn't list", async () => {
    kept = [chat];
    await create();
    await ChatStoreService.of(context).moveConversation("org-alice", "gone");
    await openMenu();

    expect([placeOf()?.projectId, worksIn()]).toEqual(["gone", "Alice works in its own folder"]);
  });

  it("moves and attaches nothing while the teammate's Organization chat can't be opened, saying why", async () => {
    await create(t => t.answer(MethodName.OrganizationChatOpen, () => Promise.reject(new Error("The teammate is gone."))));
    context.chosenFolder = "D:/work/site";
    await choose(Resources.attachFolderLabel);
    await Wait.until(() => expect(OrganizationStoreService.of(context).actionError()).toBe("The teammate is gone."));
    await choose(Resources.moveToProjectLabel);
    await Wait.until(() => expect(labels()).toContain(SampleData.project.name));
    menuItem(SampleData.project.name).click();
    await settle();
    await choose(Resources.moveToProjectLabel);
    await Wait.until(() => expect(labels()).toContain(Resources.moveToFolderLabel));
    menuItem(Resources.moveToFolderLabel).click();
    await settle();

    expect([context.count(MethodName.OrganizationChatOpen), context.count(MethodName.ChatFolderAttach), context.count(MethodName.ConversationMove),
      context.count(MethodName.ProjectOpen), placeOf()]).toEqual([3, 0, 0, 0, null]);
  });

  it("offers the projects to move into in the order the Projects page keeps", async () => {
    await create(t => t.answer(MethodName.ProjectList, () => [SampleData.project, SampleData.otherProject].map(u => SampleData.listed(u)))
      .answer(MethodName.ProjectsLayoutRead, () => ({ [Resources.projectOrderField]: [SampleData.otherProject.id, SampleData.project.id] })));
    await choose(Resources.moveToProjectLabel);

    await Wait.until(() => expect(labels().filter(t => [SampleData.project.name, SampleData.otherProject.name].includes(t)))
      .toEqual([SampleData.otherProject.name, SampleData.project.name]));
    await userEvent.keyboard("{Escape}");
  });

  it("shows the chat's refusal while a background command runs in its folder, and keeps the folder it had", async () => {
    kept = [chat];
    attachAnswer = () => Promise.reject(new Error("A background command still runs in this chat's folder."));
    await create();
    context.chosenFolder = "D:/work/site";
    await choose(Resources.attachFolderLabel);

    await Wait.until(() => expect(context.shownNotices(Resources.chatActionFailedNotice).map(t => t.text))
      .toEqual(["A background command still runs in this chat's folder."]));
    expect(placeOf()?.attachedFolder).toBeNull();
  });
});
