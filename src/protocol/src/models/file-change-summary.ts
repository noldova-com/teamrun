/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ArgumentException, ArgumentOutOfRangeException } from "@noldova/teamrun-foundation-exceptions";
import { JsonReader, type JsonObject } from "@noldova/teamrun-foundation-json";

import { Resources } from "../resources.js";
import type { FileEdit } from "./file-edit.js";

export class FileChangeSummary {
  public readonly path: string;
  public readonly kind: string;
  public readonly additions: number;
  public readonly deletions: number;
  public readonly hasDiff: boolean;

  public constructor(path: string, kind: string, additions: number, deletions: number, hasDiff: boolean) {
    ArgumentException.throwIfNullOrWhitespace(path, Resources.pathField);
    for (const [name, count] of [[Resources.additionsField, additions], [Resources.deletionsField, deletions]] as const)
      if (!Number.isInteger(count) || count < 0)
        throw new ArgumentOutOfRangeException(name, count);

    this.path = path;
    this.kind = kind;
    this.additions = additions;
    this.deletions = deletions;
    this.hasDiff = hasDiff;
  }

  public static fromEdit(edit: FileEdit): FileChangeSummary {
    return new FileChangeSummary(edit.path, edit.kind, edit.additions, edit.deletions, edit.hasDiff);
  }

  public static fromJson(value: unknown, path?: string): FileChangeSummary {
    const reader = JsonReader.fromValue(value, path);
    return new FileChangeSummary(reader.readNonBlankString(Resources.pathField), reader.readString(Resources.kindField),
      reader.readInteger(Resources.additionsField), reader.readInteger(Resources.deletionsField), reader.readBoolean(Resources.hasDiffField));
  }

  public toJson(): JsonObject {
    return { [Resources.pathField]: this.path, [Resources.kindField]: this.kind, [Resources.additionsField]: this.additions,
      [Resources.deletionsField]: this.deletions, [Resources.hasDiffField]: this.hasDiff };
  }
}
