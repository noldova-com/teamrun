/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { ArgumentException } from "@noldova/context.exceptions";
import { JsonReader, type JsonObject } from "@noldova/context.json";

import { CanvasArtboard } from "./canvas-artboard.js";
import { CanvasGuide } from "./canvas-guide.js";
import { CanvasMark } from "./canvas-mark.js";
import { CanvasNote } from "./canvas-note.js";
import { CanvasPage } from "./canvas-page.js";
import { CanvasResources } from "./canvas-resources.js";

export class CanvasManifest {
  public readonly pages: readonly CanvasPage[];
  public readonly artboards: readonly CanvasArtboard[];
  public readonly notes: readonly CanvasNote[];
  public readonly marks: readonly CanvasMark[];
  public readonly guides: readonly CanvasGuide[];

  public constructor(pages: readonly CanvasPage[], artboards: readonly CanvasArtboard[], notes: readonly CanvasNote[], marks: readonly CanvasMark[],
    guides: readonly CanvasGuide[]) {
    if (pages.length === 0)
      throw new ArgumentException(CanvasResources.noPages, CanvasResources.pagesField);
    const ids = [...pages, ...artboards, ...notes, ...marks].map(t => t.id);
    if (new Set(ids).size !== ids.length)
      throw new ArgumentException(CanvasResources.duplicateId, CanvasResources.idField);
    const pageIds = new Set(pages.map(t => t.id));
    if ([...artboards, ...notes, ...marks, ...guides].some(t => !pageIds.has(t.canvasPage)))
      throw new ArgumentException(CanvasResources.unknownCanvasPage, CanvasResources.canvasPageField);

    this.pages = [...pages];
    this.artboards = [...artboards];
    this.notes = [...notes];
    this.marks = [...marks];
    this.guides = [...guides];
  }

  public static fromJson(value: unknown, path?: string): CanvasManifest {
    const reader = JsonReader.fromValue(value, path);
    return new CanvasManifest(
      reader.readObjectArray(CanvasResources.pagesField).map(t => CanvasPage.fromJson(t.toJson(), t.path)),
      reader.readObjectArray(CanvasResources.artboardsField).map(t => CanvasArtboard.fromJson(t.toJson(), t.path)),
      reader.readObjectArray(CanvasResources.notesField).map(t => CanvasNote.fromJson(t.toJson(), t.path)),
      reader.readObjectArray(CanvasResources.marksField).map(t => CanvasMark.fromJson(t.toJson(), t.path)),
      reader.readObjectArray(CanvasResources.guidesField).map(t => CanvasGuide.fromJson(t.toJson(), t.path)));
  }

  public toJson(): JsonObject {
    return {
      [CanvasResources.pagesField]: this.pages.map(t => t.toJson()),
      [CanvasResources.artboardsField]: this.artboards.map(t => t.toJson()),
      [CanvasResources.notesField]: this.notes.map(t => t.toJson()),
      [CanvasResources.marksField]: this.marks.map(t => t.toJson()),
      [CanvasResources.guidesField]: this.guides.map(t => t.toJson())
    };
  }
}
