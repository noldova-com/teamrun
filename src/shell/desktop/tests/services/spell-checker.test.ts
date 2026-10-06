/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { SpellChecker } from "@noldova/teamrun-shell-desktop";

import { FakeSession } from "../fixtures/fake-session.fixture.js";

@TestClass
export class SpellCheckerTests {
  private static readonly ADDRESS: string = "file:///profile/Dictionaries/";

  @TestMethod
  public startsByPointingTheDownloadAtTheProfilesOwnFolderAndCheckingInTheSystemsLanguagesThatShip(): void {
    const session = new FakeSession();
    const checker = new SpellChecker(() => session, ["en-US", "de-DE"], SpellCheckerTests.ADDRESS, "linux", () => ["fr-FR", "de-de", "de-DE"], () => undefined);

    checker.start();

    Assert.areEqual(`url ${SpellCheckerTests.ADDRESS}|languages de-DE`, session.spellCalls.join("|"));
    Assert.areEqual("{\"languages\":[\"en-US\",\"de-DE\"],\"fallback\":null}", JSON.stringify(checker.toJson()));
  }

  @TestMethod
  public fallsBackToTheFirstShippedLanguageWhenNoneOfTheSystemsShips(): void {
    const session = new FakeSession();
    const checker = new SpellChecker(() => session, ["en-US", "de-DE"], SpellCheckerTests.ADDRESS, "win32", () => ["fr-FR"], () => undefined);

    checker.start();

    Assert.areEqual(`url ${SpellCheckerTests.ADDRESS}|languages en-US`, session.spellCalls.join("|"));
    Assert.areEqual("{\"languages\":[\"en-US\",\"de-DE\"],\"fallback\":\"en-US\"}", JSON.stringify(checker.toJson()));
  }

  @TestMethod
  public appliesWhetherToCheckAndTheChosenLanguagesThatShipInTheirShippedOrder(): void {
    const session = new FakeSession();
    const checker = new SpellChecker(() => session, ["en-US", "de-DE"], SpellCheckerTests.ADDRESS, "linux", () => ["en-US"], () => undefined);

    checker.apply(false, ["de-DE", "xx-XX", "en-US"]);
    checker.apply(true, ["xx-XX"]);

    Assert.areEqual("enabled false|languages en-US,de-DE|enabled true|languages en-US", session.spellCalls.join("|"));
  }

  @TestMethod
  public leavesTheLanguagesToMacOSAndOffersNone(): void {
    const session = new FakeSession();
    const checker = new SpellChecker(() => session, ["en-US"], SpellCheckerTests.ADDRESS, "darwin", () => ["fr-FR"], () => undefined);

    checker.start();
    checker.apply(false, ["en-US"]);

    Assert.areEqual("enabled false", session.spellCalls.join("|"));
    Assert.areEqual("{\"languages\":[],\"fallback\":null}", JSON.stringify(checker.toJson()));
  }

  @TestMethod
  public checksInNoLanguageAndOffersNoneWithoutAShippedDictionary(): void {
    const session = new FakeSession();
    const checker = new SpellChecker(() => session, [], SpellCheckerTests.ADDRESS, "linux", () => ["en-US"], () => undefined);

    checker.start();

    Assert.areEqual(`url ${SpellCheckerTests.ADDRESS}|languages `, session.spellCalls.join("|"));
    Assert.areEqual("{\"languages\":[],\"fallback\":null}", JSON.stringify(checker.toJson()));
  }

  @TestMethod
  public logsLanguagesTheSessionRefuses(): void {
    const session = new FakeSession();
    const lines: string[] = [];
    session.refusal = new Error("Unknown language.");
    const checker = new SpellChecker(() => session, ["en-US", "de-DE"], SpellCheckerTests.ADDRESS, "linux", () => [], t => lines.push(t));

    checker.apply(true, ["en-US", "de-DE"]);

    Assert.areEqual("enabled true", session.spellCalls.join("|"));
    Assert.areEqual("The spell checker refused the languages en-US, de-DE: Error: Unknown language.", lines.join("|"));
  }
}
