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

import { CanvasChecks } from "./canvas-checks.js";
import { CanvasResources } from "./canvas-resources.js";

export class CanvasArtboard {
  public readonly id: string;
  public readonly pageId: string;
  public readonly pageVersion: number;
  public readonly canvasPage: string;
  public readonly x: number;
  public readonly y: number;
  public readonly width: number;
  public readonly height: number;
  public readonly title: string;
  public readonly locked: boolean;
  public readonly hidden: boolean;
  public readonly group: string | null;

  public constructor(id: string, pageId: string, pageVersion: number, canvasPage: string, x: number, y: number, width: number, height: number, title: string,
    locked: boolean, hidden: boolean, group: string | null) {
    ArgumentException.throwIfNullOrWhitespace(id, CanvasResources.idField);
    ArgumentException.throwIfNullOrWhitespace(pageId, CanvasResources.pageIdField);
    if (!Number.isInteger(pageVersion) || pageVersion < 1)
      throw new ArgumentOutOfRangeException(CanvasResources.pageVersionField, pageVersion);
    ArgumentException.throwIfNullOrWhitespace(canvasPage, CanvasResources.canvasPageField);
    CanvasChecks.requireFinite(CanvasResources.xField, x);
    CanvasChecks.requireFinite(CanvasResources.yField, y);
    CanvasChecks.requirePositive(CanvasResources.widthField, width);
    CanvasChecks.requirePositive(CanvasResources.heightField, height);
    ArgumentException.throwIfNullOrWhitespace(title, CanvasResources.titleField);
    if (!Object.isNull(group))
      ArgumentException.throwIfNullOrWhitespace(group, CanvasResources.groupField);
    CanvasChecks.requireLength(CanvasResources.idField, id);
    CanvasChecks.requireLength(CanvasResources.canvasPageField, canvasPage);
    CanvasChecks.requireLength(CanvasResources.titleField, title);
    CanvasChecks.requireLength(CanvasResources.groupField, group ?? String.empty);

    this.id = id;
    this.pageId = pageId;
    this.pageVersion = pageVersion;
    this.canvasPage = canvasPage;
    this.x = x;
    this.y = y;
    this.width = width;
    this.height = height;
    this.title = title;
    this.locked = locked;
    this.hidden = hidden;
    this.group = group;
  }

  public static fromJson(value: unknown, path?: string): CanvasArtboard {
    const reader = JsonReader.fromValue(value, path);
    return new CanvasArtboard(
      reader.readNonBlankString(CanvasResources.idField),
      reader.readNonBlankString(CanvasResources.pageIdField),
      reader.readInteger(CanvasResources.pageVersionField),
      reader.readNonBlankString(CanvasResources.canvasPageField),
      reader.readNumber(CanvasResources.xField),
      reader.readNumber(CanvasResources.yField),
      reader.readNumber(CanvasResources.widthField),
      reader.readNumber(CanvasResources.heightField),
      reader.readNonBlankString(CanvasResources.titleField),
      reader.readBoolean(CanvasResources.lockedField),
      reader.readBoolean(CanvasResources.hiddenField),
      reader.readNullableString(CanvasResources.groupField));
  }

  public toJson(): JsonObject {
    return {
      [CanvasResources.idField]: this.id,
      [CanvasResources.pageIdField]: this.pageId,
      [CanvasResources.pageVersionField]: this.pageVersion,
      [CanvasResources.canvasPageField]: this.canvasPage,
      [CanvasResources.xField]: this.x,
      [CanvasResources.yField]: this.y,
      [CanvasResources.widthField]: this.width,
      [CanvasResources.heightField]: this.height,
      [CanvasResources.titleField]: this.title,
      [CanvasResources.lockedField]: this.locked,
      [CanvasResources.hiddenField]: this.hidden,
      [CanvasResources.groupField]: this.group
    };
  }
}
