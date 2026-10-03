/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/teamrun-foundation-core";
import { ArgumentException } from "@noldova/teamrun-foundation-exceptions";
import type { JsonValue } from "@noldova/teamrun-foundation-json";
import { KeyChord, QualifiedName } from "@noldova/teamrun-shell-protocol";

import { Resources } from "../../resources";

export class CommandContribution {
  public readonly name: string;
  public readonly title: string;
  public readonly icon: string | null;
  public readonly defaultKey: KeyChord | null;
  public readonly runAsync: (commandArguments: JsonValue) => Promise<JsonValue>;

  public constructor(name: string, title: string, icon: string | null, defaultKey: string | null, runAsync: (commandArguments: JsonValue) => Promise<JsonValue>) {
    ArgumentException.throwIfNullOrWhitespace(title, Resources.titleParameter);
    if (!Object.isNull(icon))
      ArgumentException.throwIfNullOrWhitespace(icon, Resources.iconParameter);

    this.name = QualifiedName.parse(name, Resources.nameParameter).text;
    this.title = title;
    this.icon = icon;
    this.defaultKey = Object.isNull(defaultKey) ? null : KeyChord.parseDefault(defaultKey, Resources.defaultKeyParameter);
    this.runAsync = runAsync;
  }
}
