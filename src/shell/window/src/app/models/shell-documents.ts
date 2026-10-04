/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Resources } from "../../resources";
import { DocumentContribution } from "./document-contribution";
import { DocumentTab } from "./layout/document-tab";
import type { Tab } from "./layout/tab";
import { TabLabel } from "./layout/tab-label";

export class ShellDocuments {
  public static readonly settings: DocumentContribution = new DocumentContribution(
    Resources.settingsDocument,
    () => import("../components/settings/settings.component").then(t => t.SettingsComponent));
  public static readonly settingsTab: DocumentTab = new DocumentTab(Resources.settingsDocument);
  public static readonly settingsLabel: TabLabel = new TabLabel(Resources.settingsTitle, Resources.settingsGlyph);
  public static readonly all: readonly DocumentContribution[] = [ShellDocuments.settings];

  public static find(tab: Tab): DocumentContribution | null {
    return tab instanceof DocumentTab ? ShellDocuments.all.find(t => t.name === tab.name) ?? null : null;
  }
}
