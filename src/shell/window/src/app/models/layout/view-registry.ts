/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/teamrun-foundation-core";
import { ArgumentException } from "@noldova/teamrun-foundation-exceptions";

import { Resources } from "../../../resources";
import type { ViewType } from "./view-type";

export class ViewRegistry {
  private readonly viewTypes: ReadonlyMap<string, ViewType>;
  private readonly documentNames: ReadonlySet<string>;

  public constructor(views: readonly ViewType[], documents: readonly string[]) {
    if (documents.some(t => !Resources.contributionNamePattern.test(t)))
      throw new ArgumentException(Resources.invalidContributionName, "documents");
    if (new Set(views.map(t => t.name)).size !== views.length || new Set(documents).size !== documents.length)
      throw new ArgumentException(Resources.repeatedViewType);

    this.viewTypes = new Map(views.map(t => [t.name, t]));
    this.documentNames = new Set(documents);
  }

  public static createEmpty(): ViewRegistry {
    return new ViewRegistry([], []);
  }

  public get views(): readonly ViewType[] {
    return [...this.viewTypes.values()];
  }

  public hasView(name: string): boolean {
    return this.viewTypes.has(name);
  }

  public hasDocument(name: string): boolean {
    return this.documentNames.has(name);
  }

  public view(name: string): ViewType {
    const type = this.viewTypes.get(name);
    if (Object.isUndefined(type))
      throw new ArgumentException(Resources.formatUnregisteredView(name), "name");
    return type;
  }
}
