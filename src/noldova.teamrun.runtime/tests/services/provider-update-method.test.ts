/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { resolve } from "node:path";
import { FailureCode, ShellClients } from "@noldova/desktop.protocol";
import { type IMethodHandler, MethodFailureException, RequestContext } from "@noldova/desktop.runtime";
import { Assert, TestClass, TestData, TestMethod } from "@noldova/context.testing";
import type { JsonObject, JsonValue } from "@noldova/context.json";
import { AuthStatus, Provider } from "@noldova/teamrun.protocol";
import { ProviderUpdateMethod, Resources } from "@noldova/teamrun.runtime";

@TestClass
export class ProviderUpdateMethodTests {
  private static readonly profileDir = resolve("profiles", "home");

  @TestMethod
  public async answersTheAppsMainProcessWhateverItChanges(): Promise<void> {
    const requests: RequestContext[] = [];

    const payload = await ProviderUpdateMethodTests.handler(requests, ProviderUpdateMethodTests.stored())
      .handleAsync(ProviderUpdateMethodTests.request(ShellClients.mainProcess, { profileDir: resolve("other"), ownMcpServers: true }));

    Assert.areEqual("{\"answered\":true}", JSON.stringify(payload));
    Assert.areEqual(1, requests.length);
  }

  @TestMethod
  @TestData(ShellClients.commandLine)
  @TestData("teamrun.tools")
  public async answersAnyClientThatKeepsTheStoredFolderAndServers(client: string): Promise<void> {
    const requests: RequestContext[] = [];

    await ProviderUpdateMethodTests.handler(requests, ProviderUpdateMethodTests.stored())
      .handleAsync(ProviderUpdateMethodTests.request(client, { profileDir: "profiles/./home", ownMcpServers: false }));
    await ProviderUpdateMethodTests.handler(requests, ProviderUpdateMethodTests.stored())
      .handleAsync(ProviderUpdateMethodTests.request(client, {}));

    Assert.areEqual(2, requests.length);
  }

  @TestMethod
  @TestData("{\"profileDir\":\"other\"}")
  @TestData("{\"ownMcpServers\":true}")
  public async refusesAnotherClientThatChangesTheStoredFolderOrServers(change: string): Promise<void> {
    const requests: RequestContext[] = [];

    const error = await ProviderUpdateMethodTests.handler(requests, ProviderUpdateMethodTests.stored())
      .handleAsync(ProviderUpdateMethodTests.request(ShellClients.commandLine, JSON.parse(change) as JsonObject))
      .then(() => null, (t: unknown) => t);

    Assert.isInstanceOf(error, MethodFailureException);
    const failure = (error as MethodFailureException).failure;
    Assert.areEqual(FailureCode.Unauthorized, failure.code);
    Assert.areEqual(Resources.mainProcessOnly, failure.message);
    Assert.areEqual("{\"error\":\"Unauthorized\",\"arguments\":[]}", JSON.stringify(failure.details));
    Assert.areEqual(0, requests.length);
  }

  @TestMethod
  public async leavesAnUnreadablePayloadOrAnUnknownProviderToItsMethod(): Promise<void> {
    const requests: RequestContext[] = [];

    await ProviderUpdateMethodTests.handler(requests, ProviderUpdateMethodTests.stored())
      .handleAsync(new RequestContext(ShellClients.commandLine, { providerId: "provider" }, new AbortController().signal, 1));
    await ProviderUpdateMethodTests.handler(requests, null)
      .handleAsync(ProviderUpdateMethodTests.request(ShellClients.commandLine, { profileDir: resolve("other") }));

    Assert.areEqual(2, requests.length);
  }

  @TestMethod
  public async failsAsItsMethodWhenTheStoredProviderCannotBeRead(): Promise<void> {
    const requests: RequestContext[] = [];
    const handler = new ProviderUpdateMethod(ProviderUpdateMethodTests.method(requests),
      { findAsync: () => Promise.reject(new Error("The database is busy.")) });

    const error = await handler.handleAsync(ProviderUpdateMethodTests.request(ShellClients.commandLine, {}))
      .then(() => null, (t: unknown) => t);

    Assert.isInstanceOf(error, MethodFailureException);
    const failure = (error as MethodFailureException).failure;
    Assert.areEqual(FailureCode.Internal, failure.code);
    Assert.areEqual("The database is busy.", failure.message);
    Assert.areEqual(0, requests.length);
  }

  private static handler(requests: RequestContext[], stored: Provider | null): ProviderUpdateMethod {
    return new ProviderUpdateMethod(ProviderUpdateMethodTests.method(requests), { findAsync: () => Promise.resolve(stored) });
  }

  private static stored(): Provider {
    return new Provider("provider", "claude", "Home", ProviderUpdateMethodTests.profileDir, AuthStatus.LoggedIn, null, null, null, null,
      "2026-11-19T00:00:00.000Z");
  }

  private static method(requests: RequestContext[]): IMethodHandler {
    return {
      handleAsync: (request: RequestContext): Promise<JsonValue> => {
        requests.push(request);
        return Promise.resolve({ answered: true });
      }
    };
  }

  private static request(client: string, change: JsonObject): RequestContext {
    const payload = { providerId: "provider", label: "Renamed", profileDir: ProviderUpdateMethodTests.profileDir, ...change };
    return new RequestContext(client, payload, new AbortController().signal, 1);
  }
}
