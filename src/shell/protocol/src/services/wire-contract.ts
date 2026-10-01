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
