/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { createServer, type Server } from "node:http";

import type { EventChannel, IModuleLog, IRuntimePartContext, IToolDescriptor, IToolsContext, Migration } from "@noldova/desktop.runtime";
import type { SqlConnection } from "@noldova/context.data.sql";
import { type Page, PageEventName, PageMethodName } from "@noldova/teamrun.protocol";

import type { IPagesClock } from "../../interfaces/pages/i-pages-clock.js";
import type { IPagesHost } from "../../interfaces/pages/i-pages-host.js";
import { CanvasStore } from "./canvas-store.js";
import { CanvasTool } from "./canvas-tool.js";
import { CanvasTools } from "./canvas-tools.js";
import { PageFiles } from "./page-files.js";
import { PageMethod } from "./page-method.js";
import { PageOrigins } from "./page-origins.js";
import { PagePing } from "./page-ping.js";
import { PageServer } from "./page-server.js";
import { PageTool } from "./page-tool.js";
import { PageTools } from "./page-tools.js";
import { PagesMigrations } from "./pages-migrations.js";
import { PagesResources } from "./pages-resources.js";
import { PagesStore } from "./pages-store.js";

export class Pages {
  public static readonly migrations: readonly Migration[] = PagesMigrations.all;
  public static readonly tools: readonly IToolDescriptor[] = [...PageTools.all, ...CanvasTools.all];

  private readonly store: PagesStore;
  private readonly canvases: CanvasStore;
  private readonly host: IPagesHost;
  private readonly log: IModuleLog;
  private readonly server: PageServer;
  private readonly channels: Map<PageEventName, EventChannel> = new Map<PageEventName, EventChannel>();
  private origins: PageOrigins | null = null;
  private ping: PagePing | null = null;

  public constructor(connection: SqlConnection, dataDirectory: string, host: IPagesHost, log: IModuleLog, server: Server = createServer()) {
    this.store = new PagesStore(connection, new PageFiles(dataDirectory));
    this.canvases = new CanvasStore(this.store);
    this.host = host;
    this.log = log;
    this.server = new PageServer(async (id, version) => {
      const page = await this.store.findAsync(id);
      return (await this.store.readAsync(page.chatId, id, version)).html;
    }, error => this.log.write(PagesResources.formatServerFailed(Pages.kindOf(error))), server);
  }

  public register(moduleId: string, tools: Pick<IToolsContext, "register">): void {
    for (const tool of PageTools.all)
      tools.register(tool, new PageTool(moduleId, tool.name, this.store, this.host,
        (page, isShown) => this.publish(isShown ? PageEventName.PageShown : PageEventName.PageUpdated, page)));
    for (const tool of CanvasTools.all)
      tools.register(tool, new CanvasTool(moduleId, tool.name, this.canvases, this.host,
        (canvas, isShown) => this.publish(isShown ? PageEventName.PageShown : PageEventName.PageUpdated, canvas)));
  }

  public async serveAsync(context: Pick<IRuntimePartContext, "moduleId" | "webViews" | "registerMethod" | "declareEvent">, clock: IPagesClock): Promise<void> {
    const document = PagesResources.formatQualifiedName(context.moduleId, PagesResources.documentName);
    for (const event of Object.values(PageEventName))
      this.channels.set(event, context.declareEvent(PagesResources.formatQualifiedName(context.moduleId, event)));
    for (const method of Object.values(PageMethodName))
      context.registerMethod(PagesResources.formatQualifiedName(context.moduleId, method),
        new PageMethod(method, this.store, this.server, () => context.webViews, document, t => this.publish(PageEventName.PageUpdated, t)));
    try {
      await this.server.listenAsync();
    }
    catch (error) {
      this.log.write(PagesResources.formatServerNotListening(Pages.kindOf(error)));
      return;
    }
    this.origins = new PageOrigins(() => context.webViews, document, this.log);
    await this.origins.allowAsync(this.server.origin);
    this.ping = new PagePing(() => context.webViews, document, clock, t => this.publishStoppedAsync(t), this.log);
    this.ping.start();
  }

  public async closeAsync(): Promise<void> {
    await this.ping?.closeAsync();
    this.ping = null;
    await this.origins?.clearAsync();
    this.origins = null;
    await this.server.closeAsync();
  }

  public async removeChatAsync(chatId: string): Promise<void> {
    await this.store.removeChatAsync(chatId);
  }

  public async sweepAsync(): Promise<void> {
    let chatIds: readonly string[];
    try {
      chatIds = await this.store.chatIdsAsync();
    }
    catch (error) {
      this.log.write(PagesResources.formatChatsNotListed(Pages.kindOf(error)));
      return;
    }
    for (const chatId of chatIds) {
      try {
        if (!(await this.host.hasChatAsync(chatId)))
          await this.store.removeChatAsync(chatId);
      }
      catch (error) {
        this.log.write(PagesResources.formatChatNotSwept(chatId, Pages.kindOf(error)));
      }
    }
  }

  private async publishStoppedAsync(pageId: string): Promise<void> {
    let page: Page;
    try {
      page = await this.store.findAsync(pageId);
    }
    catch (error) {
      this.log.write(PagesResources.formatEventNotSent(PageEventName.PageStopped, Pages.kindOf(error)));
      return;
    }
    this.publish(PageEventName.PageStopped, page);
  }

  private publish(event: PageEventName, page: Page): void {
    try {
      this.channels.get(event)?.publish(page.toJson());
    }
    catch (error) {
      this.log.write(PagesResources.formatEventNotSent(event, Pages.kindOf(error)));
    }
  }

  private static kindOf(error: unknown): string {
    return error instanceof Error ? error.name : typeof error;
  }
}
