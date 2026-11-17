/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { JsonObject } from "@noldova/context.json";
import { WebViewEvent, WebViewEventKind, WebViewNavigation, WebViewNavigationKind, type WebViewPane } from "@noldova/desktop.protocol";
import type { IWebViewHandle, IWindowWebViews } from "@noldova/desktop.window";

export class RecordingWebView implements IWebViewHandle {
  private static readonly MODULE: string = "teamrun";
  private static readonly STARTED: WebViewNavigation = new WebViewNavigation(WebViewNavigationKind.Started);

  private readonly listeners: Set<(event: WebViewEvent) => void> = new Set<(event: WebViewEvent) => void>();
  private readonly frame: HTMLElement = RecordingWebView.createFrame();

  public readonly id: string;
  public readonly pane: WebViewPane;
  public readonly profileKey: string;
  public readonly calls: string[] = [];
  public host: HTMLElement | null = null;
  public isShown: boolean = false;
  public isClosed: boolean = false;
  public zoom: number = 1;
  public failNavigation: boolean = false;
  public readonly goBackAsync: IWebViewHandle["goBackAsync"] = RecordingWebView.unused;
  public readonly goForwardAsync: IWebViewHandle["goForwardAsync"] = RecordingWebView.unused;
  public readonly stopAsync: IWebViewHandle["stopAsync"] = RecordingWebView.unused;
  public readonly findAsync: IWebViewHandle["findAsync"] = RecordingWebView.unused;
  public readonly findNextAsync: IWebViewHandle["findNextAsync"] = RecordingWebView.unused;
  public readonly findPreviousAsync: IWebViewHandle["findPreviousAsync"] = RecordingWebView.unused;
  public readonly endFind: IWebViewHandle["endFind"] = RecordingWebView.unused;
  public readonly openLayerAsync: IWebViewHandle["openLayerAsync"] = RecordingWebView.unused;

  public constructor(id: string, pane: WebViewPane, profileKey: string) {
    this.id = id;
    this.pane = pane;
    this.profileKey = profileKey;
  }

  public get bounds(): Readonly<Record<"x" | "y" | "width" | "height", number>> | null {
    if (!this.frame.isConnected)
      return null;
    const rectangle: DOMRect = this.frame.getBoundingClientRect();
    return { x: Math.round(rectangle.left), y: Math.round(rectangle.top), width: Math.round(rectangle.width), height: Math.round(rectangle.height) };
  }

  public get navigations(): readonly string[] {
    return this.calls.filter(t => t.startsWith("navigate ")).map(t => t.slice("navigate ".length));
  }

  public emit(kind: WebViewEventKind, details: JsonObject = {}): void {
    const event = new WebViewEvent(RecordingWebView.MODULE, this.id, kind, details);
    for (const listener of [...this.listeners])
      listener(event);
  }

  public mount(host: HTMLElement): void {
    this.record("mount");
    this.host = host;
    if (this.frame.parentElement !== host)
      host.append(this.frame);
  }

  public show(): void {
    this.record("show");
    this.isShown = true;
  }

  public hide(): void {
    this.record("hide");
    this.isShown = false;
  }

  public navigateAsync(url: string): Promise<WebViewNavigation> {
    this.record(`navigate ${url}`);
    if (this.failNavigation)
      return Promise.reject(new Error("The view refused the navigation."));
    this.emit(WebViewEventKind.State, { address: url, title: String.empty, isLoading: false, canGoBack: false, canGoForward: false });
    return Promise.resolve(RecordingWebView.STARTED);
  }

  public reloadAsync(): Promise<WebViewNavigation> {
    this.record("reload");
    return Promise.resolve(RecordingWebView.STARTED);
  }

  public getZoomAsync(): Promise<number> {
    return Promise.resolve(this.zoom);
  }

  public setZoomAsync(factor: number): Promise<number> {
    this.record(`zoom ${String(factor)}`);
    this.zoom = factor;
    return Promise.resolve(factor);
  }

  public zoomInAsync(): Promise<number> {
    this.record("zoom in");
    return Promise.resolve(this.zoom);
  }

  public zoomOutAsync(): Promise<number> {
    this.record("zoom out");
    return Promise.resolve(this.zoom);
  }

  public subscribe(listener: (event: WebViewEvent) => void): () => void {
    const subscription: (event: WebViewEvent) => void = t => listener(t);
    this.listeners.add(subscription);
    return () => this.listeners.delete(subscription);
  }

  public closeFromHost(): void {
    if (this.isClosed)
      return;
    this.emit(WebViewEventKind.Closed);
    this.isClosed = true;
    this.isShown = false;
    this.listeners.clear();
  }

  public close(): void {
    if (this.isClosed)
      return;
    this.calls.push("close");
    this.isClosed = true;
    this.isShown = false;
    this.listeners.clear();
  }

  private static createFrame(): HTMLElement {
    const frame: HTMLElement = document.createElement("div");
    frame.style.cssText = "position: absolute; inset: 0; display: block; overflow: hidden";
    return frame;
  }

  private static unused(): never {
    throw new Error("The page document doesn't use this member of its web view.");
  }

  private record(call: string): void {
    if (this.isClosed)
      throw new Error(`The view is closed, so "${call}" was refused.`);
    this.calls.push(call);
  }
}

export class RecordingWebViews implements IWindowWebViews {
  public readonly opened: RecordingWebView[] = [];
  public failure: Error | null = null;
  public waiting: Promise<void> = Promise.resolve();

  public openAsync(pane: WebViewPane, profileKey: string): Promise<IWebViewHandle> {
    if (!Object.isNull(this.failure))
      return Promise.reject(this.failure);
    const view = new RecordingWebView(`view-${String(this.opened.length + 1)}`, pane, profileKey);
    this.opened.push(view);
    return this.waiting.then(() => view);
  }
}
