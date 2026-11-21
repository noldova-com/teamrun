/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { IPageRequest } from "./interfaces/i-page-request.ts";
import type { IWatchedPage } from "./interfaces/i-watched-page.ts";

export class BrowserSessionRecord {
  private static readonly PAGE: string = "page";
  private static readonly CONTENT: string = "domcontentloaded";
  private static readonly LOAD: string = "load";
  private static readonly CONNECTED: string = "connected";
  private static readonly READY: string = "ready";
  private static readonly STEPS: readonly string[] = [BrowserSessionRecord.PAGE, BrowserSessionRecord.CONTENT, BrowserSessionRecord.LOAD, BrowserSessionRecord.CONNECTED, BrowserSessionRecord.READY];
  private static readonly KEPT: number = 40;
  private static readonly NO_REASON: string = "no reason given";
  private static readonly LINE_START: string = "\n  ";

  private readonly started: number = performance.now();
  private readonly reached: Map<string, number> = new Map();
  private readonly pending: Set<IPageRequest> = new Set();
  private readonly notes: string[] = [];

  public get settled(): boolean {
    return this.reached.has(BrowserSessionRecord.CONNECTED) && this.reached.has(BrowserSessionRecord.READY);
  }

  public connect(): void {
    this.mark(BrowserSessionRecord.CONNECTED);
  }

  public ready(): void {
    this.mark(BrowserSessionRecord.READY);
  }

  public watch(page: IWatchedPage): void {
    this.mark(BrowserSessionRecord.PAGE);
    page.on("domcontentloaded", () => this.mark(BrowserSessionRecord.CONTENT));
    page.on("load", () => this.mark(BrowserSessionRecord.LOAD));
    page.on("request", request => this.track(request));
    page.on("requestfinished", request => void this.pending.delete(request));
    page.on("requestfailed", request => {
      this.pending.delete(request);
      this.note(`Request failed: ${request.url()} (${request.failure()?.errorText ?? BrowserSessionRecord.NO_REASON})`);
    });
    page.on("console", message => this.note(`Console ${message.type()}: ${message.text()}`));
    page.on("pageerror", error => this.note(`Page error: ${error.message}`));
  }

  public report(sessionId: string): string {
    const steps = BrowserSessionRecord.STEPS.map(step => {
      const time = this.reached.get(step);
      return time === undefined ? `${step} not reached` : `${step} at ${time} ms`;
    });
    const loading = [...this.pending].map(t => `Still loading: ${t.url()}`);
    const shown = loading.slice(0, BrowserSessionRecord.KEPT);
    const more = loading.length > shown.length ? [`And ${loading.length - shown.length} more still loading.`] : [];
    return [`Browser session ${sessionId} did not connect: ${steps.join(", ")}.`, ...shown, ...more, ...this.notes].join(BrowserSessionRecord.LINE_START);
  }

  private mark(step: string): void {
    if (!this.reached.has(step))
      this.reached.set(step, Math.round(performance.now() - this.started));
    if (this.settled) {
      this.pending.clear();
      this.notes.length = 0;
    }
  }

  private track(request: IPageRequest): void {
    if (!this.settled)
      this.pending.add(request);
  }

  private note(text: string): void {
    if (this.settled)
      return;
    this.notes.push(text);
    if (this.notes.length > BrowserSessionRecord.KEPT)
      this.notes.shift();
  }
}
