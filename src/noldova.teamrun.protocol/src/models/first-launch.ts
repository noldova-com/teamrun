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

import { Resources } from "../resources.js";

export class FirstLaunch {
  public readonly finishedAt: string | null;

  public constructor(finishedAt: string | null) {
    if (!Object.isNull(finishedAt))
      ArgumentException.throwIfNullOrWhitespace(finishedAt, Resources.finishedAtField);

    this.finishedAt = finishedAt;
  }

  public get isFinished(): boolean {
    return !Object.isNull(this.finishedAt);
  }

  public static fromJson(value: unknown, path?: string): FirstLaunch {
    return new FirstLaunch(JsonReader.fromValue(value, path).readNullableString(Resources.finishedAtField));
  }

  public toJson(): JsonObject {
    return { [Resources.finishedAtField]: this.finishedAt };
  }
}
