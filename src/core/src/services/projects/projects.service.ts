/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { basename, isAbsolute, resolve } from "node:path";

import { Guid } from "@noldova/teamrun-foundation-core";
import { ChangeOperation, type DataRecord } from "@noldova/teamrun-foundation-data";
import { SqlQuery } from "@noldova/teamrun-foundation-data-sql";
import { JsonReader } from "@noldova/teamrun-foundation-json";
import { ServiceException } from "@noldova/teamrun-foundation-services";
import { ConversationIdParams, ErrorCode, Project, type ProjectIdParams, type ProjectOpenParams } from "@noldova/teamrun-protocol";

import { ChangeEntity } from "../../enums/change-entity.js";
import type { IConversationsService } from "../../interfaces/i-conversations.service.js";
import type { IProjectsService } from "../../interfaces/i-projects.service.js";
import { Resources } from "../../resources.js";
import type { DatabaseContext } from "../database-context.js";

export class ProjectsService implements IProjectsService {
  private readonly context: DatabaseContext;
  private readonly conversations: IConversationsService;

  public constructor(context: DatabaseContext, conversations: IConversationsService) {
    this.context = context;
    this.conversations = conversations;
  }

  public list(): readonly Project[] {
    return this.context.database.connection.query(new SqlQuery(Resources.selectProjects)).map(t => ProjectsService.readProject(t));
  }

  public find(projectId: string): Project | null {
    const [record] = this.context.database.connection.query(new SqlQuery(Resources.selectProjectById, [projectId]));
    if (Object.isUndefined(record))
      return null;

    return ProjectsService.readProject(record);
  }

  public open(params: ProjectOpenParams): Project {
    if (!isAbsolute(params.rootPath))
      throw new ServiceException(ErrorCode.InvalidParams, Resources.formatRootPathNotAbsolute(params.rootPath), [params.rootPath]);

    const rootPath = resolve(params.rootPath);
    return this.context.database.transaction(() => {
      const [existing] = this.context.database.connection.query(new SqlQuery(Resources.selectProjectByRootPath, [rootPath]));
      if (!Object.isUndefined(existing))
        return ProjectsService.readProject(existing);

      const project = new Project(Guid.createVersion7().toString(), ProjectsService.nameOf(rootPath), rootPath, new Date().toISOString());
      const json = JSON.stringify(project.toJson());
      const parameters = [project.id, project.rootPath, json, project.createdAt, project.createdAt];
      this.context.database.connection.execute(new SqlQuery(Resources.insertProject, parameters));
      this.context.database.changeFeed.append(ChangeEntity.Project, project.id, ChangeOperation.Insert, json);
      return project;
    });
  }

  public forget(params: ProjectIdParams): void {
    this.context.database.transaction(() => {
      const project = this.find(params.projectId);
      if (Object.isNull(project))
        throw new ServiceException(ErrorCode.NotFound, Resources.formatProjectNotFound(params.projectId), [params.projectId]);

      for (const conversation of this.conversations.list(params))
        this.conversations.delete(new ConversationIdParams(conversation.id));
      this.context.database.connection.execute(new SqlQuery(Resources.deleteProject, [params.projectId]));
      this.context.database.changeFeed.append(ChangeEntity.Project, project.id, ChangeOperation.Delete, JSON.stringify(project.toJson()));
    });
  }

  private static nameOf(rootPath: string): string {
    const name = basename(rootPath);
    return String.isNullOrWhitespace(name) ? rootPath : name;
  }

  private static readProject(record: DataRecord): Project {
    return Project.fromJson(JsonReader.parse(record.readString(Resources.jsonColumn)).toJson());
  }
}
