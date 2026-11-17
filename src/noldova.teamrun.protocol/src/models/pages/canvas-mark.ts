/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { ArgumentException, ArgumentOutOfRangeException } from "@noldova/context.exceptions";
import { JsonReader, type JsonObject } from "@noldova/context.json";

import { CanvasMarkKind } from "../../enums/pages/canvas-mark-kind.js";
import { CanvasChecks } from "./canvas-checks.js";
import { CanvasResources } from "./canvas-resources.js";
import { PageAuthor } from "./page-author.js";

export class CanvasMark {
  public readonly id: string;
  public readonly canvasPage: string;
  public readonly kind: CanvasMarkKind;
  public readonly geometry: readonly number[];
  public readonly colour: string;
  public readonly weight: number;
  public readonly fill: string | null;
  public readonly text: string | null;
  public readonly group: string | null;
  public readonly locked: boolean;
  public readonly hidden: boolean;
  public readonly author: PageAuthor;

  public constructor(id: string, canvasPage: string, kind: CanvasMarkKind, geometry: readonly number[], colour: string, weight: number, fill: string | null,
    text: string | null, group: string | null, locked: boolean, hidden: boolean, author: PageAuthor) {
    ArgumentException.throwIfNullOrWhitespace(id, CanvasResources.idField);
    ArgumentException.throwIfNullOrWhitespace(canvasPage, CanvasResources.canvasPageField);
    if (!Object.values(CanvasMarkKind).includes(kind))
      throw new ArgumentOutOfRangeException(CanvasResources.kindField, kind);
    if (geometry.length < 2 || geometry.length % 2 !== 0)
      throw new ArgumentOutOfRangeException(CanvasResources.geometryField, geometry.length);
    for (const value of geometry)
      CanvasChecks.requireFinite(CanvasResources.geometryField, value);
    ArgumentException.throwIfNullOrWhitespace(colour, CanvasResources.colourField);
    CanvasChecks.requirePositive(CanvasResources.weightField, weight);
    if (!Object.isNull(fill))
      ArgumentException.throwIfNullOrWhitespace(fill, CanvasResources.fillField);
    if (kind === CanvasMarkKind.Text || !Object.isNull(text))
      ArgumentException.throwIfNullOrWhitespace(text, CanvasResources.textField);
    if (!Object.isNull(group))
      ArgumentException.throwIfNullOrWhitespace(group, CanvasResources.groupField);
    CanvasChecks.requireLength(CanvasResources.idField, id);

    this.id = id;
    this.canvasPage = canvasPage;
    this.kind = kind;
    this.geometry = [...geometry];
    this.colour = colour;
    this.weight = weight;
    this.fill = fill;
    this.text = text;
    this.group = group;
    this.locked = locked;
    this.hidden = hidden;
    this.author = author;
  }

  public static fromJson(value: unknown, path?: string): CanvasMark {
    const reader = JsonReader.fromValue(value, path);
    const author = reader.readObject(CanvasResources.authorField);
    return new CanvasMark(
      reader.readNonBlankString(CanvasResources.idField),
      reader.readNonBlankString(CanvasResources.canvasPageField),
      reader.readOneOf(CanvasResources.kindField, Object.values(CanvasMarkKind)),
      reader.readNumberArray(CanvasResources.geometryField),
      reader.readNonBlankString(CanvasResources.colourField),
      reader.readNumber(CanvasResources.weightField),
      reader.readNullableString(CanvasResources.fillField),
      reader.readNullableString(CanvasResources.textField),
      reader.readNullableString(CanvasResources.groupField),
      reader.readBoolean(CanvasResources.lockedField),
      reader.readBoolean(CanvasResources.hiddenField),
      PageAuthor.fromJson(author.toJson(), author.path));
  }

  public toJson(): JsonObject {
    return {
      [CanvasResources.idField]: this.id,
      [CanvasResources.canvasPageField]: this.canvasPage,
      [CanvasResources.kindField]: this.kind,
      [CanvasResources.geometryField]: [...this.geometry],
      [CanvasResources.colourField]: this.colour,
      [CanvasResources.weightField]: this.weight,
      [CanvasResources.fillField]: this.fill,
      [CanvasResources.textField]: this.text,
      [CanvasResources.groupField]: this.group,
      [CanvasResources.lockedField]: this.locked,
      [CanvasResources.hiddenField]: this.hidden,
      [CanvasResources.authorField]: this.author.toJson()
    };
  }
}
