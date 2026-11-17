/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { resolve } from "node:path";

import "@noldova/context.core";
import { ArgumentException } from "@noldova/context.exceptions";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { ProfileSearch, Resources } from "@noldova/teamrun.core";

@TestClass
export class ProfileSearchTests {
  @TestMethod
  public holdsItsFoldersAndEntriesAsCopies(): void {
    const folders = [resolve("home", ".fake")];
    const entries = ["settings.json"];
    const skipped = [resolve("profiles", "fake", "title-home")];
    const search = new ProfileSearch(folders, entries, skipped);
    folders.push(resolve("other"));
    entries.push("projects");
    skipped.push(resolve("other"));

    Assert.areEqual(resolve("home", ".fake"), search.folders.join());
    Assert.areEqual("settings.json", search.entries.join());
    Assert.areEqual(resolve("profiles", "fake", "title-home"), search.skipped.join());
    Assert.areEqual(0, new ProfileSearch([], ["marker"]).folders.length);
    Assert.areEqual(0, new ProfileSearch([], ["marker"]).skipped.length);
  }

  @TestMethod
  public refusesARelativeFolderOrSkippedFolderAndMissingOrBlankEntries(): void {
    const relative = Assert.throws(() => new ProfileSearch(["home/.fake"], ["settings.json"]), ArgumentException);
    const skipped = Assert.throws(() => new ProfileSearch([], ["settings.json"], ["title-home"]), ArgumentException);
    const none = Assert.throws(() => new ProfileSearch([], []), ArgumentException);
    const blank = Assert.throws(() => new ProfileSearch([], ["settings.json", " "]), ArgumentException);

    Assert.areEqual(Resources.foldersParameterName, relative.parameterName);
    Assert.isTrue(relative.message.startsWith(Resources.profileSearchFolderNotAbsolute));
    Assert.areEqual([Resources.entriesParameterName, Resources.entriesParameterName].join(), [none.parameterName, blank.parameterName].join());
    Assert.isTrue(none.message.startsWith(Resources.profileSearchWithoutEntries));
    Assert.areEqual(Resources.skippedParameterName, skipped.parameterName);
    Assert.isTrue(skipped.message.startsWith(Resources.profileSearchSkippedNotAbsolute));
  }
}
