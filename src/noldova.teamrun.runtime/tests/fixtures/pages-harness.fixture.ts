/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { type IModuleDatabase, type IToolDescriptor, type IToolHandler, Registration, ToolCall, ToolFailureException, type ToolResult } from "@noldova/desktop.runtime";
import "@noldova/context.core";
import { DataSource } from "@noldova/context.data";
import type { SqlConnection } from "@noldova/context.data.sql";
import { type JsonObject, JsonReader } from "@noldova/context.json";
import { Assert } from "@noldova/context.testing";
import { PageAuthor } from "@noldova/teamrun.protocol";
import { type IPagesHost, ModuleDatabaseConnection, Pages } from "@noldova/teamrun.runtime";

import { MemoryModuleDatabase } from "./memory-module-database.fixture.js";
import { TemporaryDirectory } from "./temporary-directory.fixture.js";

export class FakePagesHost implements IPagesHost {
  public chats: ReadonlySet<string> = new Set(["c1", "c2", "c3"]);
  public failure: unknown = null;
  public chatFailure: unknown = null;
  private readonly folder: string;

  public constructor(folder: string) {
    this.folder = folder;
  }

  public chatOf(call: ToolCall): string {
    if (!Object.isNull(this.failure))
      throw this.failure;
    return call.scope;
  }

  public folderOf(): string {
    return this.folder;
  }

  public authorOf(call: ToolCall): PageAuthor {
    const name = String(call.bindings["agentName"]);
    return new PageAuthor(`t-${name.toLowerCase()}`, name);
  }

  public async hasChatAsync(chatId: string): Promise<boolean> {
    if (!Object.isNull(this.chatFailure))
      throw this.chatFailure;
    return this.chats.has(chatId);
  }
}

export class PagesHarness implements Disposable {
  public static readonly show: string = "teamrun_show_page";
  public static readonly list: string = "teamrun_list_pages";
  public static readonly read: string = "teamrun_read_page";
  public static readonly edit: string = "teamrun_edit_page";

  public readonly directory: TemporaryDirectory = new TemporaryDirectory();
  public readonly database: MemoryModuleDatabase = new MemoryModuleDatabase(Pages.migrations);
  public readonly work: string = this.directory.resolve("work");
  public readonly data: string = this.directory.resolve("data");
  public readonly host: FakePagesHost = new FakePagesHost(this.work);
  public readonly lines: string[] = [];
  public pages: Pages;
  public connection: ModuleDatabaseConnection;
  private readonly handlers: Map<string, IToolHandler> = new Map<string, IToolHandler>();

  public constructor() {
    mkdirSync(this.work);
    this.connection = this.connectionOf(this.database);
    this.pages = this.open(this.connection);
  }

  public static callOf(input: JsonObject, agentName: string = "Opus", chatId: string = "c1"): ToolCall {
    return new ToolCall("s1", chatId, { agentName }, input, 30_000, new AbortController().signal);
  }

  public static answerOf(result: ToolResult): JsonReader {
    return JsonReader.parse(String(result.content[0]?.value));
  }

  public connectionOf(database: IModuleDatabase): ModuleDatabaseConnection {
    return new ModuleDatabaseConnection(new DataSource("teamrun", this.data), database);
  }

  public restart(database: IModuleDatabase): Pages {
    this.connection = this.connectionOf(database);
    return this.open(this.connection);
  }

  public open(connection: SqlConnection): Pages {
    this.pages = new Pages(connection, this.data, this.host, { write: t => this.lines.push(t) });
    this.pages.register("teamrun", this);
    return this.pages;
  }

  public register(descriptor: IToolDescriptor, handler: IToolHandler): Registration {
    this.handlers.set(descriptor.name, handler);
    return new Registration(() => undefined);
  }

  public handlerOf(name: string): IToolHandler {
    const handler = this.handlers.get(name);
    if (Object.isUndefined(handler))
      throw new Error(name);
    return handler;
  }

  public file(name: string, content: string | Buffer): string {
    const file = join(this.work, name);
    writeFileSync(file, content);
    return file;
  }

  public copyOf(chatId: string, pageId: string): string {
    return join(this.data, "pages", chatId, `${pageId}.html`);
  }

  public async callAsync(tool: string, input: JsonObject, agentName: string = "Opus", chatId: string = "c1"): Promise<JsonReader> {
    return PagesHarness.answerOf(await this.handlerOf(tool).handleAsync(PagesHarness.callOf(input, agentName, chatId)));
  }

  public async failureAsync(tool: string, input: JsonObject, agentName: string = "Opus", chatId: string = "c1"): Promise<string> {
    const failure = await Assert.throwsAsync(() => this.handlerOf(tool).handleAsync(PagesHarness.callOf(input, agentName, chatId)), ToolFailureException);
    return `${failure.failure.code} ${failure.failure.message}`;
  }

  public async outcomeAsync(tool: string, input: JsonObject, agentName: string = "Opus", chatId: string = "c1"): Promise<string> {
    try {
      await this.callAsync(tool, input, agentName, chatId);
      return "Taken";
    }
    catch (error) {
      if (error instanceof ToolFailureException)
        return `${error.failure.code} ${error.failure.message}`;
      throw error;
    }
  }

  public async showAsync(path: string = "a.html", chatId: string = "c1", agentName: string = "Opus"): Promise<string> {
    return (await this.callAsync(PagesHarness.show, { path, title: "A" }, agentName, chatId)).readNonBlankString("id");
  }

  public [Symbol.dispose](): void {
    this.database[Symbol.dispose]();
    this.directory[Symbol.dispose]();
  }
}
