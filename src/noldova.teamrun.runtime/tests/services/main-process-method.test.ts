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
import type { JsonValue } from "@noldova/context.json";
import { MainProcessMethod, Resources } from "@noldova/teamrun.runtime";

@TestClass
export class MainProcessMethodTests {
  @TestMethod
  public async answersTheAppsMainProcessThroughItsMethod(): Promise<void> {
    const requests: RequestContext[] = [];
    const request = MainProcessMethodTests.request(ShellClients.mainProcess);

    const payload = await new MainProcessMethod(MainProcessMethodTests.method(requests)).handleAsync(request);

    Assert.areEqual("{\"answered\":true}", JSON.stringify(payload));
    Assert.areEqual(1, requests.length);
    Assert.isTrue(requests[0] === request);
  }

  @TestMethod
  @TestData(ShellClients.commandLine)
  @TestData("module/teamrun")
  @TestData("tests")
  public async refusesAnyOtherClientAsUnauthorizedBeforeItsMethodSeesTheRequest(client: string): Promise<void> {
    const requests: RequestContext[] = [];

    const error = await new MainProcessMethod(MainProcessMethodTests.method(requests)).handleAsync(MainProcessMethodTests.request(client))
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

  private static request(client: string): RequestContext {
    return new RequestContext(client, { approvalId: "approval", optionId: "allow" }, new AbortController().signal, 1);
  }
}
