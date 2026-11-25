/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";

import type { IPageMessage } from "./interfaces/i-page-message.ts";
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
  private static readonly TOKEN: RegExp = /(token=)[^&\s"'#]+/giu;
  private static readonly MASKED: string = "$1***";
  private static readonly NOT_CONNECTED: string = "connect";
  private static readonly NOT_READY: string = "become ready";

  private readonly started: number = performance.now();
  private readonly reached: Map<string, number> = new Map();
  private readonly pending: Set<IPageRequest> = new Set();
  private readonly notes: string[] = [];
  private unwatch: (() => void) | null = null;

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
    const content = (): void => this.mark(BrowserSessionRecord.CONTENT);
    const load = (): void => this.mark(BrowserSessionRecord.LOAD);
    const request = (started: IPageRequest): void => void this.pending.add(started);
    const finished = (ended: IPageRequest): void => void this.pending.delete(ended);
    const failed = (ended: IPageRequest): void => {
      this.pending.delete(ended);
      this.note(`Request failed: ${ended.url()} (${ended.failure()?.errorText ?? BrowserSessionRecord.NO_REASON})`);
    };
    const message = (printed: IPageMessage): void => this.note(`Console ${printed.type()}: ${printed.text()}`);
    const error = (thrown: Error): void => this.note(`Page error: ${thrown.message}`);
    page.on("domcontentloaded", content);
    page.on("load", load);
    page.on("request", request);
    page.on("requestfinished", finished);
    page.on("requestfailed", failed);
    page.on("console", message);
    page.on("pageerror", error);
    this.unwatch = () => {
      page.off("domcontentloaded", content);
      page.off("load", load);
      page.off("request", request);
      page.off("requestfinished", finished);
      page.off("requestfailed", failed);
      page.off("console", message);
      page.off("pageerror", error);
    };
  }

  public stop(): void {
    this.unwatch?.();
    this.unwatch = null;
    this.pending.clear();
    this.notes.length = 0;
  }

  public report(sessionId: string): string {
    const steps = BrowserSessionRecord.STEPS.map(step => {
      const time = this.reached.get(step);
      return Object.isUndefined(time) ? `${step} not reached` : `${step} at ${time} ms`;
    });
    const missing = this.reached.has(BrowserSessionRecord.CONNECTED) ? BrowserSessionRecord.NOT_READY : BrowserSessionRecord.NOT_CONNECTED;
    const loading = [...this.pending].map(t => `Still loading: ${t.url()}`);
    const shown = loading.slice(0, BrowserSessionRecord.KEPT);
    const more = loading.length > shown.length ? [`And ${loading.length - shown.length} more still loading.`] : [];
    return [`Browser session ${sessionId} did not ${missing}: ${steps.join(", ")}.`, ...shown, ...more, ...this.notes]
      .join(BrowserSessionRecord.LINE_START).replace(BrowserSessionRecord.TOKEN, BrowserSessionRecord.MASKED);
  }

  private mark(step: string): void {
    if (!this.reached.has(step))
      this.reached.set(step, Math.round(performance.now() - this.started));
    if (this.settled)
      this.stop();
  }

  private note(text: string): void {
    this.notes.push(text);
    if (this.notes.length > BrowserSessionRecord.KEPT)
      this.notes.shift();
  }
}
