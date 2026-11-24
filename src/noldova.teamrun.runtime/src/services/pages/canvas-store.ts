/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { randomUUID } from "node:crypto";

import { ToolFailureCode } from "@noldova/desktop.runtime";
import "@noldova/context.core";
import type { SqlTransaction } from "@noldova/context.data.sql";
import { JsonReader } from "@noldova/context.json";
import { CanvasArtboard, CanvasManifest, CanvasPage, Page, type PageAuthor, PageKind } from "@noldova/teamrun.protocol";

import { PageException } from "../../exceptions/pages/page.exception.js";
import type { ArtboardPlace } from "../../models/pages/artboard-place.js";
import { CanvasArrangement } from "../../models/pages/canvas-arrangement.js";
import { CanvasContent } from "../../models/pages/canvas-content.js";
import type { CanvasArtboardChange } from "../../models/pages/canvas-artboard-change.js";
import { CanvasRevision } from "../../models/pages/canvas-revision.js";
import type { PageTextEdit } from "../../models/pages/page-text-edit.js";
import type { PageTransaction } from "../../models/pages/page-transaction.js";
import { PageWrite } from "../../models/pages/page-write.js";
import { PagesResources } from "./pages-resources.js";
import { PagesStore } from "./pages-store.js";

export class CanvasStore {
  private readonly pages: PagesStore;

  public constructor(pages: PagesStore) {
    this.pages = pages;
  }

  public async createAsync(chatId: string, folder: string, author: PageAuthor, title: string, pageNames: readonly string[], writing: () => void):
    Promise<CanvasContent> {
    PagesStore.requireTitle(title);
    const names = pageNames.length === 0 ? [PagesResources.firstCanvasPageName] : pageNames;
    if (names.length > PagesResources.maximumCanvasPages)
      throw new PageException(ToolFailureCode.Refused, PagesResources.tooManyCanvasPages);
    const manifest = new CanvasManifest(names.map(t => new CanvasPage(randomUUID(), t)), [], [], [], []);
    const json = JSON.stringify(manifest.toJson());
    const now = new Date().toISOString();
    const canvas = await this.pages.saveAsync(new PageWrite(new Page(randomUUID(), chatId, title, 1, author, author, folder, PagesStore.bytesOf(json), now, now,
      PageKind.Canvas), json, true), writing);
    return new CanvasContent(canvas, canvas.version, manifest);
  }

  public async readAsync(chatId: string, id: string, version: number | null, transaction?: SqlTransaction): Promise<CanvasContent> {
    const content = await this.pages.readAsync(chatId, id, version, PageKind.Canvas, transaction);
    return new CanvasContent(content.page, content.version, CanvasManifest.fromJson(JsonReader.parse(content.html).toJson()));
  }

  public async addArtboardAsync(chatId: string, folder: string, author: PageAuthor, id: string, baseVersion: number, path: string, title: string,
    canvasPage: string | null, place: ArtboardPlace, writing: () => void): Promise<CanvasRevision> {
    return this.pages.inTransactionAsync(async scope => {
      const transaction = scope.transaction;
      const current = await this.currentAsync(chatId, id, baseVersion, transaction);
      const manifest = current.manifest;
      if (manifest.artboards.length >= PagesResources.maximumArtboards)
        throw new PageException(ToolFailureCode.Refused, PagesResources.tooManyArtboards);
      const onPage = Object.isNull(canvasPage) ? manifest.pages[0] : manifest.pages.find(t => t.id === canvasPage);
      if (Object.isUndefined(onPage))
        throw new PageException(ToolFailureCode.Refused, PagesResources.canvasPageUnknown);
      const pageId = onPage.id;
      await this.requireRoomAsync(chatId, manifest.artboards, PagesStore.fileSize(folder, path), transaction);
      const right = Math.max(-PagesResources.artboardGap, ...manifest.artboards.filter(t => t.canvasPage === pageId).map(t => t.x + t.width));
      const write = await this.pages.shownAsync(chatId, folder, author, path, title, null, null, transaction);
      const page = write.page;
      const artboard = new CanvasArtboard(randomUUID(), page.id, page.version, pageId, place.x ?? right + PagesResources.artboardGap, place.y ?? 0,
        place.width ?? PagesResources.artboardWidth, place.height ?? PagesResources.artboardHeight, title, false, false, null);
      return new CanvasRevision(await this.savedAsync(current, author, CanvasStore.manifestOf(current, [...manifest.artboards, artboard]), [write], writing,
        scope), artboard, page);
    });
  }

  public async reviseArtboardAsync(chatId: string, folder: string, author: PageAuthor, id: string, baseVersion: number, artboardId: string, path: string | null,
    html: string | null, edits: readonly PageTextEdit[], title: string | null, writing: () => void): Promise<CanvasRevision> {
    if ([path, html].filter(t => !Object.isNull(t)).length + (edits.length === 0 ? 0 : 1) !== 1)
      throw new PageException(ToolFailureCode.Refused, PagesResources.reviseMissing);
    return this.pages.inTransactionAsync(async scope => {
      const transaction = scope.transaction;
      const current = await this.currentAsync(chatId, id, baseVersion, transaction);
      const artboard = current.manifest.artboards.find(t => t.id === artboardId);
      if (Object.isUndefined(artboard))
        throw new PageException(ToolFailureCode.Refused, PagesResources.artboardUnknown);
      const others = current.manifest.artboards.filter(t => t.id !== artboardId);
      const before = await this.pages.readAsync(chatId, artboard.pageId, null, PageKind.Page, transaction);
      let write: PageWrite;
      if (Object.isNull(path)) {
        const next = html ?? PagesStore.withEdits(before.html, edits);
        await this.requireRoomAsync(chatId, others, PagesStore.bytesOf(next), transaction);
        write = await this.pages.editedAsync(chatId, author, before.page.id, before.page.version, next, [], title, transaction);
      }
      else {
        await this.requireRoomAsync(chatId, others, PagesStore.fileSize(folder, path), transaction);
        write = await this.pages.shownAsync(chatId, folder, author, path, title ?? before.page.title, before.page.id, before.page.version, transaction);
      }
      const revised = CanvasStore.withPage(artboard, write.page, title ?? artboard.title);
      return new CanvasRevision(await this.savedAsync(current, author,
        CanvasStore.manifestOf(current, current.manifest.artboards.map(t => t.id === artboardId ? revised : t)), [write], writing, scope), revised, write.page);
    });
  }

  public async arrangeAsync(chatId: string, author: PageAuthor, id: string, baseVersion: number, changes: readonly CanvasArtboardChange[],
    pages: readonly CanvasPage[] | null, writing: () => void): Promise<CanvasArrangement> {
    return this.pages.inTransactionAsync(async scope => {
      const transaction = scope.transaction;
      const current = await this.currentAsync(chatId, id, baseVersion, transaction);
      if (!Object.isNull(pages) && pages.length > PagesResources.maximumCanvasPages)
        throw new PageException(ToolFailureCode.Refused, PagesResources.tooManyCanvasPages);
      const byId = new Map(changes.map(t => [t.id, t]));
      if (byId.size !== changes.length || changes.some(t => !current.manifest.artboards.some(u => u.id === t.id)))
        throw new PageException(ToolFailureCode.Refused, PagesResources.artboardUnknown);
      for (const change of changes)
        if (!Object.isNull(change.title))
          PagesStore.requireTitle(change.title);
      const artboards = current.manifest.artboards.flatMap(t => {
        const change = byId.get(t.id);
        return Object.isUndefined(change) ? [t] : change.applied(t);
      });
      const canvasPages = pages ?? current.manifest.pages;
      CanvasStore.requirePlaced(current.manifest, changes, artboards, canvasPages);
      const manifest = CanvasStore.manifestOf(current, artboards, canvasPages);
      const kept = new Set(artboards.map(t => t.pageId));
      const content = await this.savedAsync(current, author, manifest, [], writing, scope);
      const released: Page[] = [];
      for (const artboard of current.manifest.artboards.filter(t => !kept.has(t.pageId)))
        released.push(await this.pages.findAsync(artboard.pageId, transaction));
      return new CanvasArrangement(content, released);
    });
  }

  private async currentAsync(chatId: string, id: string, baseVersion: number, transaction: SqlTransaction): Promise<CanvasContent> {
    const current = await this.readAsync(chatId, id, null, transaction);
    if (baseVersion !== current.version)
      throw new PageException(ToolFailureCode.Stale, PagesResources.formatCanvasStale(current.version));
    return current;
  }

  private async requireRoomAsync(chatId: string, artboards: readonly CanvasArtboard[], added: number, transaction: SqlTransaction): Promise<void> {
    const ids = new Set(artboards.map(t => t.pageId));
    let bytes = added;
    for (const [id, size] of await this.pages.sizesAsync(chatId, transaction))
      if (ids.has(id))
        bytes += size;
    if (bytes > PagesResources.maximumCanvasBytes)
      throw new PageException(ToolFailureCode.TooLarge, PagesResources.canvasTooLarge);
  }

  private async savedAsync(current: CanvasContent, author: PageAuthor, manifest: CanvasManifest, writes: readonly PageWrite[], writing: () => void,
    scope: PageTransaction): Promise<CanvasContent> {
    const json = JSON.stringify(manifest.toJson());
    const canvas = current.canvas;
    const next = new Page(canvas.id, canvas.chatId, canvas.title, canvas.version + 1, canvas.madeBy, author, canvas.path, PagesStore.bytesOf(json),
      canvas.createdAt, new Date().toISOString(), PageKind.Canvas);
    await this.pages.saveAllAsync([...writes, new PageWrite(next, json, false)], writing, scope);
    return new CanvasContent(next, next.version, manifest);
  }

  private static requirePlaced(current: CanvasManifest, changes: readonly CanvasArtboardChange[], artboards: readonly CanvasArtboard[],
    pages: readonly CanvasPage[]): void {
    const pageIds = new Set(pages.map(t => t.id));
    if (changes.some(t => !t.removed && !Object.isNull(t.canvasPage) && !pageIds.has(t.canvasPage)))
      throw new PageException(ToolFailureCode.Refused, PagesResources.canvasPageUnknown);
    if ([...artboards, ...current.notes, ...current.marks, ...current.guides].some(t => !pageIds.has(t.canvasPage)))
      throw new PageException(ToolFailureCode.Refused, PagesResources.canvasPageInUse);
  }

  private static manifestOf(current: CanvasContent, artboards: readonly CanvasArtboard[], pages: readonly CanvasPage[] = current.manifest.pages):
    CanvasManifest {
    return new CanvasManifest(pages, artboards, current.manifest.notes, current.manifest.marks, current.manifest.guides);
  }

  private static withPage(artboard: CanvasArtboard, page: Page, title: string): CanvasArtboard {
    return new CanvasArtboard(artboard.id, page.id, page.version, artboard.canvasPage, artboard.x, artboard.y, artboard.width, artboard.height, title,
      artboard.locked, artboard.hidden, artboard.group);
  }
}
