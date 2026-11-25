/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";

import { BrowserSessionRecord } from "./browser-session-record.ts";
import type { IBrowserSession } from "./interfaces/i-browser-session.ts";
import type { IBrowserSessions } from "./interfaces/i-browser-sessions.ts";
import type { ISessionProject } from "./interfaces/i-session-project.ts";
import type { ISessionRun } from "./interfaces/i-session-run.ts";
import type { ISessionRunContext } from "./interfaces/i-session-run-context.ts";
import { WatchedPages } from "./watched-pages.ts";

export class BrowserSessionDiagnostics {
  private static readonly NAME: string = "noldova-browser-session-diagnostics";
  private static readonly OFF: string = "Browser session diagnostics are off: this Vitest keeps no browser sessions to follow.";

  private readonly followed: WeakSet<IBrowserSessions> = new WeakSet();

  public readonly name: string = BrowserSessionDiagnostics.NAME;
  public readonly configureVitest: (context: ISessionRunContext) => void = context => this.follow(context.vitest);

  private follow(run: ISessionRun): void {
    const sessions = run._browserSessions;
    if (Object.isUndefined(sessions)) {
      run.logger.log(BrowserSessionDiagnostics.OFF);
      return;
    }
    if (this.followed.has(sessions))
      return;
    this.followed.add(sessions);
    const create = sessions.createSession.bind(sessions);
    sessions.createSession = (sessionId, project, ...rest) => {
      const record = new BrowserSessionRecord();
      const opening = create(sessionId, project, ...rest);
      BrowserSessionDiagnostics.time(sessions.getSession(sessionId), record);
      BrowserSessionDiagnostics.expectPage(project, sessionId, record);
      return opening.catch((error: unknown) => {
        run.logger.log(record.report(sessionId));
        throw error;
      }).finally(() => record.stop());
    };
  }

  private static time(session: IBrowserSession | undefined, record: BrowserSessionRecord): void {
    if (Object.isUndefined(session))
      return;
    const { connected, ready } = session;
    session.connected = () => {
      record.connect();
      connected();
    };
    session.ready = () => {
      record.ready();
      ready();
    };
  }

  private static expectPage(project: ISessionProject, sessionId: string, record: BrowserSessionRecord): void {
    const provider = project.browser?.provider;
    const pages = provider?.pages;
    if (Object.isUndefined(provider) || Object.isUndefined(pages))
      return;
    const watched = pages instanceof WatchedPages ? pages : new WatchedPages(pages);
    provider.pages = watched;
    watched.expect(sessionId, record);
  }
}
