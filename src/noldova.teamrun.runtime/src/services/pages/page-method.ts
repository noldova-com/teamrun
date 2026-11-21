/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Failure, FailureCode } from "@noldova/desktop.protocol";
import { type IMethodHandler, type IRuntimeWebViews, MethodFailureException, type RequestContext, ToolFailureCode } from "@noldova/desktop.runtime";
import "@noldova/context.core";
import type { JsonValue } from "@noldova/context.json";
import { type Page, PageAuthor, PageEditedListRequest, PageListRequest, PageMethodName, PageRequest, PageView } from "@noldova/teamrun.protocol";

import { PageException } from "../../exceptions/pages/page.exception.js";
import type { PageServer } from "./page-server.js";
import { PagesResources } from "./pages-resources.js";
import type { PagesStore } from "./pages-store.js";

export class PageMethod implements IMethodHandler {
  private readonly name: PageMethodName;
  private readonly store: PagesStore;
  private readonly server: PageServer;
  private readonly views: () => IRuntimeWebViews;
  private readonly document: string;
  private readonly restored: (page: Page) => void;

  public constructor(name: PageMethodName, store: PagesStore, server: PageServer, views: () => IRuntimeWebViews, document: string,
    restored: (page: Page) => void) {
    this.name = name;
    this.store = store;
    this.server = server;
    this.views = views;
    this.document = document;
    this.restored = restored;
  }

  public async handleAsync(context: RequestContext): Promise<JsonValue> {
    if (this.name === PageMethodName.PageList)
      return (await this.store.listAsync(PageMethod.parse(() => PageListRequest.fromJson(context.payload)).chatId)).map(t => t.toJson());
    if (this.name === PageMethodName.PageEditedList)
      return (await this.store.listOfTeammateAsync(PageMethod.parse(() => PageEditedListRequest.fromJson(context.payload)).teammateId)).map(t => t.toJson());
    const request = PageMethod.parse(() => PageRequest.fromJson(context.payload));
    try {
      switch (this.name) {
        case PageMethodName.PageOpen:
          return (await this.openAsync(request)).toJson();
        case PageMethodName.PageRead: {
          const page = await this.store.findAsync(request.pageId);
          return (await this.store.readAsync(page.chatId, page.id, request.version)).html;
        }
        default:
          return (await this.restoreAsync(request)).toJson();
      }
    }
    catch (error) {
      if (error instanceof PageException)
        throw new MethodFailureException(new Failure(FailureCode.NotFound, error.message));
      throw error;
    }
  }

  private async openAsync(request: PageRequest): Promise<PageView> {
    if (!this.server.isListening)
      throw new MethodFailureException(new Failure(FailureCode.Unavailable, PagesResources.serverNotListening));
    const page = await this.store.findAsync(request.pageId);
    const versions = await this.store.versionsAsync(page.id);
    const version = request.version ?? page.version;
    if (!versions.some(t => t.version === version))
      throw new PageException(ToolFailureCode.Refused, PagesResources.versionUnknown);
    const origins = [this.server.origin, ...PagesResources.sourceOrigins];
    await Promise.all(this.views().list().filter(t => t.pane.name.text === this.document && t.pane.instance === page.id)
      .map(t => this.views().setAllowedOriginsAsync(t.id, origins)));
    return new PageView(page, versions, version, this.server.addressOf(page.id, request.version), this.store.copyOf(page));
  }

  private async restoreAsync(request: PageRequest): Promise<Page> {
    if (Object.isNull(request.version))
      throw new MethodFailureException(new Failure(FailureCode.InvalidParams, PagesResources.restoreVersionMissing));
    const page = await this.store.restoreAsync(request.pageId, request.version, new PageAuthor(null, PagesResources.personName));
    this.restored(page);
    return page;
  }

  private static parse<T>(read: () => T): T {
    try {
      return read();
    }
    catch {
      throw new MethodFailureException(new Failure(FailureCode.InvalidParams, PagesResources.requestInvalid));
    }
  }
}
