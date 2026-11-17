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

import { CanvasChecks } from "./canvas-checks.js";
import { CanvasResources } from "./canvas-resources.js";

export class CanvasPage {
  public readonly id: string;
  public readonly name: string;

  public constructor(id: string, name: string) {
    ArgumentException.throwIfNullOrWhitespace(id, CanvasResources.idField);
    ArgumentException.throwIfNullOrWhitespace(name, CanvasResources.nameField);
    CanvasChecks.requireLength(CanvasResources.idField, id);
    CanvasChecks.requireLength(CanvasResources.nameField, name);

    this.id = id;
    this.name = name;
  }

  public static fromJson(value: unknown, path?: string): CanvasPage {
    const reader = JsonReader.fromValue(value, path);
    return new CanvasPage(reader.readNonBlankString(CanvasResources.idField), reader.readNonBlankString(CanvasResources.nameField));
  }

  public toJson(): JsonObject {
    return { [CanvasResources.idField]: this.id, [CanvasResources.nameField]: this.name };
  }
}
