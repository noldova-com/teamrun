/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { stat } from "node:fs/promises";

import { type DataDirectory, ModuleDatabase } from "@noldova/desktop.runtime";
import { ConversationsService, DatabaseContext, FolderCheckTimings, FolderProbe, MessagesService, NodeTimer, ProjectsService } from "@noldova/teamrun.core";
import { DataSource, DbContextOptionsBuilder } from "@noldova/context.data";
import { type Conversation, type Message, MessageListParams, type Project, ProjectIdParams } from "@noldova/teamrun.protocol";
import { HostedMigrations, ModuleDatabaseProvider } from "@noldova/teamrun.runtime";

import { RecordingOutput } from "./recording-output.fixture.js";

export class SeededChat {
  private static readonly MODULE_ID: string = "teamrun";

  public readonly projects: readonly Project[];
  public readonly conversations: readonly Conversation[];
  public readonly messages: readonly Message[];

  private constructor(projects: readonly Project[], conversations: readonly Conversation[], messages: readonly Message[]) {
    this.projects = projects;
    this.conversations = conversations;
    this.messages = messages;
  }

  public static async readAsync(directory: DataDirectory): Promise<SeededChat> {
    using database = await ModuleDatabase.openAsync(directory, SeededChat.MODULE_ID, HostedMigrations.all, new Date(), new RecordingOutput());
    const folder = directory.locateModuleFolder(SeededChat.MODULE_ID);
    await using context = DatabaseContext.attach(new DbContextOptionsBuilder().use(new ModuleDatabaseProvider(database), new DataSource(SeededChat.MODULE_ID, folder)), folder);
    const conversations = new ConversationsService(context);
    const messages = new MessagesService(context);
    const projects = await new ProjectsService(context, conversations, null, null, new FolderProbe(stat, FolderCheckTimings.createDefault(), new NodeTimer()), null).listProjectsAsync();
    const chats = (await Promise.all(projects.map(async t => conversations.listAsync(new ProjectIdParams(t.id))))).flat();
    const chatMessages = await Promise.all(chats.map(async t => messages.listAsync(new MessageListParams(t.id, null))));
    return new SeededChat(projects, chats, chatMessages.flat());
  }
}
