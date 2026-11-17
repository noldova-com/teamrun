/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import type { JsonObject, JsonValue } from "@noldova/context.json";

import { PageStep } from "../../../../src/app/models/pages/page-step";
import { SamplePages } from "../../../fixtures/sample-pages.fixture";

describe("PageStep", () => {
  const page = SamplePages.page("p1", "Onboarding options");

  it("names the shown file from the page's own path when the step kept no input", () => {
    expect(PageStep.of({ tool: "teamrun_show_page" }, "", JSON.stringify(page.toJson()))?.title(false, false)).toBe("Showed a page · p1.html");
  });

  it("keeps the bare title when the result doesn't say what the step did", () => {
    expect([
      PageStep.of({ tool: "teamrun_list_pages" }, "", "not json")?.title(false, false),
      PageStep.of({ tool: "teamrun_read_page" }, "", JSON.stringify({ page: page.toJson() }))?.title(false, false),
      PageStep.of({ tool: "teamrun_edit_page", input: { page_id: "p1" } }, "", JSON.stringify(page.toJson()))?.title(false, false),
      PageStep.of({ tool: "teamrun_show_page" }, "MCP tool teamrun/teamrun_show_page", null)?.title(false, false)
    ]).toEqual(["Listed the chat's pages", "Read a page", "Edited a page", "Showed a page"]);
  });

  it("keeps the bare title for a path with no file name, and for a content list without a text block", () => {
    expect([
      PageStep.of({ tool: "teamrun_show_page", input: { path: "site/" } }, "", null)?.title(false, false),
      PageStep.of({ tool: "teamrun_list_pages" }, "", JSON.stringify([{ type: "image" }]))?.title(false, false)
    ]).toEqual(["Showed a page", "Listed the chat's pages"]);
  });

  it("names a failure without a reason by its label alone, and each tool's running label", () => {
    expect([
      PageStep.of({ tool: "teamrun_read_page" }, "", " \n ")?.title(false, true),
      ...["teamrun_show_page", "teamrun_list_pages", "teamrun_read_page"].map(t => PageStep.of({ tool: t }, "", null)?.title(true, false))
    ]).toEqual(["Couldn't read a page", "Showing a page", "Listing the chat's pages", "Reading a page"]);
  });

  it("names each canvas step in the canvas's, the artboard's or the arrangement's words", () => {
    const canvas = { canvas: { title: "Onboarding" } };
    const artboard = { title: "Home", pageVersion: 3 };

    expect([
      PageStep.of({ tool: "teamrun_canvas_create" }, "", JSON.stringify(canvas))?.title(false, false),
      PageStep.of({ tool: "mcp__teamrun__teamrun_canvas_read" }, "", JSON.stringify(canvas))?.title(false, false),
      PageStep.of({ tool: "teamrun_canvas_add_artboard" }, "", JSON.stringify({ artboard }))?.title(false, false),
      PageStep.of({ tool: "teamrun_canvas_revise_artboard" }, "", JSON.stringify({ artboard }))?.title(false, false),
      PageStep.of({ tool: "teamrun_canvas_arrange", input: { artboards: [{ id: "a1" }, { id: "a2" }], pages: [{ name: "P" }] } }, "", "{}")?.title(false, false),
      PageStep.of({ tool: "teamrun_canvas_arrange", input: { artboards: [{ id: "a1" }] } }, "", "{}")?.title(false, false),
      PageStep.of({ tool: "teamrun_canvas_arrange", input: { pages: [{ name: "P" }] } }, "", "{}")?.title(false, false)
    ]).toEqual(["Made a canvas · Onboarding", "Read the canvas · Onboarding", "Added an artboard · Home", "Revised an artboard · Home · v3",
      "Arranged the canvas · 2 artboards and the pages", "Arranged the canvas · 1 artboard", "Arranged the canvas · the pages"]);
  });

  it("names a running canvas step by the title it was given, a failed one with its reason, and an unreadable one by its label", () => {
    expect([
      PageStep.of({ tool: "teamrun_canvas_add_artboard", input: { title: "Home" } }, "", null)?.title(true, false),
      PageStep.of({ tool: "teamrun_canvas_create", input: { title: "Onboarding" } }, "", null)?.title(true, false),
      PageStep.of({ tool: "teamrun_canvas_read", input: { title: "Ignored" } }, "", null)?.title(true, false),
      PageStep.of({ tool: "teamrun_canvas_arrange" }, "", null)?.title(true, false),
      PageStep.of({ tool: "teamrun_canvas_revise_artboard" }, "", "Stale The canvas has changed since that version.")?.title(false, true),
      PageStep.of({ tool: "teamrun_canvas_revise_artboard" }, "", JSON.stringify({ artboard: { title: "Home" } }))?.title(false, false),
      PageStep.of({ tool: "teamrun_canvas_arrange", input: {} }, "", "{}")?.title(false, false),
      PageStep.of({ tool: "teamrun_canvas_arrange", input: { artboards: [] } }, "", "{}")?.title(false, false),
      PageStep.of({ tool: "teamrun_canvas_create" }, "", "{}")?.title(false, false),
      PageStep.of({ tool: "teamrun_canvas_read" }, "", JSON.stringify({ canvas: { title: 7 } }))?.title(false, false),
      PageStep.of({ tool: "teamrun_canvas_add_artboard" }, "", "{}")?.title(false, false)
    ]).toEqual(["Adding an artboard · Home", "Making a canvas · Onboarding", "Reading the canvas", "Arranging the canvas",
      "Couldn't revise an artboard: Stale The canvas has changed since that version.", "Revised an artboard", "Arranged the canvas", "Arranged the canvas",
      "Made a canvas", "Read the canvas", "Added an artboard"]);
  });

  it("gives no page for a canvas step, so the reply shows no page card for it", () => {
    const added = PageStep.of({ tool: "teamrun_canvas_add_artboard", input: { title: "Home" } }, "", JSON.stringify({ page: page.toJson() }));

    expect([added?.page, added?.pageId]).toEqual([null, null]);
  });

  it("reads an ACP step's result from its content's text, and from no content without text", () => {
    const acp = (content: JsonValue): JsonObject => ({ tool: "mcp__teamrun__teamrun_show_page", toolCallId: "c1", status: "completed", content });
    const shown = PageStep.of(acp([{ type: "content", content: { type: "text", text: JSON.stringify(page.toJson()) } }]), "teamrun__teamrun_show_page", null);

    expect([shown?.page?.id, shown?.title(false, false), PageStep.of(acp([{ type: "diff" }]), "teamrun__teamrun_show_page", null)?.page,
      PageStep.of(acp("none"), "teamrun__teamrun_show_page", null)?.title(false, false)]).toEqual(["p1", "Showed a page · p1.html", null, "Showed a page"]);
  });

  it("reads no page from a list or read step, and is no step for another tool or a payload without a tool", () => {
    const listed = PageStep.of({ tool: "teamrun_list_pages" }, "", JSON.stringify(page.toJson()));

    expect([listed?.page, listed?.pageId, PageStep.of({ tool: "browser_click" }, "", null), PageStep.of(["teamrun_show_page"], "", null), PageStep.of(null, "", null)])
      .toEqual([null, null, null, null, null]);
  });
});
