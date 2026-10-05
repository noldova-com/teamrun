/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { Type } from "@angular/core";

import { ArgumentException } from "@noldova/teamrun-foundation-exceptions";

import type { ContentPadding } from "../enums/content-padding";
import type { DockSide } from "../enums/dock-side";
import { Resources } from "../../resources";

export class ViewContribution {
  public readonly name: string;
  public readonly title: string;
  public readonly icon: string;
  public readonly defaultSide: DockSide;
  public readonly isShownByDefault: boolean;
  public readonly loadComponent: () => Promise<Type<unknown>>;
  public readonly padding: ContentPadding | null;

  public constructor(name: string, title: string, icon: string, defaultSide: DockSide, isShownByDefault: boolean, loadComponent: () => Promise<Type<unknown>>,
    padding?: ContentPadding) {
    if (!Resources.contributionNamePattern.test(name))
      throw new ArgumentException(Resources.invalidContributionName, "name");
    ArgumentException.throwIfNullOrWhitespace(title, "title");
    ArgumentException.throwIfNullOrWhitespace(icon, "icon");

    this.name = name;
    this.title = title;
    this.icon = icon;
    this.defaultSide = defaultSide;
    this.isShownByDefault = isShownByDefault;
    this.loadComponent = loadComponent;
    this.padding = padding ?? null;
  }
}
