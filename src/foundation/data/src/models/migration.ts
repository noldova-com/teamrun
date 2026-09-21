/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/teamrun-foundation-core";
import { ArgumentException } from "@noldova/teamrun-foundation-exceptions";

import { DataException } from "../exceptions/data.exception.js";
import { Resources } from "../resources.js";

export abstract class Migration {
  public readonly id: string;

  protected constructor(id: string) {
    if (!Resources.migrationIdPattern.test(id))
      throw new ArgumentException(Resources.migrationIdInvalid, Resources.idParameterName);

    this.id = id;
  }

  public static validateOrder(migrations: readonly Migration[]): void {
    let previous: Migration | undefined;
    for (const migration of migrations) {
      if (!Object.isUndefined(previous) && previous.id >= migration.id)
        throw new DataException(Resources.migrationsUnordered);

      previous = migration;
    }
  }
}
