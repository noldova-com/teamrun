/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { join, sep } from "node:path";

import { Guid } from "@noldova/teamrun-foundation-core";
import { ChangeOperation } from "@noldova/teamrun-foundation-data";
import { SqlQuery } from "@noldova/teamrun-foundation-data-sql";
import { ServiceException } from "@noldova/teamrun-foundation-services";
import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { ChangeEntity, ConversationsService, DatabaseContext, ProjectsService } from "@noldova/teamrun-core";
import { ConversationCreateParams, ErrorCode, Project, ProjectIdParams, ProjectOpenParams } from "@noldova/teamrun-protocol";

import { TemporaryDataDirectory } from "../../fixtures/temporary-data-directory.fixture.js";

@TestClass
export class ProjectsServiceTests {
  @TestMethod
  public listsNoProjectsAtFirst(): void {
    using directory = new TemporaryDataDirectory();
    using context = DatabaseContext.open(directory.path);
    const service = new ProjectsService(context, new ConversationsService(context));

    Assert.areEqual(0, service.list().length);
  }

  @TestMethod
  public opensAFolderCreatingTheProjectOnce(): void {
    using directory = new TemporaryDataDirectory();
    using context = DatabaseContext.open(directory.path);
    const service = new ProjectsService(context, new ConversationsService(context));
    const rootPath = join(directory.path, "workspace", "alpha");

    const project = service.open(new ProjectOpenParams(rootPath));
    const reopened = service.open(new ProjectOpenParams(rootPath + sep));

    Assert.areEqual(7, Guid.parse(project.id).version);
    Assert.areEqual("alpha", project.name);
    Assert.areEqual(rootPath, project.rootPath);
    Assert.isFalse(Number.isNaN(Date.parse(project.createdAt)));
    Assert.areEqual(project.id, reopened.id);
    Assert.areEqual(project.id, service.list()[0]?.id);
    Assert.areEqual(1, service.list().length);
    const changes = context.database.changeFeed.readAfter(0);
    Assert.areEqual(1, changes.length);
    Assert.areEqual(ChangeEntity.Project, changes[0]?.entity);
    Assert.areEqual(project.id, changes[0]?.entityId);
    Assert.areEqual(ChangeOperation.Insert, changes[0]?.operation);
    Assert.areEqual(JSON.stringify(project.toJson()), changes[0]?.payload);
  }

  @TestMethod
  public findsAProjectById(): void {
    using directory = new TemporaryDataDirectory();
    using context = DatabaseContext.open(directory.path);
    const service = new ProjectsService(context, new ConversationsService(context));
    const project = service.open(new ProjectOpenParams(join(directory.path, "alpha")));

    Assert.areEqual(project.id, service.find(project.id)?.id);
    Assert.isNull(service.find("nope"));
  }

  @TestMethod
  public listsProjectsInCreationOrder(): void {
    using directory = new TemporaryDataDirectory();
    using context = DatabaseContext.open(directory.path);
    const service = new ProjectsService(context, new ConversationsService(context));
    const first = service.open(new ProjectOpenParams(join(directory.path, "first")));
    const second = service.open(new ProjectOpenParams(join(directory.path, "second")));

    Assert.areEqual([first.id, second.id].join(","), service.list().map(t => t.id).join(","));
  }

  @TestMethod
  public preservesInsertionOrderWhenCreationTimesTie(): void {
    using directory = new TemporaryDataDirectory();
    using context = DatabaseContext.open(directory.path);
    const service = new ProjectsService(context, new ConversationsService(context));
    const timestamp = "2026-09-14T00:00:00.000Z";
    const first = new Project("00000000-0000-7000-8000-000000000002", "first", join(directory.path, "first"), timestamp);
    const second = new Project("00000000-0000-7000-8000-000000000001", "second", join(directory.path, "second"), timestamp);
    for (const project of [first, second])
      context.database.connection.execute(new SqlQuery("INSERT INTO projects (id, rootPath, json, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?)",
        [project.id, project.rootPath, JSON.stringify(project.toJson()), timestamp, timestamp]));

    Assert.areEqual([first.id, second.id].join(","), service.list().map(t => t.id).join(","));
  }

  @TestMethod
  public namesARootFolderByItsPath(): void {
    using directory = new TemporaryDataDirectory();
    using context = DatabaseContext.open(directory.path);
    const root = resolveRoot(directory.path);

    const project = new ProjectsService(context, new ConversationsService(context)).open(new ProjectOpenParams(root));

    Assert.areEqual(root, project.name);
  }

  @TestMethod
  public rejectsARelativeRootPath(): void {
    using directory = new TemporaryDataDirectory();
    using context = DatabaseContext.open(directory.path);

    const service = new ProjectsService(context, new ConversationsService(context));
    const failure = Assert.throws(() => service.open(new ProjectOpenParams("relative/folder")), ServiceException);

    Assert.areEqual(ErrorCode.InvalidParams, failure.info.name);
    Assert.isTrue(failure.message.includes("relative/folder"));
  }

  @TestMethod
  public forgetsAProjectAndLogsTheDeletion(): void {
    using directory = new TemporaryDataDirectory();
    using context = DatabaseContext.open(directory.path);
    const service = new ProjectsService(context, new ConversationsService(context));
    const project = service.open(new ProjectOpenParams(join(directory.path, "alpha")));

    service.forget(new ProjectIdParams(project.id));

    Assert.areEqual(0, service.list().length);
    const changes = context.database.changeFeed.readAfter(0);
    Assert.areEqual(2, changes.length);
    Assert.areEqual(ChangeOperation.Delete, changes[1]?.operation);
    Assert.areEqual(JSON.stringify(project.toJson()), changes[1]?.payload);
    Assert.areEqual(ErrorCode.NotFound, Assert.throws(() => service.forget(new ProjectIdParams(project.id)), ServiceException).info.name);
  }

  @TestMethod
  public forgetsAProjectWithItsConversations(): void {
    using directory = new TemporaryDataDirectory();
    using context = DatabaseContext.open(directory.path);
    const conversations = new ConversationsService(context);
    const service = new ProjectsService(context, conversations);
    const project = service.open(new ProjectOpenParams(join(directory.path, "alpha")));
    const kept = service.open(new ProjectOpenParams(join(directory.path, "beta")));
    conversations.create(new ConversationCreateParams(project.id, "one"));
    conversations.create(new ConversationCreateParams(project.id, "two"));
    conversations.create(new ConversationCreateParams(kept.id, "three"));

    service.forget(new ProjectIdParams(project.id));

    Assert.areEqual(1, service.list().length);
    Assert.areEqual(0, conversations.list(new ProjectIdParams(project.id)).length);
    Assert.areEqual(1, conversations.list(new ProjectIdParams(kept.id)).length);
    const [count] = context.database.connection.query(new SqlQuery("SELECT COUNT(*) AS count FROM conversations", []));
    Assert.areEqual(1, count?.readInteger("count"));
  }
}

function resolveRoot(path: string): string {
  return path.slice(0, path.indexOf(sep) + 1);
}
