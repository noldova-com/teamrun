/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Exception, type ExceptionOptions } from "@noldova/teamrun-foundation-exceptions";

import { ServiceResponseInfo } from "../models/service-response-info.js";

export class ServiceException extends Exception {
  public readonly info: ServiceResponseInfo;

  public constructor(name: string, message: string, args: readonly string[] = [], options?: ExceptionOptions) {
    const info = new ServiceResponseInfo(name, message, args);
    super(message, options);

    this.info = info;
  }
}
