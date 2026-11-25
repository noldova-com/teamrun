/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { DocsGroup } from "./app/enums/docs-group";

export class Resources {
  public static readonly siteTitle: string = "TeamRun";
  public static readonly siteLink: string = "https://teamrun.noldova.dev/";
  public static readonly wordmarkFile: string = "/assets/noldova-wordmark.svg";
  public static readonly siteName: string = "TeamRun";
  public static readonly websiteLink: string = "https://teamrun.noldova.com/";
  public static readonly websiteLabel: string = "TeamRun website";
  public static readonly websiteFooterLabel: string = "Website";
  public static readonly downloadLink: string = "https://teamrun.noldova.com/download/";
  public static readonly downloadLabel: string = "Download";
  public static readonly feedbackLink: string = "https://github.com/noldova-com/teamrun/issues";
  public static readonly feedbackLabel: string = "Feedback & support";
  public static readonly privacyLink: string = "https://teamrun.noldova.com/privacy/";
  public static readonly privacyLabel: string = "Privacy";
  public static readonly repositoryLink: string = "https://github.com/noldova-com/teamrun";
  public static readonly repositoryLabel: string = "GitHub";
  public static readonly repositoryIcon: string = "/brand/github.svg";
  public static readonly xLink: string = "https://x.com/noldova";
  public static readonly xLabel: string = "X";
  public static readonly xIcon: string = "/brand/x.svg";
  public static readonly productGroupLabel: string = "TeamRun";
  public static readonly helpGroupLabel: string = "Help";
  public static readonly followGroupLabel: string = "Follow";
  public static readonly versionPrefix: string = "v";
  public static readonly mainId: string = "nol-docs-main";
  public static readonly menuLabel: string = "Pages";
  public static readonly menuGroupLevel: number = 2;
  public static readonly menuGlyph: string = "toc";
  public static readonly onThisPageLabel: string = "On this page";
  public static readonly currentLocation: string = "location";
  public static readonly homeLink: string = "/";
  public static readonly homeTitle: string = "TeamRun";
  public static readonly homePath: string = "";
  public static readonly homeFile: string = "home";
  public static readonly gettingStartedTitle: string = "Getting started";
  public static readonly installTitle: string = "Install";
  public static readonly providersTitle: string = "Providers and sign-in";
  public static readonly providerFeaturesTitle: string = "What each provider can do";
  public static readonly acpAgentsTitle: string = "ACP agents";
  public static readonly chatsTitle: string = "Chats and teammates";
  public static readonly approvingTitle: string = "Following and approving the work";
  public static readonly organizationTitle: string = "Organization";
  public static readonly projectsTitle: string = "Projects and folders";
  public static readonly toolsTitle: string = "Tools teammates use";
  public static readonly sustainTitle: string = "When usage runs out";
  public static readonly settingsTitle: string = "Settings";
  public static readonly privacyTitle: string = "Privacy and network";
  public static readonly troubleshootingTitle: string = "Troubleshooting";
  public static readonly faqTitle: string = "FAQ";
  public static readonly releaseNotesTitle: string = "Release notes";
  public static readonly searchLabel: string = "Search the docs";
  public static readonly searchResultsLabel: string = "Search results";
  public static readonly searchEmpty: string = "No page matches.";
  public static readonly groupLabels: Readonly<Record<DocsGroup, string>> = {
    [DocsGroup.Start]: "Start",
    [DocsGroup.Using]: "Using TeamRun",
    [DocsGroup.Reference]: "Reference"
  };
  public static readonly missingPage: string = "No Markdown file under src/pages is named";

  public static formatPageTitle(title: string): string {
    return title === Resources.siteTitle ? Resources.siteTitle : `${title} · ${Resources.siteTitle}`;
  }

  public static formatVersion(version: string): string {
    return `${Resources.versionPrefix}${version}`;
  }

  public static formatMissingPage(file: string): string {
    return `${Resources.missingPage} ${file}.md.`;
  }
}
