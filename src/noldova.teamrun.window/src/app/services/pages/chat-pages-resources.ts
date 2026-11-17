/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { PageEventName, PageMethodName } from "@noldova/teamrun.protocol";

export class ChatPagesResources {
  public static readonly moduleId: string = "teamrun";
  public static readonly nameSeparator: string = ".";
  public static readonly viewTitle: string = "Pages";
  public static readonly viewName: string = "teamrun.pages";
  public static readonly pageIcon: string = "web_asset";
  public static readonly closeIcon: string = "close";
  public static readonly moreIcon: string = "more_horiz";
  public static readonly openIcon: string = "open_in_new_down";
  public static readonly browserIcon: string = "open_in_new";
  public static readonly saveIcon: string = "download";
  public static readonly copyIcon: string = "content_copy";
  public static readonly showPageTool: string = "teamrun_show_page";
  public static readonly editPageTool: string = "teamrun_edit_page";
  public static readonly listPagesTool: string = "teamrun_list_pages";
  public static readonly readPageTool: string = "teamrun_read_page";
  public static readonly createCanvasTool: string = "teamrun_canvas_create";
  public static readonly readCanvasTool: string = "teamrun_canvas_read";
  public static readonly addArtboardTool: string = "teamrun_canvas_add_artboard";
  public static readonly reviseArtboardTool: string = "teamrun_canvas_revise_artboard";
  public static readonly arrangeCanvasTool: string = "teamrun_canvas_arrange";
  public static readonly toolNameEnd: RegExp =
    /(?:^|[_.:/])(teamrun_(?:show_page|edit_page|read_page|list_pages|canvas_create|canvas_read|canvas_add_artboard|canvas_revise_artboard|canvas_arrange))$/;
  public static readonly showStepLabels: { readonly running: string; readonly done: string; readonly failed: string } =
    { running: "Showing a page", done: "Showed a page", failed: "Couldn't show a page" };
  public static readonly stepLabels: ReadonlyMap<string, { readonly running: string; readonly done: string; readonly failed: string }> = new Map([
    [ChatPagesResources.showPageTool, ChatPagesResources.showStepLabels],
    [ChatPagesResources.editPageTool, { running: "Editing a page", done: "Edited a page", failed: "Couldn't edit a page" }],
    [ChatPagesResources.listPagesTool, { running: "Listing the chat's pages", done: "Listed the chat's pages", failed: "Couldn't list the chat's pages" }],
    [ChatPagesResources.readPageTool, { running: "Reading a page", done: "Read a page", failed: "Couldn't read a page" }],
    [ChatPagesResources.createCanvasTool, { running: "Making a canvas", done: "Made a canvas", failed: "Couldn't make a canvas" }],
    [ChatPagesResources.readCanvasTool, { running: "Reading the canvas", done: "Read the canvas", failed: "Couldn't read the canvas" }],
    [ChatPagesResources.addArtboardTool, { running: "Adding an artboard", done: "Added an artboard", failed: "Couldn't add an artboard" }],
    [ChatPagesResources.reviseArtboardTool, { running: "Revising an artboard", done: "Revised an artboard", failed: "Couldn't revise an artboard" }],
    [ChatPagesResources.arrangeCanvasTool, { running: "Arranging the canvas", done: "Arranged the canvas", failed: "Couldn't arrange the canvas" }]
  ]);
  public static readonly canvasTitledTools: readonly string[] = [ChatPagesResources.createCanvasTool, ChatPagesResources.addArtboardTool,
    ChatPagesResources.reviseArtboardTool];
  public static readonly canvasField: string = "canvas";
  public static readonly artboardField: string = "artboard";
  public static readonly pageVersionField: string = "pageVersion";
  public static readonly titleArgument: string = "title";
  public static readonly artboardsArgument: string = "artboards";
  public static readonly canvasPagesArgument: string = "pages";
  public static readonly canvasPagesLabel: string = "the pages";
  public static readonly arrangeJoiner: string = " and ";
  public static readonly pageIdArgument: string = "page_id";
  public static readonly pathArgument: string = "path";
  public static readonly baseVersionArgument: string = "base_version";
  public static readonly pagesField: string = "pages";
  public static readonly pageField: string = "page";
  public static readonly titleField: string = "title";
  public static readonly versionField: string = "version";
  public static readonly toolField: string = "tool";
  public static readonly inputField: string = "input";
  public static readonly argumentsField: string = "arguments";
  public static readonly lineSeparator: string = "\n";
  public static readonly textField: string = "text";
  public static readonly contentField: string = "content";
  public static readonly fileNamePattern: RegExp = /[^\\/]+$/;
  public static readonly fileNameFallback: string = "page.html";
  public static readonly separator: string = " · ";
  public static readonly openLabel: string = "Open";
  public static readonly openInBrowserLabel: string = "Open in the system browser";
  public static readonly saveLabel: string = "Save as file…";
  public static readonly copyPathLabel: string = "Copy the file's path";
  public static readonly pageLabel: string = "Page";
  public static readonly emptyTitle: string = "No pages yet";
  public static readonly emptyText: string = "When a teammate shows a page it wrote, it's listed here. Ask one, for example \"@Opus show the comparison as a page\".";
  public static readonly noChatText: string = "Open a chat to see its pages.";
  public static readonly loadFailed: string = "TeamRun couldn't list this chat's pages.";
  public static readonly retryLabel: string = "Try again";
  public static readonly openFailed: string = "TeamRun couldn't open the page in the system browser.";
  public static readonly saveFailed: string = "TeamRun couldn't save the page as a file.";
  public static readonly copyFailed: string = "TeamRun couldn't copy the file's path.";
  public static readonly rowKeys: ReadonlyMap<string, (index: number, count: number) => number> = new Map<string, (index: number, count: number) => number>([
    ["ArrowDown", (index, count) => Math.min(index + 1, count - 1)],
    ["ArrowUp", index => Math.max(index - 1, 0)],
    ["Home", () => 0],
    ["End", (_, count) => count - 1]
  ]);
  public static readonly justNowLabel: string = "just now";
  public static readonly minuteMilliseconds: number = 60_000;
  public static readonly hourMinutes: number = 60;
  public static readonly dayHours: number = 24;
  public static readonly listName: string = ChatPagesResources.formatQualifiedName(PageMethodName.PageList);
  public static readonly openName: string = ChatPagesResources.formatQualifiedName(PageMethodName.PageOpen);
  public static readonly readName: string = ChatPagesResources.formatQualifiedName(PageMethodName.PageRead);
  public static readonly shownName: string = ChatPagesResources.formatQualifiedName(PageEventName.PageShown);
  public static readonly updatedName: string = ChatPagesResources.formatQualifiedName(PageEventName.PageUpdated);

  public static formatQualifiedName(name: string): string {
    return `${ChatPagesResources.moduleId}${ChatPagesResources.nameSeparator}${name.charAt(0).toLowerCase()}${name.slice(1)}`;
  }

  public static formatAgo(minutes: number): string {
    if (minutes < 1)
      return ChatPagesResources.justNowLabel;
    if (minutes < ChatPagesResources.hourMinutes)
      return `${minutes} min ago`;
    const hours = Math.floor(minutes / ChatPagesResources.hourMinutes);
    return hours < ChatPagesResources.dayHours ? `${hours} h ago` : `${Math.floor(hours / ChatPagesResources.dayHours)} d ago`;
  }

  public static formatVersion(version: number): string {
    return `v${version}`;
  }

  public static formatMadeBy(name: string): string {
    return `Made by ${name}`;
  }

  public static formatEditedBy(name: string): string {
    return `Edited by ${name}`;
  }

  public static formatMeta(version: number, madeBy: string, editedBy: string, since: string, isKindShown: boolean): string {
    const parts = [ChatPagesResources.formatVersion(version), ChatPagesResources.formatMadeBy(madeBy)];
    if (version > 1)
      parts.push(ChatPagesResources.formatEditedBy(editedBy));
    else if (isKindShown)
      parts.unshift(ChatPagesResources.pageLabel);
    return [...parts, since].join(ChatPagesResources.separator);
  }

  public static formatEditing(name: string, version: number): string {
    return `${name} is editing${ChatPagesResources.separator}${ChatPagesResources.formatVersion(version)}`;
  }

  public static formatStepTitle(label: string, detail: string): string {
    return `${label}${ChatPagesResources.separator}${detail}`;
  }

  public static formatStepFailure(label: string, reason: string): string {
    return String.isNullOrWhitespace(reason) ? label : `${label}: ${reason}`;
  }

  public static formatPageCount(count: number): string {
    return count === 1 ? "1 page" : `${count} pages`;
  }

  public static formatReadDetail(title: string, version: number): string {
    return `${title}, ${ChatPagesResources.formatVersion(version)}`;
  }

  public static formatArtboardCount(count: number): string {
    return count === 1 ? "1 artboard" : `${count} artboards`;
  }

  public static formatEditDetail(from: number, to: number): string {
    return `${ChatPagesResources.formatVersion(from)} to ${ChatPagesResources.formatVersion(to)}`;
  }

  public static formatOpen(title: string): string {
    return `Open ${title}`;
  }

  public static formatRowMenu(title: string): string {
    return `${title} actions`;
  }
}
