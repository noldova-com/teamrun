/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { WebViewFailureKind, type WebViewInfo } from "@noldova/desktop.protocol";
import { type IModuleLog, type IRuntimeWebViews, WebViewFailureException } from "@noldova/desktop.runtime";
import "@noldova/context.core";

import type { IPagesClock } from "../../interfaces/pages/i-pages-clock.js";
import { PagesResources } from "./pages-resources.js";

export class PagePing {
  private readonly views: () => IRuntimeWebViews;
  private readonly document: string;
  private readonly clock: IPagesClock;
  private readonly stoppedAsync: (pageId: string) => Promise<void>;
  private readonly log: IModuleLog;
  private readonly stuck: Set<string> = new Set<string>();
  private readonly stop: AbortController = new AbortController();
  private running: Promise<void> | null = null;

  public constructor(views: () => IRuntimeWebViews, document: string, clock: IPagesClock, stoppedAsync: (pageId: string) => Promise<void>, log: IModuleLog) {
    this.views = views;
    this.document = document;
    this.clock = clock;
    this.stoppedAsync = stoppedAsync;
    this.log = log;
  }

  public start(): void {
    this.running ??= this.runAsync();
  }

  public async closeAsync(): Promise<void> {
    this.stop.abort();
    await this.running;
  }

  private async runAsync(): Promise<void> {
    while (!this.stop.signal.aborted) {
      try {
        await this.clock.delayAsync(PagesResources.pingIntervalMilliseconds, this.stop.signal);
      }
      catch {
        return;
      }
      await this.pingAllAsync();
    }
  }

  private async pingAllAsync(): Promise<void> {
    let views: readonly WebViewInfo[];
    try {
      views = this.views().list().filter(t => t.pane.name.text === this.document);
    }
    catch (error) {
      this.log.write(PagesResources.formatPingNotListed(PagePing.kindOf(error)));
      return;
    }
    for (const id of [...this.stuck].filter(t => !views.some(u => u.id === t)))
      this.stuck.delete(id);
    await Promise.all(views.map(t => this.pingAsync(t)));
  }

  private async pingAsync(view: WebViewInfo): Promise<void> {
    try {
      await this.views().relay.sendAsync(view.id, PagesResources.pingMethod, { [PagesResources.expressionParameter]: PagesResources.pingExpression },
        PagesResources.pingTimeoutMilliseconds);
      this.stuck.delete(view.id);
    }
    catch (error) {
      const pageId = view.pane.instance;
      if (!(error instanceof WebViewFailureException) || error.failure.kind !== WebViewFailureKind.TimedOut || this.stuck.has(view.id) || Object.isNull(pageId))
        return;
      this.stuck.add(view.id);
      await this.stoppedAsync(pageId);
    }
  }

  private static kindOf(error: unknown): string {
    return error instanceof Error ? error.name : typeof error;
  }
}
