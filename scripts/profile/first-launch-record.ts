/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { existsSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

import "@noldova/context.core";

import { JsonFields } from "../totals/json-fields.ts";
import { ModuleDatabases } from "./module-databases.ts";

export class FirstLaunchRecord {
  public static readonly DATABASE: readonly string[] = ["modules", "teamrun", "teamrun.sqlite"];
  private static readonly PROVIDERS_TABLE: string = "providers";
  private static readonly PREFERENCES_TABLE: string = "preferences";
  private static readonly PROVIDERS_QUERY: string = "SELECT 1 FROM providers LIMIT 1";
  private static readonly PREFERENCE_QUERY: string = "SELECT json FROM preferences WHERE name = 'firstLaunch'";

  public static isPending(data: string): boolean {
    const file = path.join(data, ...FirstLaunchRecord.DATABASE);
    if (!existsSync(file))
      return true;
    const database = new DatabaseSync(file, { readOnly: true });
    try {
      if (ModuleDatabases.hasTable(database, FirstLaunchRecord.PROVIDERS_TABLE) && database.prepare(FirstLaunchRecord.PROVIDERS_QUERY).all().length > 0)
        return false;
      if (!ModuleDatabases.hasTable(database, FirstLaunchRecord.PREFERENCES_TABLE))
        return true;
      const [preference] = database.prepare(FirstLaunchRecord.PREFERENCE_QUERY).all();
      const json = preference?.["json"];
      return !Object.isString(json) || Object.isNull(JsonFields.read(JSON.parse(json), "finishedAt"));
    }
    finally {
      database.close();
    }
  }
}
