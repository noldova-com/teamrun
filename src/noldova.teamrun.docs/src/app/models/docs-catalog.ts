/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Resources } from "../../resources";
import { DocsGroup } from "../enums/docs-group";
import { DocsMenuGroup } from "./docs-menu-group";
import { DocsPage } from "./docs-page";
import { DocsPageText } from "./docs-page-text";

export class DocsCatalog {
  public static readonly home: DocsPage = DocsCatalog.page(Resources.homeTitle, Resources.homePath, DocsGroup.Start, Resources.homeFile);
  public static readonly releaseNotes: DocsPage = DocsCatalog.page(Resources.releaseNotesTitle, "release-notes", DocsGroup.Reference);
  public static readonly pages: readonly DocsPage[] = [
    DocsCatalog.home,
    DocsCatalog.page(Resources.gettingStartedTitle, "getting-started", DocsGroup.Start),
    DocsCatalog.page(Resources.installTitle, "install", DocsGroup.Start),
    DocsCatalog.page(Resources.providersTitle, "providers", DocsGroup.Using),
    DocsCatalog.page(Resources.providerFeaturesTitle, "provider-features", DocsGroup.Using),
    DocsCatalog.page(Resources.acpAgentsTitle, "acp-agents", DocsGroup.Using),
    DocsCatalog.page(Resources.chatsTitle, "chats", DocsGroup.Using),
    DocsCatalog.page(Resources.approvingTitle, "approving", DocsGroup.Using),
    DocsCatalog.page(Resources.organizationTitle, "organization", DocsGroup.Using),
    DocsCatalog.page(Resources.projectsTitle, "projects", DocsGroup.Using),
    DocsCatalog.page(Resources.toolsTitle, "tools", DocsGroup.Using),
    DocsCatalog.page(Resources.sustainTitle, "sustain", DocsGroup.Using),
    DocsCatalog.page(Resources.settingsTitle, "settings", DocsGroup.Using),
    DocsCatalog.page(Resources.privacyTitle, "privacy", DocsGroup.Reference),
    DocsCatalog.page(Resources.troubleshootingTitle, "troubleshooting", DocsGroup.Reference),
    DocsCatalog.page(Resources.faqTitle, "faq", DocsGroup.Reference),
    DocsCatalog.releaseNotes
  ];
  public static readonly menuGroups: readonly DocsMenuGroup[] = Object.values(DocsGroup)
    .map(t => new DocsMenuGroup(Resources.groupLabels[t], DocsCatalog.pages.filter(u => u.group === t)))
    .filter(t => t.pages.length > 0);

  private static page(title: string, path: string, group: DocsGroup, file: string = path): DocsPage {
    return new DocsPage(title, path, group, file, DocsPageText.of(file));
  }
}
