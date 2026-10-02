/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { Type } from "@angular/core";

import { ArgumentException } from "@noldova/teamrun-foundation-exceptions";

import { Resources } from "../../resources";

export class DocumentContribution {
  public readonly name: string;
  public readonly loadComponent: () => Promise<Type<unknown>>;

  public constructor(name: string, loadComponent: () => Promise<Type<unknown>>) {
    if (!Resources.contributionNamePattern.test(name))
      throw new ArgumentException(Resources.invalidContributionName, "name");

    this.name = name;
    this.loadComponent = loadComponent;
  }
}
