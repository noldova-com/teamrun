/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { FailureCode } from "@noldova/desktop.protocol";
import { MethodFailureException, RequestContext } from "@noldova/desktop.runtime";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import type { RequestDispatcher } from "@noldova/teamrun.core";
import { type Request, Response } from "@noldova/teamrun.protocol";
import { ServiceResponseInfo } from "@noldova/teamrun.services";
import { DispatchedMethod } from "@noldova/teamrun.runtime";

@TestClass
export class DispatchedMethodTests {
  @TestMethod
  public async answersWithTheDispatchersPayloadForItsMethod(): Promise<void> {
    const requests: Request[] = [];
    const method = new DispatchedMethod("ProjectList", DispatchedMethodTests.dispatcher(requests, Response.success("runtime", [1, 2])));

    const payload = await method.handleAsync(DispatchedMethodTests.context({ any: "payload" }));

    Assert.areEqual("[1,2]", JSON.stringify(payload));
    Assert.areEqual("ProjectList", requests[0]?.method);
    Assert.areEqual("{\"any\":\"payload\"}", JSON.stringify(requests[0]?.payload));
  }

  @TestMethod
  public async passesTheRequestsSignalToTheDispatcher(): Promise<void> {
    const signals: (AbortSignal | undefined)[] = [];
    const dispatcher = {
      dispatch: (_request: Request, signal?: AbortSignal) => {
        signals.push(signal);
        return Promise.resolve(Response.success("runtime", null));
      }
    } as unknown as RequestDispatcher;
    const context = DispatchedMethodTests.context(null);

    await new DispatchedMethod("ProviderSignIn", dispatcher).handleAsync(context);

    Assert.areEqual(1, signals.length);
    Assert.isTrue(signals[0] === context.signal);
  }

  @TestMethod
  public async failsWithDesktopCoresCodeOrInternalAndKeepsTeamRunsErrorInTheDetails(): Promise<void> {
    const known = new DispatchedMethod("ProjectOpen", DispatchedMethodTests.dispatcher([], Response.failure("runtime", new ServiceResponseInfo("NotFound", "No such project.", ["projectId"]))));
    const unknown = new DispatchedMethod("MessageSend", DispatchedMethodTests.dispatcher([], Response.failure("runtime", new ServiceResponseInfo("ProviderError", "The provider failed."))));

    const knownFailure = await DispatchedMethodTests.failure(known);
    const unknownFailure = await DispatchedMethodTests.failure(unknown);

    Assert.areEqual(FailureCode.NotFound, knownFailure.failure.code);
    Assert.areEqual("No such project.", knownFailure.failure.message);
    Assert.areEqual("{\"error\":\"NotFound\",\"arguments\":[\"projectId\"]}", JSON.stringify(knownFailure.failure.details));
    Assert.areEqual(FailureCode.Internal, unknownFailure.failure.code);
    Assert.areEqual("{\"error\":\"ProviderError\",\"arguments\":[]}", JSON.stringify(unknownFailure.failure.details));
  }

  private static async failure(method: DispatchedMethod): Promise<MethodFailureException> {
    const error = await method.handleAsync(DispatchedMethodTests.context(null)).then(() => null, (t: unknown) => t);
    Assert.isInstanceOf(error, MethodFailureException);
    return error as MethodFailureException;
  }

  private static dispatcher(requests: Request[], response: Response): RequestDispatcher {
    return {
      dispatch: (request: Request) => {
        requests.push(request);
        return Promise.resolve(response);
      }
    } as unknown as RequestDispatcher;
  }

  private static context(payload: { any: string } | null): RequestContext {
    return new RequestContext("tests", payload, new AbortController().signal, 1);
  }
}
