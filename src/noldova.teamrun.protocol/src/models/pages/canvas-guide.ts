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

import { CanvasAxis } from "../../enums/pages/canvas-axis.js";
import { CanvasChecks } from "./canvas-checks.js";
import { CanvasResources } from "./canvas-resources.js";

export class CanvasGuide {
  public readonly canvasPage: string;
  public readonly axis: CanvasAxis;
  public readonly at: number;

  public constructor(canvasPage: string, axis: CanvasAxis, at: number) {
    ArgumentException.throwIfNullOrWhitespace(canvasPage, CanvasResources.canvasPageField);
    if (!Object.values(CanvasAxis).includes(axis))
      throw new ArgumentOutOfRangeException(CanvasResources.axisField, axis);
    CanvasChecks.requireFinite(CanvasResources.atField, at);

    this.canvasPage = canvasPage;
    this.axis = axis;
    this.at = at;
  }

  public static fromJson(value: unknown, path?: string): CanvasGuide {
    const reader = JsonReader.fromValue(value, path);
    return new CanvasGuide(
      reader.readNonBlankString(CanvasResources.canvasPageField),
      reader.readOneOf(CanvasResources.axisField, Object.values(CanvasAxis)),
      reader.readNumber(CanvasResources.atField));
  }

  public toJson(): JsonObject {
    return { [CanvasResources.canvasPageField]: this.canvasPage, [CanvasResources.axisField]: this.axis, [CanvasResources.atField]: this.at };
  }
}
