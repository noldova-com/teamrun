/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ArgumentException } from "@noldova/teamrun-foundation-exceptions";

import { Resources } from "../resources.js";

export class DataSource {
  public readonly name: string;
  public readonly location: string;

  public constructor(name: string, location: string) {
    ArgumentException.throwIfNullOrWhitespace(name, Resources.nameParameterName);
    ArgumentException.throwIfNullOrWhitespace(location, Resources.locationParameterName);

    this.name = name;
    this.location = location;
  }
}
