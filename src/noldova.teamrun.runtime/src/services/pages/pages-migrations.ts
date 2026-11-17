/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Migration } from "@noldova/desktop.runtime";

import { PagesResources } from "./pages-resources.js";

export class PagesMigrations {
  public static readonly all: readonly Migration[] = [new Migration(PagesResources.migrationId, PagesResources.migrationStatements)];
}
