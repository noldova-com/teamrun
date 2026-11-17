/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ArgumentException } from "@noldova/context.exceptions";
import { JsonException, JsonReader } from "@noldova/context.json";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { TeammateName } from "@noldova/teamrun.protocol";

@TestClass
export class TeammateNameTests {
  @TestMethod
  public boundsNamesToOneHundredNormalizedUnicodeCharacters(): void {
    for (const name of ["a", "a".repeat(100), "𐐀".repeat(100), "É".repeat(100).normalize("NFD"), `${"a".repeat(49)} ${"b".repeat(50)}`]) {
      TeammateName.validate(name);
      Assert.areEqual(name, TeammateName.read(JsonReader.fromValue({ name })));
    }
    for (const name of ["a".repeat(101), "a".repeat(5000), "𐐀".repeat(101), "É".repeat(101).normalize("NFD"), `${"a".repeat(50)} ${"b".repeat(50)}`,
      "a".repeat(100) + "\n"]) {
      Assert.isTrue(Assert.throws(() => TeammateName.validate(name), ArgumentException).message.includes("1 to 100"));
      Assert.areEqual("$.teammate.name", Assert.throws(() =>
        TeammateName.read(JsonReader.fromValue({ name }, "$.teammate")), JsonException).path);
    }
  }

  @TestMethod
  public validatesUnicodeNamesAndUsesStableComparisonKeys(): void {
    for (const name of ["Alice", "a-b_12", "Équipe", "日本語", "ÉQUIPE".normalize("NFD"), "Code Reviewer", "QA lead 2", "a b c d"])
      TeammateName.validate(name);
    Assert.areEqual(TeammateName.key("Équipe"), TeammateName.key("ÉQUIPE".normalize("NFD")));
    for (const name of ["", " ", " Alice", "Alice ", "two  words", "two\twords", "two\nwords", "@alice", "alice.foo", "<alice>", "a/b"])
      Assert.throws(() => TeammateName.validate(name), ArgumentException);
    Assert.areEqual("Alice", TeammateName.read(JsonReader.fromValue({ name: "Alice" })));
    Assert.areEqual("$.name", Assert.throws(() => TeammateName.read(JsonReader.fromValue({ name: "bad  name" })), JsonException).path);
  }

  @TestMethod
  public acceptsWordsInAnyScriptWithTheMarksOfTheirLetters(): void {
    const faraz = "\u095E\u0930\u093E\u091C\u093C \u0959\u093E\u0928";
    for (const name of ["राहुल शर्मा", "प्रिया", "สมศักดิ์ ใจดี", "Nguyễn Văn An".normalize("NFD"), faraz, "कि".repeat(50)]) {
      TeammateName.validate(name);
      Assert.areEqual(name, TeammateName.read(JsonReader.fromValue({ name })));
    }
    Assert.areEqual(TeammateName.key(faraz), TeammateName.key(faraz.normalize("NFD")));
    Assert.isTrue(Assert.throws(() => TeammateName.validate(`${"कि".repeat(50)}क`), ArgumentException).message.includes("1 to 100 characters, where a separate accent or vowel sign counts as one"));
    for (const name of ["\u093Fराम", "राम \u093Fराम", "\u0E34", "Ana \u0301b", "राहुल\nशर्मा", "राहुल  शर्मा"])
      Assert.throws(() => TeammateName.validate(name), ArgumentException);
  }

  @TestMethod
  public keysNamesRegardlessOfCaseAndRepeatedSpaces(): void {
    Assert.areEqual(TeammateName.key("Code Reviewer"), TeammateName.key("code   REVIEWER"));
    Assert.areEqual(TeammateName.key("Code Reviewer"), TeammateName.key(" Code\tReviewer "));
    Assert.areNotEqual(TeammateName.key("Code Reviewer"), TeammateName.key("CodeReviewer"));
    Assert.areEqual(TeammateName.key("alice"), TeammateName.key("Alice"));
  }

  @TestMethod
  public takesInitialsFromTheFirstTwoWords(): void {
    const cases: readonly (readonly [string, string])[] = [
      ["Alice", "A"],
      ["Code Reviewer", "CR"],
      ["code reviewer lead", "CR"],
      ["équipe Ünd", "ÉÜ"],
      ["É".normalize("NFD") + "quipe", "É"],
      ["𐐨x 2nd", "𐐀2"],
      ["_x -y", "_-"]
    ];
    for (const [name, initials] of cases)
      Assert.areEqual(initials, TeammateName.initials(name), name);
  }
}
