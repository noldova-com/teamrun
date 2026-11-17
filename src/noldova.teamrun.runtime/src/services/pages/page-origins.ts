/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { type WebViewEvent, WebViewEventKind, type WebViewInfo } from "@noldova/desktop.protocol";
import type { IModuleLog, IRuntimeWebViews } from "@noldova/desktop.runtime";
import "@noldova/context.core";

import { PagesResources } from "./pages-resources.js";

export class PageOrigins {
  private readonly views: () => IRuntimeWebViews;
  private readonly document: string;
  private readonly log: IModuleLog;
  private origins: readonly string[] = [];
  private readonly releases: (() => void)[] = [];

  public constructor(views: () => IRuntimeWebViews, document: string, log: IModuleLog) {
    this.views = views;
    this.document = document;
    this.log = log;
  }

  public async allowAsync(origin: string): Promise<void> {
    this.origins = [origin, ...PagesResources.sourceOrigins];
    this.releases.push(this.views().onViewEvent(t => this.onViewEvent(t)));
    await Promise.all(this.pageViews().map(t => this.setAsync(t.id, this.origins)));
  }

  public async clearAsync(): Promise<void> {
    this.releases.splice(0).forEach(t => t());
    this.origins = [];
    await Promise.all(this.pageViews().map(t => this.setAsync(t.id, [])));
  }

  private onViewEvent(event: WebViewEvent): void {
    if (event.kind === WebViewEventKind.Opened && this.pageViews().some(t => t.id === event.view))
      void this.setAsync(event.view, this.origins);
  }

  private pageViews(): readonly WebViewInfo[] {
    try {
      return this.views().list().filter(t => t.pane.name.text === this.document);
    }
    catch (error) {
      this.log.write(PagesResources.formatOriginsNotListed(PageOrigins.kindOf(error)));
      return [];
    }
  }

  private async setAsync(id: string, origins: readonly string[]): Promise<void> {
    try {
      await this.views().setAllowedOriginsAsync(id, origins);
    }
    catch (error) {
      this.log.write(PagesResources.formatOriginsNotSet(PageOrigins.kindOf(error)));
    }
  }

  private static kindOf(error: unknown): string {
    return error instanceof Error ? error.name : typeof error;
  }
}
