/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { IConversationsService, IProjectsService, IProvidersService, ITeammatesService } from "@noldova/teamrun.core";
import { type Conversation, type ConversationIdParams, type ConversationMemberParams, Harness, type Project, type ProjectIdParams, type Provider, type Teammate } from "@noldova/teamrun.protocol";
import { ChangeSubjects } from "@noldova/teamrun.runtime";

export class ChangeServices {
  public readonly projects: Project[] = [
    { id: "p1", name: "Site", rootPath: "/work/site" } as Project,
    { id: "p2", name: "Docs", rootPath: "/work/docs" } as Project
  ];
  public readonly chats: Conversation[] = [
    { id: "c1", projectId: "p1", title: "Release", responder: null } as Conversation,
    { id: "c2", projectId: "p1", title: "Bugs", responder: null } as Conversation,
    { id: "c3", projectId: "p2", title: "Guide", responder: null } as Conversation,
    { id: "c4", projectId: null, title: "Notes", responder: null } as Conversation,
    { id: "c5", projectId: null, title: "Scratch", responder: null } as Conversation
  ];
  public readonly members: [string, string][] = [["c1", "t1"], ["c2", "t1"], ["c2", "t2"]];
  public readonly folderFiles: Map<string, number> = new Map([["c5", 3]]);
  public countFiles: (conversationId: string) => number = t => this.folderFiles.get(t) ?? 0;
  public readonly teammates: Teammate[] = [
    { id: "t1", name: "Ada", role: "Reviewer", providerId: "v1", harness: Harness.Provider, model: "m1", effort: "high", speed: "fast",
      contextWindow: null } as Teammate,
    { id: "t2", name: "Bo", role: null, providerId: "v1", harness: Harness.Provider, model: null, effort: null, speed: null, mode: null,
      contextWindow: null } as Teammate
  ];
  public readonly providers: Provider[] = [{ id: "v1", label: "Claude" } as Provider, { id: "v2", label: "Codex" } as Provider];

  public get projectsService(): IProjectsService {
    return { findAsync: async (id: string) => this.projects.find(t => t.id === id) ?? null } as IProjectsService;
  }

  public get conversationsService(): IConversationsService {
    return {
      findAsync: async (id: string) => this.chats.find(t => t.id === id) ?? null,
      listAsync: async (params: ProjectIdParams) => this.chats.filter(t => t.projectId === params.projectId),
      countFolderFilesAsync: (params: ConversationIdParams) => Promise.resolve().then(() => this.countFiles(params.conversationId)),
      findMemberAsync: async (params: ConversationMemberParams) =>
        this.members.some(([chat, teammate]) => chat === params.conversationId && teammate === params.teammateId) ? params : null
    } as unknown as IConversationsService;
  }

  public get teammatesService(): ITeammatesService {
    return {
      findAsync: async (id: string) => this.teammates.find(t => t.id === id) ?? null,
      listAsync: async () => this.teammates
    } as unknown as ITeammatesService;
  }

  public get providersService(): IProvidersService {
    return { findAsync: async (id: string) => this.providers.find(t => t.id === id) ?? null } as unknown as IProvidersService;
  }

  public createSubjects(): ChangeSubjects {
    return new ChangeSubjects(this.projectsService, this.conversationsService, this.teammatesService, this.providersService);
  }
}
