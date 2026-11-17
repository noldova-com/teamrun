/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { type IncomingHttpHeaders, request } from "node:http";

import { QualifiedName, WebViewFailure, WebViewFailureKind, WebViewInfo, WebViewPane } from "@noldova/desktop.protocol";
import { EventChannel, type IMethodHandler, type IRuntimePartContext, RequestContext, WebViewFailureException } from "@noldova/desktop.runtime";
import { FakeRuntimeWebViews } from "@noldova/desktop.runtime/testing";
import "@noldova/context.core";
import type { JsonValue } from "@noldova/context.json";

export type PageAnswer = { readonly status: number; readonly headers: IncomingHttpHeaders; readonly body: string };

export class PagesServing implements Pick<IRuntimePartContext, "moduleId" | "webViews" | "registerMethod" | "declareEvent"> {
  public readonly moduleId: string = "teamrun";
  public readonly webViews: FakeRuntimeWebViews = new FakeRuntimeWebViews();
  public readonly methods: Map<string, IMethodHandler> = new Map<string, IMethodHandler>();
  public readonly events: string[] = [];
  public readonly published: (readonly [string, JsonValue])[] = [];
  public readonly allowed: (readonly [string, readonly string[]])[] = [];
  public failingEvent: string | null = null;
  public views: readonly WebViewInfo[] = [];

  public constructor() {
    this.webViews.answer("list", () => this.views);
    this.webViews.answer("setAllowedOriginsAsync", (id, origins) => {
      this.allowed.push([id, origins]);
      return Promise.resolve();
    });
  }

  public static viewOf(id: string, instance: string | null, document: string = "page"): WebViewInfo {
    return new WebViewInfo(id, "teamrun", new WebViewPane(QualifiedName.parse(`teamrun.${document}`), instance), "pages");
  }

  public static timedOut(): WebViewFailureException {
    return new WebViewFailureException(new WebViewFailure(WebViewFailureKind.TimedOut));
  }

  public static crashed(): WebViewFailureException {
    return new WebViewFailureException(new WebViewFailure(WebViewFailureKind.Crashed));
  }

  public static getAsync(address: string, host?: string, method: string = "GET"): Promise<PageAnswer> {
    const url = new URL(address);
    return new Promise((resolve, reject) => {
      const sent = request({ host: url.hostname, port: url.port, path: `${url.pathname}${url.search}`, method,
        headers: Object.isUndefined(host) ? {} : { host } }, response => {
        const chunks: Buffer[] = [];
        response.on("data", (chunk: Buffer) => chunks.push(chunk));
        response.on("end", () => resolve({ status: response.statusCode ?? 0, headers: response.headers, body: Buffer.concat(chunks).toString("utf8") }));
      });
      sent.on("error", reject);
      sent.end();
    });
  }

  public registerMethod(name: string, handler: IMethodHandler): void {
    this.methods.set(name, handler);
  }

  public declareEvent(name: string): EventChannel {
    this.events.push(name);
    return new EventChannel(payload => {
      if (this.failingEvent === name)
        throw new Error("The window is gone.");
      this.published.push([name, payload]);
    }, () => undefined);
  }

  public callAsync(method: string, payload: JsonValue): Promise<JsonValue> {
    const handler = this.methods.get(method);
    if (Object.isUndefined(handler))
      throw new Error(method);
    return handler.handleAsync(new RequestContext("window", payload, new AbortController().signal, 1));
  }

  public publishedOf(name: string): readonly JsonValue[] {
    return this.published.filter(t => t[0] === name).map(t => t[1]);
  }
}
