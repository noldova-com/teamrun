/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ArgumentException } from "@noldova/teamrun-foundation-exceptions";
import { JsonReader, type JsonObject } from "@noldova/teamrun-foundation-json";

import { Resources } from "../resources.js";

export class Project {
  public readonly id: string;
  public readonly name: string;
  public readonly rootPath: string;
  public readonly createdAt: string;

  public constructor(id: string, name: string, rootPath: string, createdAt: string) {
    ArgumentException.throwIfNullOrWhitespace(id, Resources.idField);
    ArgumentException.throwIfNullOrWhitespace(name, Resources.nameField);
    ArgumentException.throwIfNullOrWhitespace(rootPath, Resources.rootPathField);
    ArgumentException.throwIfNullOrWhitespace(createdAt, Resources.createdAtField);

    this.id = id;
    this.name = name;
    this.rootPath = rootPath;
    this.createdAt = createdAt;
  }

  public static fromJson(value: unknown, path?: string): Project {
    const reader = JsonReader.fromValue(value, path);
    return new Project(
      reader.readNonBlankString(Resources.idField),
      reader.readNonBlankString(Resources.nameField),
      reader.readNonBlankString(Resources.rootPathField),
      reader.readNonBlankString(Resources.createdAtField));
  }

  public toJson(): JsonObject {
    return {
      [Resources.idField]: this.id,
      [Resources.nameField]: this.name,
      [Resources.rootPathField]: this.rootPath,
      [Resources.createdAtField]: this.createdAt
    };
  }
}
