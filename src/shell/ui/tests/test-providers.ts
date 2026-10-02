/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ErrorHandler, type Provider } from "@angular/core";

import { ThrowingErrorHandler } from "./throwing-error-handler";

export default [{ provide: ErrorHandler, useClass: ThrowingErrorHandler }] satisfies Provider[];
