/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { type DataValue, Query } from "@noldova/teamrun-foundation-data";
import { ArgumentException } from "@noldova/teamrun-foundation-exceptions";

import { Resources } from "../resources.js";

export class SqlQuery extends Query {
  public readonly text: string;
  public readonly parameters: readonly DataValue[];

  public constructor(text: string, parameters: readonly DataValue[] = []) {
    super();
    ArgumentException.throwIfNullOrWhitespace(text, Resources.textParameterName);

    this.text = text;
    this.parameters = [...parameters];
  }

  public override toString(): string {
    return this.text;
  }
}
