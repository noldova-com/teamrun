/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ServiceException, ServiceResponse, ServiceResponseInfo, ServiceResponseStatus } from "@noldova/teamrun-foundation-services";
import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";

import { Note } from "../fixtures/note.fixture.js";

@TestClass
export class ServiceResponseTests {
  private static readonly notFound: ServiceResponseInfo = new ServiceResponseInfo("notFound", "The note \"n1\" does not exist.", ["n1"]);

  @TestMethod
  public succeedsWithAPayload(): void {
    const response = ServiceResponse.success(new Note("n1", "hello"));
    const empty = ServiceResponse.success(null);

    Assert.areEqual(ServiceResponseStatus.Success, response.status);
    Assert.isFalse(response.hasErrors);
    Assert.isNull(response.info);
    Assert.areEqual("hello", response.payload?.text);
    Assert.isNull(empty.payload);
    Assert.isFalse(empty.hasErrors);
  }

  @TestMethod
  public failsWithInfoAndNoPayload(): void {
    const response = ServiceResponse.failure<Note>(ServiceResponseTests.notFound);

    Assert.areEqual(ServiceResponseStatus.Failure, response.status);
    Assert.isTrue(response.hasErrors);
    Assert.areEqual("notFound", response.info?.name);
    Assert.isNull(response.payload);
  }

  @TestMethod
  public carriesAnotherResponseOutward(): void {
    const failure = ServiceResponse.from<Note>(ServiceResponse.failure<number>(ServiceResponseTests.notFound));
    const success = ServiceResponse.from<Note>(ServiceResponse.success(42));

    Assert.isTrue(failure.hasErrors);
    Assert.areEqual(ServiceResponseTests.notFound, failure.info);
    Assert.isFalse(success.hasErrors);
    Assert.isNull(success.payload);
  }

  @TestMethod
  public turnsErrorsIntoFailures(): void {
    const fallback = new ServiceResponseInfo("internal", "The service failed.");

    const known = ServiceResponse.fromError<Note>(new ServiceException("conflict", "The note is locked.", ["n1"]), fallback);
    const unknown = ServiceResponse.fromError<Note>(new Error("boom"), fallback);

    Assert.areEqual("conflict", known.info?.name);
    Assert.areEqual("n1", known.info?.arguments.join(","));
    Assert.areEqual(fallback, unknown.info);
    Assert.isNull(known.payload);
  }
}
