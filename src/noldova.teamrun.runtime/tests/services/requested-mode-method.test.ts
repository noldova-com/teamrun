/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { FailureCode, ShellClients } from "@noldova/desktop.protocol";
import { type IMethodHandler, MethodFailureException, RequestContext } from "@noldova/desktop.runtime";
import "@noldova/context.core";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import type { JsonValue } from "@noldova/context.json";
import { ErrorCode, MessageSendParams, RequestedSettings } from "@noldova/teamrun.protocol";
import { RequestedModeMethod } from "@noldova/teamrun.runtime";
import { ServiceException } from "@noldova/teamrun.services";

@TestClass
export class RequestedModeMethodTests {
  @TestMethod
  public async checksTheRequestedModeOfEveryClientButTheMainProcessBeforeItsMethodAndPassesAPayloadItCantRead(): Promise<void> {
    const checked: string[] = [];
    const answered: JsonValue[] = [];
    const method = RequestedModeMethodTests.wrapped(checked, answered, null);
    const send = new MessageSendParams("c1", "Check the build", new RequestedSettings("fake", null, null, null, "bypass"), "p1").toJson();

    await method.handleAsync(RequestedModeMethodTests.request(ShellClients.mainProcess, send));
    await method.handleAsync(RequestedModeMethodTests.request(ShellClients.commandLine, send));
    await method.handleAsync(RequestedModeMethodTests.request(ShellClients.commandLine, { text: 1 }));

    Assert.areEqual(JSON.stringify(["bypass"]), JSON.stringify(checked));
    Assert.areEqual(3, answered.length);
  }

  @TestMethod
  public async refusesARequestCoreRefusesAsUnauthorizedBeforeItsMethodSeesIt(): Promise<void> {
    const checked: string[] = [];
    const answered: JsonValue[] = [];
    const method = RequestedModeMethodTests.wrapped(checked, answered, new ServiceException(ErrorCode.Unauthorized, "Refused", ["fake", "bypass"]));
    const send = new MessageSendParams("c1", "Check the build", new RequestedSettings("fake", null, null, null, "bypass"), "p1").toJson();

    const error = await method.handleAsync(RequestedModeMethodTests.request("module/teamrun", send)).then(() => null, (t: unknown) => t);

    Assert.areEqual(FailureCode.Unauthorized, error instanceof MethodFailureException ? error.failure.code : error);
    Assert.areEqual(JSON.stringify(["bypass"]), JSON.stringify(checked));
    Assert.areEqual(0, answered.length);
  }

  @TestMethod
  public async answersEveryClientButTheMainProcessThroughItsOutsideHandlerOnceTheModePassesWithTheHandlersFailure(): Promise<void> {
    const checked: string[] = [];
    const answered: JsonValue[] = [];
    const outside: JsonValue[] = [];
    const method = RequestedModeMethodTests.wrapped(checked, answered, null, t => {
      outside.push(t);
      return (t as { text: unknown }).text === "Fail" ? Promise.reject(new ServiceException(ErrorCode.NotFound, "Gone", ["w1"])) : Promise.resolve("marked");
    });
    const send = new MessageSendParams("c1", "Check the build", new RequestedSettings("fake", null, null, null, "acceptEdits"), "p1").toJson();
    const failing = new MessageSendParams("c1", "Fail", new RequestedSettings("fake", null, null), "p1").toJson();

    const own = await method.handleAsync(RequestedModeMethodTests.request(ShellClients.mainProcess, send));
    const theirs = await method.handleAsync(RequestedModeMethodTests.request(ShellClients.commandLine, send));
    const error = await method.handleAsync(RequestedModeMethodTests.request(ShellClients.commandLine, failing)).then(() => null, (t: unknown) => t);
    const refused = RequestedModeMethodTests.wrapped([], answered, new ServiceException(ErrorCode.Unauthorized, "Refused", ["fake", "acceptEdits"]), t => {
      outside.push(t);
      return Promise.resolve("marked");
    });
    const unauthorized = await refused.handleAsync(RequestedModeMethodTests.request(ShellClients.commandLine, send)).then(() => null, (t: unknown) => t);

    Assert.areEqual("null,marked", [String(own), theirs].join(","));
    Assert.areEqual(FailureCode.NotFound, error instanceof MethodFailureException ? error.failure.code : error);
    Assert.areEqual(FailureCode.Unauthorized, unauthorized instanceof MethodFailureException ? unauthorized.failure.code : unauthorized);
    Assert.areEqual(JSON.stringify(["acceptEdits", "none"]), JSON.stringify(checked));
    Assert.areEqual(JSON.stringify([send, failing]), JSON.stringify(outside));
    Assert.areEqual(JSON.stringify([send]), JSON.stringify(answered));
  }

  private static wrapped(checked: string[], answered: JsonValue[], refusal: Error | null,
    outside: ((payload: JsonValue) => Promise<JsonValue>) | null = null): RequestedModeMethod {
    const inner: IMethodHandler = {
      handleAsync: (request: RequestContext): Promise<JsonValue> => {
        answered.push(request.payload);
        return Promise.resolve(null);
      }
    };
    return new RequestedModeMethod(inner, {
      refuseRaisedModeAsync: (params: MessageSendParams): Promise<void> => {
        checked.push(params.requested?.mode ?? "none");
        return Object.isNull(refusal) ? Promise.resolve() : Promise.reject(refusal);
      }
    }, t => MessageSendParams.fromJson(t), outside);
  }

  private static request(client: string, payload: JsonValue): RequestContext {
    return new RequestContext(client, payload, new AbortController().signal, 1);
  }
}
