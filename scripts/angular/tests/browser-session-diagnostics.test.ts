/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { describe, it } from "node:test";

import { BrowserSessionDiagnostics } from "../browser-session-diagnostics.ts";
import type { IBrowserSession } from "../interfaces/i-browser-session.ts";
import type { IBrowserSessions } from "../interfaces/i-browser-sessions.ts";
import type { IPageMessage } from "../interfaces/i-page-message.ts";
import type { IPageProvider } from "../interfaces/i-page-provider.ts";
import type { IPageRequest } from "../interfaces/i-page-request.ts";
import type { ISessionRun } from "../interfaces/i-session-run.ts";
import type { IWatchedPage } from "../interfaces/i-watched-page.ts";

interface IFakeRun {
  readonly run: ISessionRun;
  readonly sessions: IBrowserSessions;
  readonly logged: string[];
  readonly calls: string[];
  answer(sessionId: string, error?: Error): void;
}

const fakeRun = (): IFakeRun => {
  const logged: string[] = [];
  const calls: string[] = [];
  const created: Map<string, IBrowserSession> = new Map();
  const answers: Map<string, (error?: Error) => void> = new Map();
  const sessions: IBrowserSessions = {
    createSession: sessionId => {
      created.set(sessionId, { connected: () => void calls.push(`${sessionId} connected`), ready: () => void calls.push(`${sessionId} ready`) });
      return new Promise((resolve, reject) => answers.set(sessionId, error => error === undefined ? resolve() : reject(error)));
    },
    getSession: sessionId => created.get(sessionId)
  };
  return {
    run: { logger: { log: message => void logged.push(message) }, _browserSessions: sessions },
    sessions,
    logged,
    calls,
    answer: (sessionId, error) => answers.get(sessionId)?.(error)
  };
};

const page = (): IWatchedPage & EventEmitter => new EventEmitter();
const request = (url: string, errorText: string | null = null): IPageRequest => ({ url: () => url, failure: () => errorText === null ? null : { errorText } });
const message = (type: string, text: string): IPageMessage => ({ type: () => type, text: () => text });
const timeless = (report: string | undefined): string[] => (report ?? "").replaceAll(/\d+ ms/gu, "N ms").split("\n");
const timeout = (sessionId: string): Error => new Error(`Failed to connect to the browser session "${sessionId}" [chromium] within the timeout.`);

describe("BrowserSessionDiagnostics", () => {
  it("logs, for a session that never connects, how far its page got, what it still loads, what failed and what it printed, and passes the timeout on", async () => {
    const fake = fakeRun();
    new BrowserSessionDiagnostics().configureVitest({ vitest: fake.run });
    const provider: IPageProvider = { pages: new Map([["earlier", page()]]) };
    const opening = fake.sessions.createSession("s1", { browser: { provider } });
    const opened = page();
    provider.pages?.set("s1", opened);
    const finished = request("http://127.0.0.1:63315/finished.js");
    opened.emit("domcontentloaded");
    opened.emit("request", request("http://127.0.0.1:63315/stuck.js"));
    opened.emit("request", finished);
    opened.emit("requestfinished", finished);
    opened.emit("requestfailed", request("http://127.0.0.1:63315/failed.js", "net::ERR_CONNECTION_RESET"));
    opened.emit("requestfailed", request("http://127.0.0.1:63315/unexplained.js"));
    opened.emit("console", message("error", "boom"));
    opened.emit("pageerror", new Error("not defined"));
    fake.sessions.getSession("s1")?.connected();
    const error = timeout("s1");
    fake.answer("s1", error);

    await assert.rejects(opening, error);
    assert.deepEqual(timeless(fake.logged[0]), [
      "Browser session s1 did not connect: page at N ms, domcontentloaded at N ms, load not reached, connected at N ms, ready not reached.",
      "  Still loading: http://127.0.0.1:63315/stuck.js",
      "  Request failed: http://127.0.0.1:63315/failed.js (net::ERR_CONNECTION_RESET)",
      "  Request failed: http://127.0.0.1:63315/unexplained.js (no reason given)",
      "  Console error: boom",
      "  Page error: not defined"
    ]);
    assert.deepEqual([fake.logged.length, fake.calls, [...provider.pages?.keys() ?? []]], [1, ["s1 connected"], ["earlier", "s1"]]);
  });

  it("logs nothing for a session that connects and becomes ready, and passes both on", async () => {
    const fake = fakeRun();
    new BrowserSessionDiagnostics().configureVitest({ vitest: fake.run });
    const provider: IPageProvider = { pages: new Map() };
    const opening = fake.sessions.createSession("s1", { browser: { provider } });
    const opened = page();
    provider.pages?.set("s1", opened);
    fake.sessions.getSession("s1")?.ready();
    fake.sessions.getSession("s1")?.connected();
    opened.emit("console", message("log", "after ready"));
    fake.answer("s1");

    await opening;
    assert.deepEqual([fake.logged, fake.calls], [[], ["s1 ready", "s1 connected"]]);
  });

  it("keeps the last 40 things a page printed and names the first 40 requests it still loads, with a count of the rest", async () => {
    const fake = fakeRun();
    new BrowserSessionDiagnostics().configureVitest({ vitest: fake.run });
    const provider: IPageProvider = { pages: new Map() };
    const opening = fake.sessions.createSession("s1", { browser: { provider } });
    const opened = page();
    provider.pages?.set("s1", opened);
    for (let index = 0; index < 45; index++) {
      opened.emit("request", request(`/${index}.js`));
      opened.emit("console", message("log", String(index)));
    }
    fake.answer("s1", timeout("s1"));

    await assert.rejects(opening);
    const lines = timeless(fake.logged[0]);
    assert.deepEqual([lines.length, lines[1], lines[40], lines[41], lines[42], lines.at(-1)],
      [82, "  Still loading: /0.js", "  Still loading: /39.js", "  And 5 more still loading.", "  Console log: 5", "  Console log: 44"]);
  });

  it("follows every session through the one map of pages it puts in place, and leaves a page it does not expect alone", async () => {
    const fake = fakeRun();
    new BrowserSessionDiagnostics().configureVitest({ vitest: fake.run });
    const provider: IPageProvider = { pages: new Map() };
    const first = fake.sessions.createSession("s1", { browser: { provider } });
    const pages = provider.pages;
    const second = fake.sessions.createSession("s2", { browser: { provider } });
    const opened = page();
    provider.pages?.set("unexpected", page());
    provider.pages?.set("s2", opened);
    opened.emit("load");
    fake.answer("s1", timeout("s1"));
    fake.answer("s2", timeout("s2"));

    await Promise.allSettled([first, second]);
    assert.deepEqual([provider.pages === pages, timeless(fake.logged.join("\n"))], [true, [
      "Browser session s1 did not connect: page not reached, domcontentloaded not reached, load not reached, connected not reached, ready not reached.",
      "Browser session s2 did not connect: page at N ms, domcontentloaded not reached, load at N ms, connected not reached, ready not reached."
    ]]);
  });

  it("logs the steps it knows when the provider keeps no pages or the session is not found, once however many projects configure it", async () => {
    const fake = fakeRun();
    const diagnostics = new BrowserSessionDiagnostics();
    diagnostics.configureVitest({ vitest: fake.run });
    diagnostics.configureVitest({ vitest: fake.run });
    const lost = fakeRun();
    lost.sessions.getSession = () => undefined;
    new BrowserSessionDiagnostics().configureVitest({ vitest: lost.run });
    const withoutPages = fake.sessions.createSession("s1", { browser: { provider: {} } });
    const withoutBrowser = lost.sessions.createSession("s2", {});
    fake.answer("s1", timeout("s1"));
    lost.answer("s2", timeout("s2"));

    await Promise.allSettled([withoutPages, withoutBrowser]);
    assert.deepEqual([timeless(fake.logged.join("\n")), timeless(lost.logged.join("\n"))], [
      ["Browser session s1 did not connect: page not reached, domcontentloaded not reached, load not reached, connected not reached, ready not reached."],
      ["Browser session s2 did not connect: page not reached, domcontentloaded not reached, load not reached, connected not reached, ready not reached."]
    ]);
  });

  it("says it is off when the run keeps no browser sessions", () => {
    const logged: string[] = [];

    new BrowserSessionDiagnostics().configureVitest({ vitest: { logger: { log: message => void logged.push(message) } } });

    assert.deepEqual(logged, ["Browser session diagnostics are off: this Vitest keeps no browser sessions to follow."]);
  });
});
