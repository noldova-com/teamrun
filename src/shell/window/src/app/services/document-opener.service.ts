/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Injectable, inject } from "@angular/core";

import { ArgumentException } from "@noldova/teamrun-foundation-exceptions";

import { Resources } from "../../resources";
import { DocumentTab } from "../models/layout/document-tab";
import { LayoutService } from "./layout.service";
import { TabLabelService } from "./tab-label.service";

@Injectable({ providedIn: "root" })
export class DocumentOpenerService {
  private readonly layout: LayoutService = inject(LayoutService);
  private readonly labels: TabLabelService = inject(TabLabelService);

  public open(moduleId: string, name: string, instance: string, title: string, isPreview: boolean): void {
    this.requireOwnDocument(moduleId, name);
    ArgumentException.throwIfNullOrWhitespace(title, "title");
    const tab = new DocumentTab(name, instance);
    this.labels.setTitle(tab, title);
    this.layout.openDocument(tab, isPreview);
  }

  public keep(moduleId: string, name: string, instance: string): void {
    this.requireOwnDocument(moduleId, name);
    this.layout.keep(new DocumentTab(name, instance));
  }

  private requireOwnDocument(moduleId: string, name: string): void {
    if (!name.startsWith(`${moduleId}${Resources.contributionSeparator}`))
      throw new ArgumentException(Resources.formatForeignDocument(moduleId, name), "name");
    if (!this.layout.registry().hasDocument(name))
      throw new ArgumentException(Resources.formatUnregisteredDocument(name), "name");
  }
}
