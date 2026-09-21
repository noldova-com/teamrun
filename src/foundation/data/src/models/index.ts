/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ArgumentException } from "@noldova/teamrun-foundation-exceptions";

import { Resources } from "../resources.js";

export class Index {
  public readonly name: string;
  public readonly container: string;
  public readonly fields: readonly string[];
  public readonly isUnique: boolean;

  public constructor(name: string, container: string, fields: readonly string[], isUnique: boolean) {
    ArgumentException.throwIfNullOrWhitespace(name, Resources.nameParameterName);
    ArgumentException.throwIfNullOrWhitespace(container, Resources.containerParameterName);
    if (fields.length === 0)
      throw new ArgumentException(Resources.indexWithoutFields, Resources.fieldsParameterName);

    this.name = name;
    this.container = container;
    this.fields = [...fields];
    this.isUnique = isUnique;
  }
}
