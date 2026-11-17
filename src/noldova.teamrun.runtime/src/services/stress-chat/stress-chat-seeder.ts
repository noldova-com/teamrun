/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { stat } from "node:fs/promises";
import { join } from "node:path";
import type { Writable } from "node:stream";

import { type DataDirectory, ModuleDatabase, OwnershipLock } from "@noldova/desktop.runtime";
import { AttachmentStore, ConversationsService, DatabaseContext, DraftsService, FolderCheckTimings, FolderProbe, MessagesService, NodeTimer, ProjectsService }
  from "@noldova/teamrun.core";
import { DataSource, DbContextOptionsBuilder } from "@noldova/context.data";
import { ConversationCreateParams, ConversationListParams, type MessageAttachment, MessageListParams, type Project, ProjectIdParams, ProjectOpenParams }
  from "@noldova/teamrun.protocol";

import { RuntimePartException } from "../../exceptions/runtime-part.exception.js";
import { Resources } from "../../resources.js";
import { HostedMigrations } from "../hosted-migrations.js";
import { ModuleDatabaseProvider } from "../module-database-provider.js";
import { StressChatComposer } from "./stress-chat-composer.js";
import { StressChatProject } from "./stress-chat-project.js";
import { StressChatResources } from "./stress-chat-resources.js";

export class StressChatSeeder {
  private readonly directory: DataDirectory;
  private readonly output: Writable;

  public constructor(directory: DataDirectory, output: Writable) {
    this.directory = directory;
    this.output = output;
  }

  public async seedAsync(pairs: number): Promise<Project> {
    if (OwnershipLock.isOwned(this.directory))
      throw new RuntimePartException(StressChatResources.formatOwned(this.directory.root));

    const resources = new AsyncDisposableStack();
    try {
      resources.use(OwnershipLock.acquire(this.directory));
      const database = resources.use(await ModuleDatabase.openAsync(this.directory, StressChatResources.moduleId, HostedMigrations.all, new Date(), this.output));
      const folder = this.directory.locateModuleFolder(StressChatResources.moduleId);
      const options = new DbContextOptionsBuilder().use(new ModuleDatabaseProvider(database), new DataSource(Resources.dataSourceName, folder));
      return await this.writeAsync(resources.use(DatabaseContext.attach(options, folder)), folder, pairs);
    }
    finally {
      await resources.disposeAsync();
    }
  }

  private async writeAsync(context: DatabaseContext, folder: string, pairs: number): Promise<Project> {
    const attachments = new AttachmentStore(folder);
    const drafts = new DraftsService(context, attachments, this.output);
    const conversations = new ConversationsService(context, drafts);
    const projects = new ProjectsService(context, conversations, drafts, null, new FolderProbe(stat, FolderCheckTimings.createDefault(), new NodeTimer()), this.output);
    const messages = new MessagesService(context);
    const root = join(folder, StressChatResources.projectFolderName);
    const replaced = (await projects.listProjectsAsync()).filter(t => t.rootPath === root);
    const earlier: MessageAttachment[] = [];
    for (const old of replaced)
      for (const conversation of await conversations.listAsync(new ConversationListParams(old.id)))
        for (const message of await messages.listAsync(new MessageListParams(conversation.id, null)))
          earlier.push(...message.attachments);
    const saved = attachments.save(new StressChatProject(root).write());
    const project = await context.database.connection.runInTransactionAsync(async transaction => {
      for (const old of replaced)
        await projects.forgetAsync(new ProjectIdParams(old.id), transaction);
      const opened = await projects.openAsync(new ProjectOpenParams(root), transaction);
      const conversation = await conversations.createAsync(new ConversationCreateParams(opened.id, StressChatResources.formatTitle(pairs)), transaction);
      for (const message of new StressChatComposer(conversation.id, root, saved).compose(pairs, new Date()))
        await messages.insertAsync(message, transaction);
      return opened;
    });
    attachments.discard(earlier);
    return project;
  }
}
