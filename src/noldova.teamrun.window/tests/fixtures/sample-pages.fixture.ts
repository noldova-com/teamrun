/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import type { JsonValue } from "@noldova/context.json";
import { Page, PageAuthor, PageKind, PageVersion, PageView } from "@noldova/teamrun.protocol";

import { FakeWindowPartContext } from "./fake-window-part-context.fixture";
import { SampleData } from "./sample-data.fixture";

export class SamplePages {
  public static readonly chatId: string = SampleData.conversation.id;
  public static readonly opus: PageAuthor = new PageAuthor("t1", "Opus");
  public static readonly sol: PageAuthor = new PageAuthor("t2", "Sol");
  public static readonly list: string = "teamrun.pageList";
  public static readonly open: string = "teamrun.pageOpen";
  public static readonly read: string = "teamrun.pageRead";
  public static readonly shown: string = "teamrun.pageShown";
  public static readonly updated: string = "teamrun.pageUpdated";
  public static readonly document: string = "teamrun.page";

  public static page(id: string, title: string, version: number = 1, minutesAgo: number = 0, editedBy: PageAuthor = SamplePages.opus,
    chatId: string = SamplePages.chatId): Page {
    const at = new Date(Date.parse(SampleData.timestamp) - minutesAgo * 60_000).toISOString();
    return new Page(id, chatId, title, version, SamplePages.opus, editedBy, `D:\\repo\\pages\\${id}.html`, 120, SampleData.timestamp, at);
  }

  public static canvas(id: string, title: string, version: number = 1): Page {
    return new Page(id, SamplePages.chatId, title, version, SamplePages.opus, SamplePages.opus, "D:\\repo", 120, SampleData.timestamp, SampleData.timestamp,
      PageKind.Canvas);
  }

  public static view(page: Page): PageView {
    return new PageView(page, [new PageVersion(page.version, page.editedBy, page.updatedAt)], page.version, `http://127.0.0.1:4100/pages/${page.id}`,
      `D:\\profile\\pages\\${page.id}.html`);
  }

  public static context(pages: readonly Page[] | (() => JsonValue | Promise<JsonValue>)): FakeWindowPartContext {
    const list = typeof pages === "function" ? pages : (): JsonValue => pages.map(t => t.toJson());
    return SampleData.createContext().answerModule(SamplePages.list, list);
  }
}
