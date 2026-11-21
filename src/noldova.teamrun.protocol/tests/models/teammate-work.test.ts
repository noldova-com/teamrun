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
import { TeammateDocument, TeammateWork } from "@noldova/teamrun.protocol";

@TestClass
export class TeammateWorkTests {
  private static readonly work: object = {
    teammateId: "tm-1", folder: "/work/app", folders: ["/work/app", "/work/site"],
    documents: [{ path: "/work/app/README.md", chatId: "c-1", changedAt: "2026-11-20T10:00:00.000Z" }]
  };

  @TestMethod
  public roundTripsThroughJson(): void {
    const work = TeammateWork.fromJson(TeammateWorkTests.work);

    Assert.areEqual(JSON.stringify(TeammateWorkTests.work), JSON.stringify(work.toJson()));
    Assert.areEqual("/work/app/README.md", work.documents[0]?.path);
  }

  @TestMethod
  public takesATeammateThatHasNotAnswered(): void {
    const work = TeammateWork.fromJson({ teammateId: "tm-1", folder: null, folders: [], documents: [] });

    Assert.areEqual(JSON.stringify([null, 0, 0]), JSON.stringify([work.folder, work.folders.length, work.documents.length]));
  }

  @TestMethod
  public keepsItsOwnCopiesOfTheLists(): void {
    const folders = ["/work/app"];
    const documents = [new TeammateDocument("/work/app/notes.txt", "c-1", "2026-11-20T10:00:00.000Z")];
    const work = new TeammateWork("tm-1", "/work/app", folders, documents);
    folders.push("/work/site");
    documents.pop();

    Assert.areEqual(JSON.stringify([1, 1]), JSON.stringify([work.folders.length, work.documents.length]));
  }

  @TestMethod
  public refusesABlankIdOrALatestFolderOutsideItsFolders(): void {
    Assert.throws(() => new TeammateWork(" ", null, [], []), ArgumentException);
    Assert.throws(() => new TeammateWork("tm-1", "/work/other", ["/work/app"], []), ArgumentException);
    Assert.throws(() => TeammateWork.fromJson({ ...TeammateWorkTests.work, folders: null }), JsonException);
    Assert.throws(() => TeammateWork.fromJson({ ...TeammateWorkTests.work, documents: [{ path: "/a.md", chatId: "c-1" }] }), JsonException);
  }

  @TestMethod
  public refusesADocumentWithABlankValue(): void {
    Assert.throws(() => new TeammateDocument(" ", "c-1", "2026-11-20T10:00:00.000Z"), ArgumentException);
    Assert.throws(() => new TeammateDocument("/a.md", " ", "2026-11-20T10:00:00.000Z"), ArgumentException);
    Assert.throws(() => new TeammateDocument("/a.md", "c-1", " "), ArgumentException);
  }
}
