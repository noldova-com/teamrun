/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/teamrun-foundation-core";
import { ArgumentException } from "@noldova/teamrun-foundation-exceptions";

import { Resources } from "../resources.js";

export class Migration {
  public readonly id: string;
  public readonly statements: readonly string[];

  public constructor(id: string, statements: readonly string[]) {
    if (!Resources.migrationIdPattern.test(id))
      throw new ArgumentException(Resources.migrationIdInvalid, Resources.idParameterName);
    ArgumentException.throwIfEmpty(statements, Resources.statementsParameterName);

    this.id = id;
    this.statements = [...statements];
  }
}
