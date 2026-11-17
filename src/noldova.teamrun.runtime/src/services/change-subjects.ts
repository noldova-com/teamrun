/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { type IPermissionDetail, PermissionDetailKind, ToolFailure, ToolFailureCode, ToolFailureException } from "@noldova/desktop.runtime";
import type { JsonObject, JsonValue } from "@noldova/context.json";
import "@noldova/context.core";
import type { IConversationsService, IProjectsService, IProvidersService, ITeammatesService } from "@noldova/teamrun.core";
import { ConversationIdParams, ConversationMemberParams, MethodName, ProjectIdParams, type Teammate } from "@noldova/teamrun.protocol";

import { ChangeView } from "../models/change-view.js";
import type { TeamRunChange } from "../models/teamrun-change.js";
import { Resources } from "../resources.js";

export class ChangeSubjects {
  private readonly projects: IProjectsService;
  private readonly conversations: IConversationsService;
  private readonly teammates: ITeammatesService;
  private readonly providers: IProvidersService;
  private readonly views: ReadonlyMap<MethodName, (payload: Readonly<Record<string, JsonValue>>) => Promise<ChangeView | null>>;

  public constructor(projects: IProjectsService, conversations: IConversationsService, teammates: ITeammatesService, providers: IProvidersService) {
    this.projects = projects;
    this.conversations = conversations;
    this.teammates = teammates;
    this.providers = providers;
    this.views = new Map<MethodName, (payload: Readonly<Record<string, JsonValue>>) => Promise<ChangeView | null>>([
      [MethodName.ProjectForget, t => this.projectOfAsync(t)],
      [MethodName.ConversationDelete, t => this.chatOfAsync(t, Resources.formatDeleteChatRequest, true)],
      [MethodName.ConversationCancel, t => this.chatOfAsync(t, Resources.formatCancelRepliesRequest, false)],
      [MethodName.ConversationRemoveMember, t => this.memberOfAsync(t)],
      [MethodName.TeammateCreate, t => this.newTeammateOfAsync(t)],
      [MethodName.TeammateUpdate, t => this.changedTeammateOfAsync(t)],
      [MethodName.TeammateDelete, t => this.teammateOfAsync(t)]
    ]);
  }

  public async clearedOfAsync(change: TeamRunChange, input: JsonObject): Promise<Readonly<Record<string, JsonValue>>> {
    if (change.method !== MethodName.TeammateUpdate)
      return {};

    const changesProvider = Object.hasOwn(input, Resources.providerIdArgument);
    const changesModel = changesProvider || Object.hasOwn(input, Resources.modelArgument);
    const bound = changesModel || [Resources.effortArgument, Resources.contextWindowArgument].some(t => Object.hasOwn(input, t));
    const teammate = bound ? await this.teammates.findAsync(input[Resources.teammateIdArgument] as string) : null;
    return {
      ...changesModel ? { [Resources.speedField]: null } : {},
      ...changesProvider ? { [Resources.modeField]: null, [Resources.contextWindowField]: null } : {},
      ...Object.isNull(teammate) ? {} : { [Resources.expectedProviderIdField]: teammate.providerId }
    };
  }

  public async viewOfAsync(change: TeamRunChange, payload: Readonly<Record<string, JsonValue>>): Promise<ChangeView | null> {
    return await this.views.get(change.method)!(payload);
  }

  public async countFilesOfAsync(conversationId: string): Promise<number> {
    try {
      return await this.conversations.countFolderFilesAsync(new ConversationIdParams(conversationId));
    }
    catch {
      throw new ToolFailureException(new ToolFailure(ToolFailureCode.Refused, Resources.chatFilesNotCounted));
    }
  }

  private async projectOfAsync(payload: Readonly<Record<string, JsonValue>>): Promise<ChangeView | null> {
    const project = await this.projects.findAsync(payload[Resources.projectIdField] as string);
    if (Object.isNull(project))
      return null;

    const chats = (await this.conversations.listAsync(new ProjectIdParams(project.id))).length;
    return new ChangeView(project.id, Resources.formatForgetProjectRequest(project.name, chats), [
      ChangeSubjects.detail(Resources.projectLabel, project.name),
      ChangeSubjects.detail(Resources.folderLabel, project.rootPath, PermissionDetailKind.Code),
      ChangeSubjects.detail(Resources.chatsLabel, String(chats))
    ], JSON.stringify([project.name, project.rootPath, chats]));
  }

  private async chatOfAsync(payload: Readonly<Record<string, JsonValue>>, format: (title: string, files: number) => string, countsFiles: boolean): Promise<ChangeView | null> {
    const chat = await this.conversations.findAsync(payload[Resources.conversationIdField] as string);
    if (Object.isNull(chat))
      return null;

    const project = Object.isNull(chat.projectId) ? null : await this.projects.findAsync(chat.projectId);
    const files = countsFiles && Object.isNull(chat.projectId) ? await this.countFilesOfAsync(chat.id) : 0;
    return new ChangeView(chat.id, format(chat.title, files), [
      ChangeSubjects.detail(Resources.chatLabel, chat.title),
      ...Object.isNull(project) ? [] : [ChangeSubjects.detail(Resources.projectLabel, project.name)],
      ...files === 0 ? [] : [ChangeSubjects.detail(Resources.filesLabel, String(files))]
    ], JSON.stringify([chat.title, project?.name ?? null, files]));
  }

  private async memberOfAsync(payload: Readonly<Record<string, JsonValue>>): Promise<ChangeView | null> {
    const params = new ConversationMemberParams(payload[Resources.conversationIdField] as string, payload[Resources.teammateIdField] as string);
    const chat = await this.conversations.findAsync(params.conversationId);
    const teammate = await this.teammates.findAsync(params.teammateId);
    if (Object.isNull(chat) || Object.isNull(teammate) || Object.isNull(await this.conversations.findMemberAsync(params)))
      return null;

    return new ChangeView(`${chat.id}${Resources.nameSeparator}${teammate.id}`, Resources.formatRemoveTeammateRequest(teammate.name, chat.title), [
      ChangeSubjects.detail(Resources.teammateLabel, teammate.name),
      ChangeSubjects.detail(Resources.chatLabel, chat.title)
    ], JSON.stringify([teammate.name, chat.title]));
  }

  private async newTeammateOfAsync(payload: Readonly<Record<string, JsonValue>>): Promise<ChangeView | null> {
    const provider = await this.providers.findAsync(payload[Resources.providerIdField] as string);
    if (Object.isNull(provider))
      return null;

    const name = payload[Resources.nameField] as string;
    return new ChangeView(name, Resources.formatCreateTeammateRequest(name), [
      ChangeSubjects.detail(Resources.nameLabel, name, PermissionDetailKind.AgentText),
      ...ChangeSubjects.optional(Resources.roleLabel, payload[Resources.roleField] as string | null, PermissionDetailKind.AgentText),
      ChangeSubjects.detail(Resources.providerLabel, provider.label),
      ...ChangeSubjects.optional(Resources.modelLabel, payload[Resources.modelField] as string | null, PermissionDetailKind.AgentText),
      ...ChangeSubjects.optional(Resources.effortLabel, payload[Resources.effortField] as string | null, PermissionDetailKind.AgentText),
      ...ChangeSubjects.optional(Resources.contextWindowLabel, ChangeSubjects.windowOf(payload[Resources.contextWindowField] as number | null | undefined ?? null),
        PermissionDetailKind.AgentText)
    ], JSON.stringify([provider.label]));
  }

  private async changedTeammateOfAsync(payload: Readonly<Record<string, JsonValue>>): Promise<ChangeView | null> {
    const teammate = await this.teammates.findAsync(payload[Resources.teammateIdField] as string);
    if (Object.isNull(teammate))
      return null;
    const valueOf = (field: string, now: string | null): string | null => Object.hasOwn(payload, field) ? payload[field] as string | null : now;
    const providerId = valueOf(Resources.providerIdField, teammate.providerId) as string;
    const provider = await this.providers.findAsync(providerId);
    if (Object.isNull(provider) && providerId !== teammate.providerId)
      return null;

    const kindOf = (field: string, now: string | null): PermissionDetailKind =>
      valueOf(field, now) === now ? PermissionDetailKind.Text : PermissionDetailKind.AgentText;
    const shown = (label: string, field: string, now: string | null): readonly IPermissionDetail[] =>
      ChangeSubjects.optional(label, valueOf(field, now), kindOf(field, now));
    const window = Object.hasOwn(payload, Resources.contextWindowField) ? payload[Resources.contextWindowField] as number | null : teammate.contextWindow;
    return new ChangeView(teammate.id, Resources.formatUpdateTeammateRequest(teammate.name), [
      ChangeSubjects.detail(Resources.teammateLabel, teammate.name),
      ...shown(Resources.nameLabel, Resources.nameField, teammate.name),
      ...shown(Resources.roleLabel, Resources.roleField, teammate.role),
      ChangeSubjects.detail(Resources.providerLabel, provider?.label ?? Resources.noProviderValue),
      ...shown(Resources.modelLabel, Resources.modelField, teammate.model),
      ...shown(Resources.effortLabel, Resources.effortField, teammate.effort),
      ...ChangeSubjects.optional(Resources.contextWindowLabel, ChangeSubjects.windowOf(window),
        window === teammate.contextWindow ? PermissionDetailKind.Text : PermissionDetailKind.AgentText)
    ], ChangeSubjects.stateOf(teammate));
  }

  private async teammateOfAsync(payload: Readonly<Record<string, JsonValue>>): Promise<ChangeView | null> {
    const teammate = await this.teammates.findAsync(payload[Resources.teammateIdField] as string);
    if (Object.isNull(teammate))
      return null;

    return new ChangeView(teammate.id, Resources.formatDeleteTeammateRequest(teammate.name), [
      ChangeSubjects.detail(Resources.teammateLabel, teammate.name),
      ...ChangeSubjects.optional(Resources.roleLabel, teammate.role, PermissionDetailKind.Text)
    ], ChangeSubjects.stateOf(teammate));
  }

  private static stateOf(teammate: Teammate): string {
    return JSON.stringify([teammate.name, teammate.role, teammate.providerId, teammate.harness, teammate.model, teammate.effort, teammate.speed,
      teammate.contextWindow]);
  }

  private static windowOf(tokens: number | null): string | null {
    return Object.isNull(tokens) ? null : Resources.formatContextWindowTokens(tokens);
  }

  private static optional(label: string, value: string | null, kind: PermissionDetailKind): readonly IPermissionDetail[] {
    return Object.isNull(value) ? [] : [ChangeSubjects.detail(label, value, kind)];
  }

  private static detail(label: string, value: string, kind: PermissionDetailKind = PermissionDetailKind.Text): IPermissionDetail {
    return { label, kind, value };
  }
}
