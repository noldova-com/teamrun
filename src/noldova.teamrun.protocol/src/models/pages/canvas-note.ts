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

import { CanvasNoteKind } from "../../enums/pages/canvas-note-kind.js";
import { CanvasChecks } from "./canvas-checks.js";
import { CanvasResources } from "./canvas-resources.js";
import { PageAuthor } from "./page-author.js";

export class CanvasNote {
  public readonly id: string;
  public readonly canvasPage: string;
  public readonly x: number;
  public readonly y: number;
  public readonly width: number;
  public readonly kind: CanvasNoteKind;
  public readonly text: string;
  public readonly href: string | null;
  public readonly author: PageAuthor;
  public readonly at: string;

  public constructor(id: string, canvasPage: string, x: number, y: number, width: number, kind: CanvasNoteKind, text: string, href: string | null,
    author: PageAuthor, at: string) {
    ArgumentException.throwIfNullOrWhitespace(id, CanvasResources.idField);
    ArgumentException.throwIfNullOrWhitespace(canvasPage, CanvasResources.canvasPageField);
    CanvasChecks.requireFinite(CanvasResources.xField, x);
    CanvasChecks.requireFinite(CanvasResources.yField, y);
    CanvasChecks.requirePositive(CanvasResources.widthField, width);
    if (!Object.values(CanvasNoteKind).includes(kind))
      throw new ArgumentOutOfRangeException(CanvasResources.kindField, kind);
    ArgumentException.throwIfNullOrWhitespace(text, CanvasResources.textField);
    if (kind === CanvasNoteKind.Link || !Object.isNull(href))
      ArgumentException.throwIfNullOrWhitespace(href, CanvasResources.hrefField);
    ArgumentException.throwIfNullOrWhitespace(at, CanvasResources.atField);
    CanvasChecks.requireLength(CanvasResources.idField, id);

    this.id = id;
    this.canvasPage = canvasPage;
    this.x = x;
    this.y = y;
    this.width = width;
    this.kind = kind;
    this.text = text;
    this.href = href;
    this.author = author;
    this.at = at;
  }

  public static fromJson(value: unknown, path?: string): CanvasNote {
    const reader = JsonReader.fromValue(value, path);
    const author = reader.readObject(CanvasResources.authorField);
    return new CanvasNote(
      reader.readNonBlankString(CanvasResources.idField),
      reader.readNonBlankString(CanvasResources.canvasPageField),
      reader.readNumber(CanvasResources.xField),
      reader.readNumber(CanvasResources.yField),
      reader.readNumber(CanvasResources.widthField),
      reader.readOneOf(CanvasResources.kindField, Object.values(CanvasNoteKind)),
      reader.readNonBlankString(CanvasResources.textField),
      reader.readNullableString(CanvasResources.hrefField),
      PageAuthor.fromJson(author.toJson(), author.path),
      reader.readNonBlankString(CanvasResources.atField));
  }

  public toJson(): JsonObject {
    return {
      [CanvasResources.idField]: this.id,
      [CanvasResources.canvasPageField]: this.canvasPage,
      [CanvasResources.xField]: this.x,
      [CanvasResources.yField]: this.y,
      [CanvasResources.widthField]: this.width,
      [CanvasResources.kindField]: this.kind,
      [CanvasResources.textField]: this.text,
      [CanvasResources.hrefField]: this.href,
      [CanvasResources.authorField]: this.author.toJson(),
      [CanvasResources.atField]: this.at
    };
  }
}
