/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { basename, isAbsolute, resolve } from "node:path";

import "@noldova/context.core";
import { ChangeOperation, type DataRecord } from "@noldova/context.data";
import { SqlQuery, type SqlTransaction } from "@noldova/context.data.sql";
import { JsonReader, type JsonObject } from "@noldova/context.json";
import { ServiceException } from "@noldova/teamrun.services";
import { type Conversation, ConversationIdParams, ConversationListParams, ErrorCode, Event, EventName, Project, ProjectFolderChange, type ProjectIdParams, ProjectListing, type ProjectOpenParams,
  type ProjectsLayoutSaveParams } from "@noldova/teamrun.protocol";

import { ChangeEntity } from "../../enums/change-entity.js";
import { FolderState } from "../../enums/folder-state.js";
import type { IConversationsService } from "../../interfaces/i-conversations.service.js";
import type { IDraftsService } from "../../interfaces/i-drafts.service.js";
import type { IEventSink } from "../../interfaces/i-event-sink.js";
import type { ILog } from "../../interfaces/i-log.js";
import type { IProjectsService } from "../../interfaces/i-projects.service.js";
import { Guid } from "../../models/guid.js";
import { Resources } from "../../resources.js";
import type { DatabaseContext } from "../database-context.js";
import type { FolderProbe } from "./folder-probe.js";

export class ProjectsService implements IProjectsService {
  private readonly context: DatabaseContext;
  private readonly conversations: IConversationsService;
  private readonly drafts: IDraftsService | null;
  private readonly events: IEventSink | null;
  private readonly folders: FolderProbe;
  private readonly log: ILog | null;
  private readonly missingFolders: Set<string> = new Set();
  private readonly keptChecks: Map<string, number> = new Map();
  private checks: number = 0;

  public constructor(context: DatabaseContext, conversations: IConversationsService, drafts: IDraftsService | null, events: IEventSink | null,
    folders: FolderProbe, log: ILog | null) {
    this.context = context;
    this.conversations = conversations;
    this.drafts = drafts;
    this.events = events;
    this.folders = folders;
    this.log = log;
  }

  public async listProjectsAsync(transaction?: SqlTransaction): Promise<readonly Project[]> {
    return (await (transaction ?? this.context.database.connection).queryAsync(new SqlQuery(Resources.selectProjects))).map(t => ProjectsService.readProject(t));
  }

  public async listAsync(): Promise<readonly ProjectListing[]> {
    const projects = await this.listProjectsAsync();
    await this.folders.withinListWaitAsync(Promise.all(projects.map(t => this.checkFolderAsync(t.rootPath, t.id))));
    return projects.map(t => new ProjectListing(t, this.missingFolders.has(t.id)));
  }

  public async checkFolderAsync(path: string, projectId: string | null): Promise<FolderState> {
    const check = ++this.checks;
    const state = await this.folders.checkAsync(path);
    if (!Object.isNull(projectId) && (this.keptChecks.get(projectId) ?? 0) < check) {
      this.keptChecks.set(projectId, check);
      this.noteFolder(projectId, state !== FolderState.Present);
    }
    return state;
  }

  public checkLinkedFolderAsync(path: string): Promise<FolderState> {
    return this.folders.checkLinkedAsync(path);
  }

  public async findAsync(projectId: string, transaction?: SqlTransaction): Promise<Project | null> {
    const [record] = await (transaction ?? this.context.database.connection).queryAsync(new SqlQuery(Resources.selectProjectById, [projectId]));
    if (Object.isUndefined(record))
      return null;

    return ProjectsService.readProject(record);
  }

  public async openAsync(params: ProjectOpenParams, transaction?: SqlTransaction): Promise<Project> {
    if (!isAbsolute(params.rootPath))
      throw new ServiceException(ErrorCode.InvalidParams, Resources.formatRootPathNotAbsolute(params.rootPath), [params.rootPath]);

    const rootPath = resolve(params.rootPath);
    const opened = Object.isUndefined(transaction)
      ? await this.context.database.connection.runInTransactionAsync(t => this.openRecordAsync(rootPath, t))
      : await this.openRecordAsync(rootPath, transaction);
    void this.checkFolderAsync(opened.rootPath, opened.id).catch(error => this.log?.write(Resources.formatFolderCheckFailed(opened.rootPath, String(error))));
    return opened;
  }

  private async openRecordAsync(rootPath: string, transaction: SqlTransaction): Promise<Project> {
    const [existing] = await transaction.queryAsync(new SqlQuery(Resources.selectProjectByRootPath, [rootPath]));
    if (!Object.isUndefined(existing))
      return ProjectsService.readProject(existing);

    const project = new Project(Guid.createVersion7().toString(), ProjectsService.nameOf(rootPath), rootPath, new Date().toISOString());
    const json = JSON.stringify(project.toJson());
    const parameters = [project.id, project.rootPath, json, project.createdAt, project.createdAt];
    await transaction.executeAsync(new SqlQuery(Resources.insertProject, parameters));
    await this.context.database.changeFeed.appendAsync(ChangeEntity.Project, project.id, ChangeOperation.Insert, json, transaction);
    return project;
  }

  public async forgetAsync(params: ProjectIdParams, transaction?: SqlTransaction): Promise<readonly string[]> {
    const deleted = Object.isUndefined(transaction)
      ? await this.context.database.connection.runInTransactionAsync(t => this.forgetRecordAsync(params, t))
      : await this.forgetRecordAsync(params, transaction);
    this.missingFolders.delete(params.projectId);
    this.keptChecks.set(params.projectId, ++this.checks);
    for (const [conversation, sent] of deleted) {
      this.drafts?.removeChatFiles(conversation.id);
      this.drafts?.removeSentFiles(conversation.id, sent);
    }
    return deleted.map(([t]) => t.id);
  }

  private async forgetRecordAsync(params: ProjectIdParams, transaction: SqlTransaction): Promise<readonly (readonly [Conversation, readonly string[]])[]> {
    const project = await this.findAsync(params.projectId, transaction);
    if (Object.isNull(project))
      throw new ServiceException(ErrorCode.NotFound, Resources.formatProjectNotFound(params.projectId), [params.projectId]);

    const conversations = await this.conversations.listAsync(new ConversationListParams(params.projectId), transaction);
    const deleted: (readonly [Conversation, readonly string[]])[] = [];
    for (const conversation of conversations) {
      const sent = await transaction.queryAsync(new SqlQuery(Resources.selectChatAttachmentPaths, [conversation.id]));
      deleted.push([conversation, sent.map(t => t.readString(Resources.pathColumn))]);
      await this.conversations.deleteAsync(new ConversationIdParams(conversation.id), transaction);
    }
    await transaction.executeAsync(new SqlQuery(Resources.deleteProject, [params.projectId]));
    await this.context.database.changeFeed.appendAsync(ChangeEntity.Project, project.id, ChangeOperation.Delete, JSON.stringify(project.toJson()), transaction);
    return deleted;
  }

  public async readLayoutAsync(transaction?: SqlTransaction): Promise<JsonObject | null> {
    const [record] = await (transaction ?? this.context.database.connection).queryAsync(new SqlQuery(Resources.selectPreference, [Resources.projectsLayoutPreference]));
    return Object.isUndefined(record) ? null : JsonReader.parse(record.readString(Resources.jsonColumn)).toJson();
  }

  public async saveLayoutAsync(params: ProjectsLayoutSaveParams): Promise<JsonObject> {
    return this.context.database.connection.runInTransactionAsync(async transaction => {
      const previous = await this.readLayoutAsync(transaction);
      if (params.onlyIfNone && !Object.isNull(previous))
        return previous;
      const json = JSON.stringify(params.layout);
      await transaction.executeAsync(new SqlQuery(Resources.upsertPreference, [Resources.projectsLayoutPreference, json, new Date().toISOString()]));
      await this.context.database.changeFeed.appendAsync(ChangeEntity.Preference, Resources.projectsLayoutPreference,
        Object.isNull(previous) ? ChangeOperation.Insert : ChangeOperation.Update, json, transaction);
      return params.layout;
    });
  }

  private noteFolder(projectId: string, missing: boolean): void {
    if (this.missingFolders.has(projectId) === missing)
      return;
    if (missing)
      this.missingFolders.add(projectId);
    else
      this.missingFolders.delete(projectId);
    this.events?.publish(new Event(EventName.ProjectFolderChanged, new ProjectFolderChange(projectId, missing).toJson()));
  }

  private static nameOf(rootPath: string): string {
    const name = basename(rootPath);
    return String.isNullOrWhitespace(name) ? rootPath : name;
  }

  private static readProject(record: DataRecord): Project {
    return Project.fromJson(JsonReader.parse(record.readString(Resources.jsonColumn)).toJson());
  }
}
