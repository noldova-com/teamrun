/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { JsonValue } from "@noldova/context.json";
import type { IWindowWebViews } from "@noldova/desktop.window";
import { Page, PageAuthor, PageRequest, PageVersion, PageView } from "@noldova/teamrun.protocol";

import { FakeWindowPartContext } from "./fake-window-part-context.fixture";
import { RecordingWebViews } from "./recording-web-view.fixture";

export class PagesWindowContext extends FakeWindowPartContext {
  public readonly pageViews: RecordingWebViews = new RecordingWebViews();

  public override get webViews(): IWindowWebViews {
    return this.pageViews;
  }
}

export class PagesWindow {
  public static readonly pageId: string = "11111111-2222-4333-8444-555555555555";
  public static readonly chatId: string = "c1";
  public static readonly opus: PageAuthor = new PageAuthor("t-opus", "Opus");
  public static readonly sol: PageAuthor = new PageAuthor("t-sol", "Sol");
  public static readonly you: PageAuthor = new PageAuthor(null, "You");
  public static readonly file: string = "C:\\Chats\\c1\\options.html";

  public static minutesAgo(minutes: number): string {
    return new Date(Date.now() - minutes * 60_000).toISOString();
  }

  public static page(version: number = 1, editedBy: PageAuthor = PagesWindow.opus, id: string = PagesWindow.pageId): Page {
    return new Page(id, PagesWindow.chatId, "Onboarding options", version, PagesWindow.opus, editedBy, "options.html", 120, PagesWindow.minutesAgo(20),
      PagesWindow.minutesAgo(version === 1 ? 20 : 5));
  }

  public static addressOf(version: number | null): string {
    return `http://127.0.0.1:4100/pages/${PagesWindow.pageId}?k=key${Object.isNull(version) ? "" : `&v=${String(version)}`}`;
  }

  public static view(current: number = 1, shown: number | null = null, editedBy: PageAuthor = PagesWindow.opus): PageView {
    const versions: PageVersion[] = [];
    for (let version = current; version >= 1; version--)
      versions.push(new PageVersion(version, version === 1 ? PagesWindow.opus : version === current ? editedBy : PagesWindow.sol,
        PagesWindow.minutesAgo(version === 1 ? 20 : version === current ? 5 : 12)));
    return new PageView(PagesWindow.page(current, editedBy), versions, shown ?? current, PagesWindow.addressOf(shown), PagesWindow.file);
  }

  public static versionOf(parameters: JsonValue): number | null {
    return PageRequest.fromJson(parameters).version;
  }
}
