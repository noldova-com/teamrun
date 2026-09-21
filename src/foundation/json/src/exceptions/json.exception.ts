/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Exception, type ExceptionOptions } from "@noldova/teamrun-foundation-exceptions";

import { Resources } from "../resources.js";

export class JsonException extends Exception {
  public readonly path: string;

  public constructor(text: string, path: string, options?: ExceptionOptions) {
    super(`${path}${Resources.pathMessageSeparator}${text}`, options);

    this.path = path;
  }
}
