/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { ArgumentException } from "@noldova/context.exceptions";
import { JsonException } from "@noldova/context.json";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { AttachmentShare } from "@noldova/teamrun.protocol";

@TestClass
export class AttachmentShareTests {
  @TestMethod
  public roundTripsThroughJson(): void {
    const json = { grant: "0123456789abcdef0123456789abcdef" };

    Assert.areEqual(JSON.stringify(json), JSON.stringify(AttachmentShare.fromJson(json).toJson()));
  }

  @TestMethod
  public rejectsABlankGrant(): void {
    Assert.throws(() => new AttachmentShare(" "), ArgumentException);
  }

  @TestMethod
  public rejectsAMissingGrantWithItsPath(): void {
    Assert.areEqual("$.grant", Assert.throws(() => AttachmentShare.fromJson({}), JsonException).path);
  }
}
