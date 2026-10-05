/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Component, type Type } from "@angular/core";

import { ArgumentException } from "@noldova/teamrun-foundation-exceptions";

import { ContentPadding } from "../../../src/app/enums/content-padding";
import { DocumentContribution } from "../../../src/app/models/document-contribution";

@Component({ template: "" })
class NoteDocumentComponent {
}

describe("DocumentContribution", () => {
  const load = (): Promise<Type<unknown>> => Promise.resolve(NoteDocumentComponent);

  it("keeps its name and loader", async () => {
    const document = new DocumentContribution("notes.note", load);

    expect(document.name).toBe("notes.note");
    expect(await document.loadComponent()).toBe(NoteDocumentComponent);
  });

  it("leaves its padding to its module unless it declares one", () => {
    expect([new DocumentContribution("notes.note", load).padding, new DocumentContribution("notes.note", load, ContentPadding.None).padding]).toEqual([null, ContentPadding.None]);
  });

  it("refuses a name without its module id", () => {
    expect(() => new DocumentContribution("note", load)).toThrowError(ArgumentException);
  });
});
