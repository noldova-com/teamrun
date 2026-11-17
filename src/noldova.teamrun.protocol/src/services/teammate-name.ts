/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ArgumentException } from "@noldova/context.exceptions";
import { JsonException, type JsonReader } from "@noldova/context.json";

import { Resources } from "../resources.js";

export class TeammateName {
  public static validate(name: string): void {
    if (!Resources.teammateNamePattern.test(name.normalize(Resources.teammateNameNormalization)))
      throw new ArgumentException(Resources.invalidTeammateName, Resources.nameField);
  }

  public static read(reader: JsonReader): string {
    const name = reader.readNonBlankString(Resources.nameField);
    if (!Resources.teammateNamePattern.test(name.normalize(Resources.teammateNameNormalization)))
      throw new JsonException(Resources.invalidTeammateName, `${reader.path}.${Resources.nameField}`);
    return name;
  }

  public static key(name: string): string {
    return name.normalize(Resources.teammateNameNormalization).toLowerCase().replace(Resources.teammateNameSpaces, Resources.teammateNameSpace).trim();
  }

  public static initials(name: string): string {
    return name.normalize(Resources.teammateNameNormalization).trim().split(Resources.teammateNameSpaces).filter(t => t.length > 0)
      .slice(0, Resources.teammateInitialsWords).map(t => String.fromCodePoint(t.codePointAt(0)!).toLocaleUpperCase()).join("");
  }
}
