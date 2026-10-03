/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/teamrun-foundation-core";
import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { DiagnosticRedactor } from "@noldova/teamrun-shell-runtime";

@TestClass
export class DiagnosticRedactorTests {
  @TestMethod
  public showsTheHomeFolderAsATildeWithEitherSeparatorAndInAnyCase(): void {
    const redactor = new DiagnosticRedactor("C:\\Users\\Person (1)");

    Assert.areEqual(
      "~\\notes and ~/notes and ~\\x",
      redactor.redact("C:\\Users\\Person (1)\\notes and c:/users/person (1)/notes and C:/USERS\\PERSON (1)\\x"));
  }

  @TestMethod
  public replacesOpaqueValuesAndKeepsShorterWords(): void {
    const redactor = new DiagnosticRedactor("/home/person");

    Assert.areEqual(
      "token [redacted] for /home/other, id abc-123",
      redactor.redact(`token ${"a1B2_c3D4-".repeat(4)} for /home/other, id abc-123`));
  }
}
