/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ErrorHandler, type Provider } from "@angular/core";

import { ThrowingErrorHandler } from "./throwing-error-handler";
import { MemoryDraftStore } from "./fixtures/memory-draft-store";
import { COMPOSER_DRAFT_STORE } from "../src/app/services/composer-drafts.service";

export default [{ provide: ErrorHandler, useClass: ThrowingErrorHandler },
  { provide: COMPOSER_DRAFT_STORE, useClass: MemoryDraftStore }] satisfies Provider[];
