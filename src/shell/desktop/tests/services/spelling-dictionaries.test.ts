/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { existsSync, readFileSync } from "node:fs";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { SpellingDictionaries } from "@noldova/teamrun-shell-desktop";

@TestClass
export class SpellingDictionariesTests {
  @TestMethod
  public async putsEachShippedDictionaryInTheProfileOnceAndOffersTheirLanguagesInTheirOrder(): Promise<void> {
    await SpellingDictionariesTests.withFoldersAsync(async (source, profile) => {
      await SpellingDictionariesTests.shipAsync(source, [["en-US", "en-US-10-1.bdic"], ["de-DE", "de-DE-3-0.bdic"]]);
      const lines: string[] = [];

      const first = SpellingDictionaries.install(source, profile, t => lines.push(t));
      await writeFile(join(source, "en-US-10-1.bdic"), "changed");
      const second = SpellingDictionaries.install(source, profile, t => lines.push(t));

      Assert.areEqual("en-US,de-DE|en-US,de-DE", `${first.join(",")}|${second.join(",")}`);
      Assert.areEqual("en-US-10-1.bdic|de-DE-3-0.bdic", [
        readFileSync(join(profile, "Dictionaries", "en-US-10-1.bdic"), "utf8"), readFileSync(join(profile, "Dictionaries", "de-DE-3-0.bdic"), "utf8")].join("|"));
      Assert.isFalse(existsSync(join(profile, "Dictionaries", "en-US-10-1.bdic.tmp")));
      Assert.areEqual(0, lines.length);
    });
  }

  @TestMethod
  public async offersNoLanguageWhenItsListIsMissingOrIsNotAList(): Promise<void> {
    await SpellingDictionariesTests.withFoldersAsync(async (source, profile) => {
      const lines: string[] = [];

      const missing = SpellingDictionaries.install(source, profile, t => lines.push(t));
      await writeFile(join(source, "dictionaries.json"), "{\"dictionaries\": {}}");
      const malformed = SpellingDictionaries.install(source, profile, t => lines.push(t));

      Assert.areEqual(0, missing.length + malformed.length);
      Assert.areEqual(2, lines.filter(t => t.startsWith("The list of shipped dictionaries could not be read, so no spelling language is offered: ")).length);
      Assert.isFalse(existsSync(join(profile, "Dictionaries")));
    });
  }

  @TestMethod
  public async leavesOutAnEntryWhoseLanguageOrFileIsNotValidOrWhoseFileIsMissing(): Promise<void> {
    await SpellingDictionariesTests.withFoldersAsync(async (source, profile) => {
      await SpellingDictionariesTests.shipAsync(source, [["../en", "en-US-10-1.bdic"], ["fr-FR", "../fr-FR-3-0.bdic"], ["it-IT", "it-IT-3-0.bdic"], ["en-US", "en-US-10-1.bdic"]]);
      await rm(join(source, "it-IT-3-0.bdic"));
      const lines: string[] = [];

      const languages = SpellingDictionaries.install(source, profile, t => lines.push(t));

      Assert.areEqual("en-US", languages.join(","));
      Assert.areEqual(3, lines.filter(t => t.startsWith("A shipped dictionary could not be put in the profile, so its language is not offered: ")).length);
      Assert.isTrue(lines[0]?.includes("\"../en\" is not a language tag or a dictionary file name.") === true, lines.join("\n"));
      Assert.isTrue(lines[1]?.includes("$.dictionaries.1.file") === true, lines.join("\n"));
    });
  }

  @TestMethod
  public givesTheProfilesDictionaryFolderAsAFileAddressEndingInASlash(): void {
    const profile = join(tmpdir(), "teamrun profile");

    const address = SpellingDictionaries.addressOf(profile);

    Assert.areEqual(`${pathToFileURL(join(profile, "Dictionaries")).href}/`, address);
    Assert.isTrue(address.startsWith("file:///") && address.includes("teamrun%20profile/Dictionaries/"), address);
  }

  private static async shipAsync(source: string, dictionaries: readonly (readonly [string, string])[]): Promise<void> {
    await writeFile(join(source, "dictionaries.json"), JSON.stringify({ dictionaries: dictionaries.map(([language, file]) => ({ language, file })) }));
    for (const [, file] of dictionaries)
      if (!file.includes("/"))
        await writeFile(join(source, file), file);
  }

  private static async withFoldersAsync(action: (source: string, profile: string) => Promise<void>): Promise<void> {
    const root = await mkdtemp(join(tmpdir(), "teamrun-dictionaries-"));
    try {
      await mkdir(join(root, "source"));
      await action(join(root, "source"), join(root, "profile"));
    }
    finally {
      await rm(root, { recursive: true, force: true });
    }
  }
}
