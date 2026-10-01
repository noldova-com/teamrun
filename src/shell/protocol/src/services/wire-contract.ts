/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/teamrun-foundation-core";

import { ArgumentException, ExceptionOptions } from "@noldova/teamrun-foundation-exceptions";
import { JsonException, type JsonReader } from "@noldova/teamrun-foundation-json";

import { Resources } from "../resources.js";

export class WireContract {
  public static requireKnownFields(reader: JsonReader, fields: readonly string[]): void {
    const unknown = Object.keys(reader.toJson()).find(t => !fields.includes(t));
    if (!Object.isUndefined(unknown))
      throw new JsonException(Resources.unknownField, Resources.formatFieldPath(reader.path, unknown));
  }

  public static create<T>(reader: JsonReader, factory: () => T): T {
    try {
      return factory();
    }
    catch (error) {
      if (!(error instanceof ArgumentException))
        throw error;

      const path = Object.isUndefined(error.parameterName) ? reader.path : Resources.formatFieldPath(reader.path, error.parameterName);
      throw new JsonException(error.message, path, new ExceptionOptions(error));
    }
  }
}
