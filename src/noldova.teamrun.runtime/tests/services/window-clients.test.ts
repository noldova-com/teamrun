/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ShellClients } from "@noldova/desktop.protocol";
import { ClientClosure, type IMethodHandler, RequestContext } from "@noldova/desktop.runtime";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import type { JsonValue } from "@noldova/context.json";
import type { WindowIdParams } from "@noldova/teamrun.protocol";
import { WindowClients } from "@noldova/teamrun.runtime";

@TestClass
export class WindowClientsTests {
  @TestMethod
  public async forgetsATeamRunWindowWhenAnotherPageReportsFromItsWindowAndKeepsOneThatReportsAgain(): Promise<void> {
    const closed: string[] = [];
    const clients = new WindowClients(WindowClientsTests.method([]), WindowClientsTests.windows(closed));

    await clients.handleAsync(WindowClientsTests.report("w1", 2, 7));
    await clients.handleAsync(WindowClientsTests.report("w1", 2, 7));
    await clients.handleAsync(WindowClientsTests.report("w2", 2, 8));
    await clients.handleAsync(WindowClientsTests.report("w3", 3, 7));
    const before = [...closed];
    await clients.handleAsync(WindowClientsTests.report("w4", 2, 7));

    Assert.areEqual("[]", JSON.stringify(before));
    Assert.areEqual(JSON.stringify(["w1"]), JSON.stringify(closed));
  }

  @TestMethod
  public async keepsEveryTeamRunWindowThatReportsWithoutADesktopWindowUntilItsConnectionCloses(): Promise<void> {
    const closed: string[] = [];
    const clients = new WindowClients(WindowClientsTests.method([]), WindowClientsTests.windows(closed));

    await clients.handleAsync(WindowClientsTests.report("w1", 2, null));
    await clients.handleAsync(WindowClientsTests.report("w2", 2, null));
    const before = [...closed];
    clients.close(new ClientClosure(2, null));

    Assert.areEqual("[]", JSON.stringify(before));
    Assert.areEqual(JSON.stringify(["w1", "w2"]), JSON.stringify(closed));
  }

  @TestMethod
  public async forgetsTheTeamRunWindowsOfAClosedWindowOrConnectionOnce(): Promise<void> {
    const closed: string[] = [];
    const clients = new WindowClients(WindowClientsTests.method([]), WindowClientsTests.windows(closed));
    await clients.handleAsync(WindowClientsTests.report("w1", 2, 7));
    await clients.handleAsync(WindowClientsTests.report("w2", 2, 8));
    await clients.handleAsync(WindowClientsTests.report("w3", 3, 7));

    clients.close(new ClientClosure(2, 7));
    const window = [...closed];
    clients.close(new ClientClosure(2, 7));
    clients.close(new ClientClosure(2, null));

    Assert.areEqual(JSON.stringify(["w1"]), JSON.stringify(window));
    Assert.areEqual(JSON.stringify(["w1", "w2"]), JSON.stringify(closed));
  }

  @TestMethod
  public async answersThroughItsMethodAndKeepsNoClientForAReportItsMethodRefuses(): Promise<void> {
    const closed: string[] = [];
    const requests: RequestContext[] = [];
    const refusing: IMethodHandler = { handleAsync: () => Promise.reject(new Error("Refused.")) };
    const clients = new WindowClients(WindowClientsTests.method(requests), WindowClientsTests.windows(closed));
    const refused = new WindowClients(refusing, WindowClientsTests.windows(closed));
    const request = WindowClientsTests.report("w1", 2, 7);

    const payload = await clients.handleAsync(request);
    const error = await refused.handleAsync(request).then(() => null, (t: unknown) => t);
    refused.close(new ClientClosure(2, null));

    Assert.areEqual("{\"answered\":true}", JSON.stringify(payload));
    Assert.isTrue(requests.length === 1 && requests[0] === request);
    Assert.areEqual("Refused.", (error as Error).message);
    Assert.areEqual("[]", JSON.stringify(closed));
  }

  private static method(requests: RequestContext[]): IMethodHandler {
    return {
      handleAsync: (request: RequestContext): Promise<JsonValue> => {
        requests.push(request);
        return Promise.resolve({ answered: true });
      }
    };
  }

  private static windows(closed: string[]): { close(params: WindowIdParams): void } {
    return { close: t => void closed.push(t.windowId) };
  }

  private static report(windowId: string, connection: number, window: number | null): RequestContext {
    return new RequestContext(ShellClients.mainProcess, { windowId, shownChatId: null, focused: true }, new AbortController().signal, connection, window);
  }
}
