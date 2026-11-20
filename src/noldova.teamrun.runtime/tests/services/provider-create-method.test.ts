/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { FailureCode, ShellClients } from "@noldova/desktop.protocol";
import { type IMethodHandler, MethodFailureException, RequestContext } from "@noldova/desktop.runtime";
import { Assert, TestClass, TestData, TestMethod } from "@noldova/context.testing";
import type { JsonObject, JsonValue } from "@noldova/context.json";
import { ProviderCreateMethod, Resources } from "@noldova/teamrun.runtime";

@TestClass
export class ProviderCreateMethodTests {
  @TestMethod
  public async answersTheAppsMainProcessWithAProfileFolder(): Promise<void> {
    const requests: RequestContext[] = [];

    const payload = await new ProviderCreateMethod(ProviderCreateMethodTests.method(requests))
      .handleAsync(ProviderCreateMethodTests.request(ShellClients.mainProcess, { kind: "codex", label: "Work", profileDir: "/profiles/work" }));

    Assert.areEqual("{\"answered\":true}", JSON.stringify(payload));
    Assert.areEqual(1, requests.length);
  }

  @TestMethod
  @TestData("{\"kind\":\"codex\",\"label\":\"Work\",\"profileDir\":null}")
  @TestData("{\"kind\":\"codex\",\"label\":\"Work\"}")
  @TestData("{\"kind\":\"codex\"}")
  public async answersAnotherClientThatNamesNoFolderOrSendsAPayloadItLeavesToItsMethod(payload: string): Promise<void> {
    const requests: RequestContext[] = [];

    await new ProviderCreateMethod(ProviderCreateMethodTests.method(requests))
      .handleAsync(ProviderCreateMethodTests.request(ShellClients.commandLine, JSON.parse(payload) as JsonObject));

    Assert.areEqual(1, requests.length);
  }

  @TestMethod
  @TestData(ShellClients.commandLine)
  @TestData("module/teamrun")
  @TestData("teamrun.tools")
  public async refusesAnotherClientThatNamesAProfileFolder(client: string): Promise<void> {
    const requests: RequestContext[] = [];

    const error = await new ProviderCreateMethod(ProviderCreateMethodTests.method(requests))
      .handleAsync(ProviderCreateMethodTests.request(client, { kind: "codex", label: "Work", profileDir: "/profiles/work" }))
      .then(() => null, (t: unknown) => t);

    Assert.isInstanceOf(error, MethodFailureException);
    const failure = (error as MethodFailureException).failure;
    Assert.areEqual(FailureCode.Unauthorized, failure.code);
    Assert.areEqual(Resources.mainProcessOnly, failure.message);
    Assert.areEqual("{\"error\":\"Unauthorized\",\"arguments\":[]}", JSON.stringify(failure.details));
    Assert.areEqual(0, requests.length);
  }

  private static method(requests: RequestContext[]): IMethodHandler {
    return {
      handleAsync: (request: RequestContext): Promise<JsonValue> => {
        requests.push(request);
        return Promise.resolve({ answered: true });
      }
    };
  }

  private static request(client: string, payload: JsonObject): RequestContext {
    return new RequestContext(client, payload, new AbortController().signal, 1);
  }
}
