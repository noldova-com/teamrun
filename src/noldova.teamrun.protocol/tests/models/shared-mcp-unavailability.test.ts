/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ArgumentException } from "@noldova/context.exceptions";
import { JsonException } from "@noldova/context.json";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { SharedMcpUnavailability } from "@noldova/teamrun.protocol";

@TestClass
export class SharedMcpUnavailabilityTests {
  @TestMethod
  public namesTheProviderAndWhy(): void {
    const json = { providerId: "p1", reason: "Not yet confirmed.", short: null };

    Assert.areEqual(JSON.stringify(json), JSON.stringify(SharedMcpUnavailability.fromJson(json).toJson()));
    Assert.areEqual("$.u.reason", Assert.throws(() => SharedMcpUnavailability.fromJson({ providerId: "p1", reason: " " }, "$.u"), JsonException).path);
    Assert.throws(() => new SharedMcpUnavailability(" ", "Why."), ArgumentException);
    Assert.throws(() => new SharedMcpUnavailability("p1", " "), ArgumentException);
  }

  @TestMethod
  public carriesTheReasonInAFewWordsAndReadsAnOlderValueWithoutItAsNone(): void {
    const json = { providerId: "p1", reason: "TeamRun doesn't pass a signed-in server's token to Codex yet.", short: "sign-in not passed yet" };

    Assert.areEqual(JSON.stringify(json), JSON.stringify(SharedMcpUnavailability.fromJson(json).toJson()));
    Assert.areEqual("in short", new SharedMcpUnavailability("p1", "Why.", "in short").short);
    Assert.isNull(SharedMcpUnavailability.fromJson({ providerId: "p1", reason: "Why." }).short);
    Assert.isNull(new SharedMcpUnavailability("p1", "Why.").short);
    Assert.areEqual("$.u.short", Assert.throws(() => SharedMcpUnavailability.fromJson({ providerId: "p1", reason: "Why.", short: 3 }, "$.u"), JsonException).path);
    Assert.throws(() => new SharedMcpUnavailability("p1", "Why.", " "), ArgumentException);
  }
}
