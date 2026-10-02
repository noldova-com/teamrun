/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { JsonException } from "@noldova/teamrun-foundation-json";

import { BuildInfo } from "../../../src/app/models/build-info";

describe("BuildInfo", () => {
  it("reads the product version and fingerprint from the build's identity", () => {
    const build = BuildInfo.fromJson({ productVersion: "1.2.3", protocolVersion: 1, fingerprint: "abc123" });

    expect([build.productVersion, build.fingerprint]).toEqual(["1.2.3", "abc123"]);
  });

  it("refuses an identity without them", () => {
    expect(() => BuildInfo.fromJson({ productVersion: "1.2.3" })).toThrowError(JsonException);
    expect(() => BuildInfo.fromJson(null)).toThrowError(JsonException);
  });
});
