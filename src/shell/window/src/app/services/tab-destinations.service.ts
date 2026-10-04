/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Injectable, inject } from "@angular/core";

import { type JsonObject, JsonReader } from "@noldova/teamrun-foundation-json";

import type { TabGroup } from "../models/layout/tab-group";
import { MenuItem } from "../models/menu-item";
import { Resources } from "../../resources";
import { LayoutService } from "./layout.service";
import { MenuService } from "./menu.service";
import { TabLabelService } from "./tab-label.service";

@Injectable({ providedIn: "root" })
export class TabDestinationsService {
  private readonly layout: LayoutService = inject(LayoutService);
  private readonly labels: TabLabelService = inject(TabLabelService);

  public constructor() {
    inject(MenuService).provideGroup(Resources.tabDestinationsGroup, t => this.itemsFor(t));
  }

  private itemsFor(context: JsonObject): readonly MenuItem[] {
    const key = JsonReader.fromValue(context).readOptionalString(Resources.tabArgument);
    const layout = this.layout.layout();
    const tab = layout.groups.flatMap(t => t.tabs).find(t => t.key === key);
    return Object.isUndefined(tab) ? [] : layout.groups.filter(t => t.accepts(tab) && !t.has(tab))
      .map(t => MenuItem.ofCommand(Resources.moveTabToGroupCommand, { [Resources.groupArgument]: t.id }, this.labelOf(t, layout.documentGroups)));
  }

  private labelOf(group: TabGroup, documents: readonly TabGroup[]): string {
    if (!group.isDocuments)
      return group.tabs.map(t => this.labels.of(t).title).join(Resources.groupLabelJoiner);
    return documents.length === 1 ? Resources.documentsGroupLabel : Resources.formatDocumentsGroup(documents.indexOf(group) + 1);
  }
}
