/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";

import { ModuleReference } from "../module-reference.ts";
import { PagesBoundaryCheck } from "../pages-boundary-check.ts";
import { CheckRepository } from "./fixtures/check-repository.fixture.ts";

const STORE = "src/noldova.teamrun.runtime/src/services/pages/pages-store.ts";
const MODEL = "src/noldova.teamrun.protocol/src/models/pages/page.ts";
const HOST = "src/noldova.teamrun.runtime/src/services/teamrun-pages-host.ts";
const API = "src/noldova.teamrun.runtime/src/api/index.ts";

const NEW_LINE = "\n";

const repositories: CheckRepository[] = [];

const runOn = async (sources: Readonly<Record<string, string>>): Promise<{ passed: boolean; lines: readonly string[] }> => {
  const repository = await CheckRepository.createAsync(sources);
  repositories.push(repository);
  return await repository.runAsync(new PagesBoundaryCheck(async () => await Promise.resolve(Object.keys(sources)), repository.syntax));
};

const problemsOf = (file: string, ...references: readonly ModuleReference[]): readonly string[] =>
  PagesBoundaryCheck.inspect(file, references).map(t => t.slice(0, t.indexOf(";")));

describe("PagesBoundaryCheck", () => {
  afterEach(async () => {
    await Promise.all(repositories.splice(0).map(async t => await t.removeAsync()));
  });

  it("reads every form of import and export from the source text and passes the ones Pages' boundary allows", async () => {
    const { passed, lines } = await runOn({
      [STORE]: [
        "import { readFileSync } from \"node:fs\";",
        "import type { Page } from \"@noldova/teamrun.protocol\";",
        "import \"./page-files.js\";",
        "export { PageFiles } from \"./page-files.js\";",
        "export const load = async (): Promise<unknown> => await import(\"./page-tools.js\");",
        "export type Tools = typeof import(\"./page-tools.js\");",
        "import files = require(\"../../models/pages/page-content.js\");"
      ].join(NEW_LINE),
      [API]: "export { Pages } from \"../services/pages/pages.js\";\nexport type { IPagesHost } from \"../interfaces/pages/i-pages-host.js\";\n",
      "src/noldova.teamrun.runtime/tests/services/pages/page-tool.test.ts": "import { PagesStore } from \"../../../src/services/pages/pages-store.js\";\n"
    });

    assert.deepEqual(lines, ["Checked the imports and exports of 2 production scripts against Pages' boundary."]);
    assert.equal(passed, true);
  });

  it("refuses a dynamic import, an import type and an import-equals across the boundary, each at its own line", async () => {
    const { passed, lines } = await runOn({
      [STORE]: [
        "export const load = async (): Promise<unknown> => await import(\"../../resources.js\");",
        "export type Core = typeof import(\"@noldova/teamrun.core\");",
        "import resources = require(\"../conversations-service.js\");",
        "export const named = async (name: string): Promise<unknown> => await import(name);"
      ].join(NEW_LINE),
      [HOST]: [
        "export type Store = typeof import(\"./pages/pages-store.js\");",
        "export const tools = async (): Promise<unknown> => await import(\"./pages/page-tools.js\");",
        "import pages = require(\"./pages/pages.js\");",
        "export type Pages = typeof import(\"./pages/pages.js\");",
        "export const lazy = async (): Promise<unknown> => await import(\"./pages/pages.js\");"
      ].join(NEW_LINE)
    });

    assert.deepEqual(lines, [
      `${STORE}:1: takes ../../resources.js, outside Pages' folders`,
      `${STORE}:2: takes @noldova/teamrun.core, which Pages may not use`,
      `${STORE}:3: takes ../conversations-service.js, outside Pages' folders`,
      `${STORE}:4: takes a module named at run time, which Pages may not use`,
      `${HOST}:1: takes ./pages/pages-store.js, inside Pages, which TeamRun reaches only through its entries`,
      `${HOST}:2: takes ./pages/page-tools.js, inside Pages, which TeamRun reaches only through its entries`,
      `${HOST}:3: takes more than Pages from ./pages/pages.js`,
      `${HOST}:4: takes more than Pages from ./pages/pages.js`,
      "Checked the imports and exports of 2 production scripts against Pages' boundary."
    ]);
    assert.equal(passed, false);
  });

  it("lets a pages file take Node, the context packages, Noldova Desktop's runtime and protocol, Pages' protocol names, and other pages folders", () => {
    assert.deepEqual(problemsOf(STORE,
      new ModuleReference("node:fs", ["readFileSync"], 1),
      new ModuleReference("@noldova/context.json", ["JsonReader"], 2),
      new ModuleReference("@noldova/desktop.runtime", null, 3),
      new ModuleReference("@noldova/teamrun.protocol", ["Page", "PageAuthor"], 4),
      new ModuleReference("./page-files.js", ["PageFiles"], 5),
      new ModuleReference("../../models/pages/page-content.js", ["PageContent"], 6),
      new ModuleReference("@noldova/desktop.protocol", ["Failure", "FailureCode"], 7),
      new ModuleReference("@noldova/teamrun.protocol", ["PageVersion", "PageView", "PageRequest", "PageMethodName", "PageEventName"], 8),
      new ModuleReference("../../interfaces/pages/i-pages-clock.js", ["IPagesClock"], 9)), []);
    assert.deepEqual(problemsOf(MODEL, new ModuleReference("./page-resources.js", ["PageResources"], 1)), []);
  });

  it("lets a pages file take only its package's base exception from that base's file", () => {
    const exception = "src/noldova.teamrun.runtime/src/exceptions/pages/page.exception.ts";
    const window = "src/noldova.teamrun.window/src/app/exceptions/pages/pages.exception.ts";
    assert.deepEqual(problemsOf(exception, new ModuleReference("../runtime.exception.js", ["RuntimeException"], 1)), []);
    assert.deepEqual(problemsOf(STORE, new ModuleReference("../../exceptions/runtime.exception.js", ["RuntimeException"], 1)), []);
    assert.deepEqual(problemsOf(exception,
      new ModuleReference("../runtime.exception.js", null, 2),
      new ModuleReference("../runtime.exception.js", ["RuntimeException", "Other"], 3),
      new ModuleReference("../runtime-part.exception.js", ["RuntimePartException"], 4)), [
      `${exception}:2: takes ../runtime.exception.js, outside Pages' folders`,
      `${exception}:3: takes ../runtime.exception.js, outside Pages' folders`,
      `${exception}:4: takes ../runtime-part.exception.js, outside Pages' folders`
    ]);
    assert.deepEqual(problemsOf(window, new ModuleReference("../window.exception", ["WindowException"], 1)), []);
    assert.deepEqual(problemsOf(window,
      new ModuleReference("../window.exception", ["RuntimeException"], 2),
      new ModuleReference("../file-grant.exception", ["FileGrantException"], 3)), [
      `${window}:2: takes ../window.exception, outside Pages' folders`,
      `${window}:3: takes ../file-grant.exception, outside Pages' folders`
    ]);
  });

  it("refuses a pages file that takes TeamRun's folders, another package or more of the protocol than Pages' own names", () => {
    assert.deepEqual(problemsOf(STORE,
      new ModuleReference("../../resources.js", ["Resources"], 7),
      new ModuleReference("../conversations-service.js", [], 8),
      new ModuleReference("@noldova/teamrun.core", ["Conversation"], 9),
      new ModuleReference("@noldova/teamrun.protocol", ["Page", "Conversation"], 10),
      new ModuleReference("@noldova/teamrun.protocol", null, 11)), [
      `${STORE}:7: takes ../../resources.js, outside Pages' folders`,
      `${STORE}:8: takes ../conversations-service.js, outside Pages' folders`,
      `${STORE}:9: takes @noldova/teamrun.core, which Pages may not use`,
      `${STORE}:10: takes Conversation from @noldova/teamrun.protocol, of which Pages may use only Page, PageAuthor, PageVersion, PageView, PageRequest, PageListRequest, PageMethodName, PageEventName, PageKind, CanvasManifest, CanvasPage, CanvasArtboard, CanvasNote, CanvasMark, CanvasGuide, CanvasNoteKind, CanvasMarkKind, CanvasAxis`,
      `${STORE}:11: takes all of @noldova/teamrun.protocol, of which Pages may use only Page, PageAuthor, PageVersion, PageView, PageRequest, PageListRequest, PageMethodName, PageEventName, PageKind, CanvasManifest, CanvasPage, CanvasArtboard, CanvasNote, CanvasMark, CanvasGuide, CanvasNoteKind, CanvasMarkKind, CanvasAxis`
    ]);
  });

  it("lets a Window pages file take Angular, the kit and Noldova Desktop's window, and refuses them to a runtime pages file", () => {
    const card = "src/noldova.teamrun.window/src/app/components/pages/page-card/page-card.component.ts";
    const references = [new ModuleReference("@angular/core", ["Component"], 1), new ModuleReference("@noldova/ui.components.angular", ["ButtonComponent"], 2),
      new ModuleReference("@noldova/ui.components.angular/markdown", null, 3), new ModuleReference("@noldova/desktop.window", ["WindowPartTokens"], 4),
      new ModuleReference("../../../services/pages/chat-pages.js", ["ChatPages"], 5)];

    assert.deepEqual(problemsOf(card, ...references, new ModuleReference("@noldova/terminal.window", null, 6), new ModuleReference("../../../../resources.js", null, 7)), [
      `${card}:6: takes @noldova/terminal.window, which Pages may not use`,
      `${card}:7: takes ../../../../resources.js, outside Pages' folders`
    ]);
    assert.deepEqual(problemsOf(STORE, ...references.slice(0, 4)), [
      `${STORE}:1: takes @angular/core, which Pages may not use`,
      `${STORE}:2: takes @noldova/ui.components.angular, which Pages may not use`,
      `${STORE}:3: takes @noldova/ui.components.angular/markdown, which Pages may not use`,
      `${STORE}:4: takes @noldova/desktop.window, which Pages may not use`
    ]);
  });

  it("lets the Window take its page document, card and side view by their own names or lazily, and nothing else of Pages lazily", () => {
    const part = "src/noldova.teamrun.window/src/app/teamrun-window-part.ts";
    const message = "src/noldova.teamrun.window/src/app/components/history-message/history-message.component.ts";

    assert.deepEqual(problemsOf(part, new ModuleReference("./components/pages/page-document/page-document.component", ["PageDocumentComponent"], 1),
      new ModuleReference("./components/pages/pages-view/pages-view.component", ["PagesViewComponent"], 2),
      new ModuleReference("./components/pages/pages-view/pages-view.component", null, 3, true),
      new ModuleReference("./components/pages/page-document/page-document.component", null, 4, true)), []);
    assert.deepEqual(problemsOf(part, new ModuleReference("./components/pages/page-card/page-card-state", null, 5, true)), [
      `${part}:5: takes ./components/pages/page-card/page-card-state, inside Pages, which TeamRun reaches only through its entries`
    ]);
    assert.deepEqual(problemsOf(message, new ModuleReference("../pages/page-card/page-card.component", ["PageCardComponent"], 1),
      new ModuleReference("../pages/page-card/page-card-state", ["PageCardState"], 2)), [
      `${message}:2: takes ../pages/page-card/page-card-state, inside Pages, which TeamRun reaches only through its entries`
    ]);
  });

  it("lets TeamRun take and export only Pages' entries, each by its own name", () => {
    assert.deepEqual(problemsOf(HOST,
      new ModuleReference("../interfaces/pages/i-pages-host.js", ["IPagesHost"], 1),
      new ModuleReference("./pages/pages.js", ["Pages"], 2),
      new ModuleReference("./conversations-service.js", null, 3),
      new ModuleReference("@noldova/teamrun.protocol", null, 4)), []);
    assert.deepEqual(problemsOf(API,
      new ModuleReference("../models/pages/page.js", ["Page"], 1),
      new ModuleReference("../models/pages/page-author.js", ["PageAuthor"], 2),
      new ModuleReference("../models/pages/page-version.js", ["PageVersion"], 3),
      new ModuleReference("../models/pages/page-view.js", ["PageView"], 4),
      new ModuleReference("../models/pages/page-request.js", ["PageRequest"], 5),
      new ModuleReference("../models/pages/page-list-request.js", ["PageListRequest"], 9),
      new ModuleReference("../enums/pages/page-method-name.js", ["PageMethodName"], 6),
      new ModuleReference("../enums/pages/page-event-name.js", ["PageEventName"], 7),
      new ModuleReference("../interfaces/pages/i-pages-clock.js", ["IPagesClock"], 8)), []);
  });

  it("refuses TeamRun taking or exporting Pages' internals, or more than an entry's own name", () => {
    assert.deepEqual(problemsOf(API,
      new ModuleReference("../services/pages/pages-store.js", ["PagesStore"], 3),
      new ModuleReference("../exceptions/pages/page.exception.js", null, 4),
      new ModuleReference("../services/pages/pages.js", null, 5),
      new ModuleReference("../services/pages/pages.js", ["Pages", "PagesStore"], 6)), [
      `${API}:3: takes ../services/pages/pages-store.js, inside Pages, which TeamRun reaches only through its entries`,
      `${API}:4: takes ../exceptions/pages/page.exception.js, inside Pages, which TeamRun reaches only through its entries`,
      `${API}:5: takes more than Pages from ../services/pages/pages.js`,
      `${API}:6: takes more than Pages from ../services/pages/pages.js`
    ]);
  });

  it("names the rule with each finding", () => {
    const [finding] = PagesBoundaryCheck.inspect(HOST, [new ModuleReference("./pages/page-tool.js", ["PageTool"], 2)]);

    assert.match(finding ?? "", /; documents\/ARCHITECTURE\.md, the page tools, keeps Pages behind its module boundary/);
  });
});
