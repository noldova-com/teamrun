/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ServiceRequest } from "@noldova/teamrun-foundation-services";
import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";

import { Note } from "../fixtures/note.fixture.js";

@TestClass
export class ServiceRequestTests {
  @TestMethod
  public carriesATypedPayload(): void {
    const request = new ServiceRequest(new Note("n1", "hello"));
    const empty = new ServiceRequest(null);

    Assert.areEqual("n1", request.payload.id);
    Assert.isNull(empty.payload);
  }
}
