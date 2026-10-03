/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ArgumentException } from "@noldova/teamrun-foundation-exceptions";
import { QualifiedName } from "@noldova/teamrun-shell-protocol";

import { Resources } from "../../resources";

export class MenuPlace {
  public readonly name: string;
  public readonly title: string;
  public readonly isMenuBar: boolean;

  public constructor(name: string, title: string, isMenuBar: boolean) {
    ArgumentException.throwIfNullOrWhitespace(title, Resources.titleParameter);

    this.name = QualifiedName.parse(name, Resources.nameParameter).text;
    this.title = title;
    this.isMenuBar = isMenuBar;
  }
}
