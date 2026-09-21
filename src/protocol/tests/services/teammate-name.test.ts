/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ArgumentException } from "@noldova/teamrun-foundation-exceptions";
import { JsonException, JsonReader } from "@noldova/teamrun-foundation-json";
import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { TeammateName } from "@noldova/teamrun-protocol";

@TestClass
export class TeammateNameTests {
  @TestMethod
  public boundsNamesToThirtyTwoNormalizedUnicodeCharacters(): void {
    for (const name of ["a", "a".repeat(32), "𐐀".repeat(32), "É".repeat(32).normalize("NFD")]) {
      TeammateName.validate(name);
      Assert.areEqual(name, TeammateName.read(JsonReader.fromValue({ name })));
    }
    for (const name of ["a".repeat(33), "a".repeat(5000), "𐐀".repeat(33), "É".repeat(33).normalize("NFD"), "a".repeat(32) + "\n"]) {
      Assert.isTrue(Assert.throws(() => TeammateName.validate(name), ArgumentException).message.includes("1 to 32"));
      Assert.areEqual("$.teammate.name", Assert.throws(() =>
        TeammateName.read(JsonReader.fromValue({ name }, "$.teammate")), JsonException).path);
    }
  }

  @TestMethod
  public validatesUnicodeNamesAndUsesStableComparisonKeys(): void {
    for (const name of ["Alice", "a-b_12", "Équipe", "日本語", "ÉQUIPE".normalize("NFD")])
      TeammateName.validate(name);
    Assert.areEqual(TeammateName.key("Équipe"), TeammateName.key("ÉQUIPE".normalize("NFD")));
    for (const name of ["", " ", "two words", "@alice", "alice.foo", "<alice>", "a/b"])
      Assert.throws(() => TeammateName.validate(name), ArgumentException);
    Assert.areEqual("Alice", TeammateName.read(JsonReader.fromValue({ name: "Alice" })));
    Assert.areEqual("$.name", Assert.throws(() => TeammateName.read(JsonReader.fromValue({ name: "bad name" })), JsonException).path);
  }
}
