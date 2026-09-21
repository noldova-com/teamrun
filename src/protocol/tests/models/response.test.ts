/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/teamrun-foundation-core";
import { ArgumentException } from "@noldova/teamrun-foundation-exceptions";
import { JsonException } from "@noldova/teamrun-foundation-json";
import { ServiceResponse, ServiceResponseInfo, ServiceResponseStatus } from "@noldova/teamrun-foundation-services";
import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { ErrorCode, Project, Response, WireMessageKind } from "@noldova/teamrun-protocol";

@TestClass
export class ResponseTests {
  private static readonly notFound: ServiceResponseInfo = new ServiceResponseInfo(ErrorCode.NotFound, "The project \"p\" does not exist.", ["p"]);
  private static readonly project: Project = new Project("p", "alpha", "D:/alpha", "2026-09-09T00:00:00.000Z");

  @TestMethod
  public succeedsWithAPayload(): void {
    const response = Response.success("r1", ResponseTests.project.toJson());
    const empty = Response.success("r2", null);

    Assert.areEqual(WireMessageKind.Response, response.kind);
    Assert.areEqual("r1", response.id);
    Assert.areEqual(ServiceResponseStatus.Success, response.status);
    Assert.isFalse(response.hasErrors);
    Assert.isNull(response.info);
    Assert.areEqual("alpha", Project.fromJson(response.payload).name);
    Assert.isNull(empty.payload);
  }

  @TestMethod
  public failsWithInfoAndAllowsANullIdForConnectionLevelFailures(): void {
    const response = Response.failure(null, ResponseTests.notFound);

    Assert.isNull(response.id);
    Assert.isTrue(response.hasErrors);
    Assert.areEqual(ErrorCode.NotFound, response.info?.name);
    Assert.areEqual("p", response.info?.arguments.join(","));
    Assert.isNull(response.payload);
  }

  @TestMethod
  public rejectsABlankIdOrAnUnknownErrorCode(): void {
    Assert.throws(() => Response.success(String.empty, null), ArgumentException);
    Assert.areEqual("info", Assert.throws(() => Response.failure("r1", new ServiceResponseInfo("mystery", "text")), ArgumentException).parameterName);
  }

  @TestMethod
  public convertsToAndFromTheServiceResponse(): void {
    const success = Response.fromServiceResponse("r1", ServiceResponse.success(ResponseTests.project), t => t.toJson());
    const empty = Response.fromServiceResponse("r2", ServiceResponse.from<Project>(ServiceResponse.success(null)), t => t.toJson());
    const failure = Response.fromServiceResponse("r3", ServiceResponse.failure<Project>(ResponseTests.notFound), t => t.toJson());

    const typed = success.withPayload(Project.fromJson);
    const typedEmpty = empty.withPayload(Project.fromJson);
    const typedFailure = failure.withPayload(Project.fromJson);

    Assert.areEqual("alpha", typed.payload?.name);
    Assert.isNull(empty.payload);
    Assert.isFalse(typedEmpty.hasErrors);
    Assert.isNull(typedEmpty.payload);
    Assert.isTrue(typedFailure.hasErrors);
    Assert.areEqual(ResponseTests.notFound, typedFailure.info);
    Assert.areEqual("$.payload.name", Assert.throws(() => Response.success("r4", { id: "p" }).withPayload(Project.fromJson), JsonException).path);
  }

  @TestMethod
  public roundTripsThroughJson(): void {
    const success = Response.fromJson(Response.success("r1", { ok: true }).toJson());
    const failure = Response.fromJson(Response.failure(null, ResponseTests.notFound).toJson());
    const text = "{\"kind\":\"Response\",\"id\":null,\"status\":\"Failure\",\"info\":{\"name\":\"NotFound\",\"message\":\"The project \\\"p\\\" does not exist.\",\"arguments\":[\"p\"]},\"payload\":null}";

    Assert.areEqual("r1", success.id);
    Assert.areEqual("{\"ok\":true}", JSON.stringify(success.payload));
    Assert.isNull(failure.id);
    Assert.areEqual(ErrorCode.NotFound, failure.info?.name);
    Assert.areEqual("The project \"p\" does not exist.", failure.info?.message);
    Assert.areEqual("p", failure.info?.arguments.join(","));
    Assert.areEqual(text, Response.failure(null, ResponseTests.notFound).toText());
  }

  @TestMethod
  public rejectsInconsistentJson(): void {
    const info = { name: "NotFound", message: "Missing.", arguments: [] };

    Assert.areEqual("$.status", Assert.throws(() => Response.fromJson({ id: "r1", status: "done", info: null, payload: null }), JsonException).path);
    Assert.areEqual("$.info.name", Assert.throws(() => Response.fromJson({ id: "r1", status: "Failure", info: { ...info, name: "mystery" }, payload: null }), JsonException).path);
    Assert.areEqual("$.payload", Assert.throws(() => Response.fromJson({ id: "r1", status: "Success", info: null }), JsonException).path);
    Assert.areEqual("info", Assert.throws(() => Response.fromJson({ id: "r1", status: "Success", info, payload: null }), ArgumentException).parameterName);
    Assert.areEqual("info", Assert.throws(() => Response.fromJson({ id: "r1", status: "Failure", info: null, payload: null }), ArgumentException).parameterName);
    Assert.areEqual("payload", Assert.throws(() => Response.fromJson({ id: "r1", status: "Failure", info, payload: {} }), ArgumentException).parameterName);
  }
}
