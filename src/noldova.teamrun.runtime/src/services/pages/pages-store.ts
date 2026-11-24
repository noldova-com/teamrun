/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { randomUUID } from "node:crypto";
import { readFileSync, realpathSync, statSync } from "node:fs";
import { extname, resolve, sep } from "node:path";

import { type IModuleLog, ToolFailureCode } from "@noldova/desktop.runtime";
import "@noldova/context.core";
import type { DataRecord } from "@noldova/context.data";
import { type SqlConnection, SqlQuery, type SqlTransaction } from "@noldova/context.data.sql";
import { JsonReader } from "@noldova/context.json";
import { CanvasManifest, Page, PageAuthor, PageKind, PageVersion } from "@noldova/teamrun.protocol";

import { PageException } from "../../exceptions/pages/page.exception.js";
import { PageContent } from "../../models/pages/page-content.js";
import { PageTransaction } from "../../models/pages/page-transaction.js";
import { PageWrite } from "../../models/pages/page-write.js";
import type { PageTextEdit } from "../../models/pages/page-text-edit.js";
import { PagesResources } from "./pages-resources.js";
import type { PageFiles } from "./page-files.js";

export class PagesStore {
  private readonly connection: SqlConnection;
  private readonly files: PageFiles;
  private readonly log: IModuleLog;

  public constructor(connection: SqlConnection, files: PageFiles, log: IModuleLog) {
    this.connection = connection;
    this.files = files;
    this.log = log;
  }

  public async showAsync(chatId: string, folder: string, author: PageAuthor, path: string, title: string, id: string | null, baseVersion: number | null,
    writing: () => void): Promise<Page> {
    return this.inTransactionAsync(async scope => {
      if (!Object.isNull(id))
        await this.requireNotArtboardAsync(chatId, id, scope.transaction);
      return this.saveAsync(await this.shownAsync(chatId, folder, author, path, title, id, baseVersion, scope.transaction), writing, scope);
    });
  }

  public async shownAsync(chatId: string, folder: string, author: PageAuthor, path: string, title: string, id: string | null, baseVersion: number | null,
    transaction?: SqlTransaction): Promise<PageWrite> {
    PagesStore.requireTitle(title);
    const file = PagesStore.fileIn(folder, path);
    const content = readFileSync(file);
    PagesStore.requireSize(content.length);
    const html = content.toString("utf8");
    PagesStore.requireSize(PagesStore.bytesOf(html));
    const now = new Date().toISOString();
    if (Object.isNull(id))
      return new PageWrite(new Page(randomUUID(), chatId, title, 1, author, author, file, PagesStore.bytesOf(html), now, now), html, true);
    if (Object.isNull(baseVersion))
      throw new PageException(ToolFailureCode.Refused, PagesResources.baseVersionMissing);
    const page = await this.requireAsync(chatId, id, PageKind.Page, transaction);
    PagesStore.requireCurrent(page, baseVersion);
    return new PageWrite(new Page(page.id, chatId, title, page.version + 1, page.madeBy, author, file, PagesStore.bytesOf(html), page.createdAt, now), html, false);
  }

  public async listAsync(chatId: string, transaction?: SqlTransaction): Promise<readonly Page[]> {
    if (Object.isUndefined(transaction))
      return this.connection.runInTransactionAsync(t => this.listAsync(chatId, t));
    const records = await this.recordsAsync(chatId, transaction);
    const artboards = await this.artboardsOfAsync(records, transaction);
    return records.filter(t => t.kind === PageKind.Page && !artboards.has(t.id));
  }

  public async listOfTeammateAsync(teammateId: string, transaction?: SqlTransaction): Promise<readonly Page[]> {
    if (Object.isUndefined(transaction))
      return this.connection.runInTransactionAsync(t => this.listOfTeammateAsync(teammateId, t));
    const pages = (await transaction.queryAsync(new SqlQuery(PagesResources.selectTeammatePages, [teammateId, teammateId]))).map(t => Page.fromJson(PagesStore.jsonOf(t)));
    const artboards = new Set<string>();
    for (const chatId of new Set(pages.map(t => t.chatId)))
      for (const id of await this.artboardsOfAsync(await this.recordsAsync(chatId, transaction), transaction))
        artboards.add(id);
    return pages.filter(t => !artboards.has(t.id)).slice(0, PagesResources.teammatePageLimit);
  }

  public async canvasesAsync(chatId: string): Promise<readonly Page[]> {
    return (await this.recordsAsync(chatId)).filter(t => t.kind === PageKind.Canvas);
  }

  public async sizesAsync(chatId: string, transaction: SqlTransaction): Promise<ReadonlyMap<string, number>> {
    return new Map((await transaction.queryAsync(new SqlQuery(PagesResources.selectPageSizes, [chatId])))
      .map(t => [t.readString(PagesResources.idColumn), t.readInteger(PagesResources.bytesColumn)]));
  }

  public async readAsync(chatId: string, id: string, version: number | null, kind: PageKind = PageKind.Page, transaction?: SqlTransaction):
    Promise<PageContent> {
    const page = await this.requireAsync(chatId, id, kind, transaction);
    const wanted = version ?? page.version;
    const record = (await (transaction ?? this.connection).queryAsync(new SqlQuery(PagesResources.selectPageVersion, [page.id, wanted])))[0];
    if (Object.isUndefined(record))
      throw new PageException(ToolFailureCode.Refused, kind === PageKind.Canvas ? PagesResources.canvasVersionUnknown : PagesResources.versionUnknown);
    return new PageContent(page, wanted, PageAuthor.fromJson(PagesStore.jsonOf(record)), record.readString(PagesResources.htmlColumn));
  }

  public async editAsync(chatId: string, author: PageAuthor, id: string, baseVersion: number, html: string | null, edits: readonly PageTextEdit[],
    title: string | null, writing: () => void): Promise<Page> {
    return this.inTransactionAsync(async scope => {
      await this.requireNotArtboardAsync(chatId, id, scope.transaction);
      return this.saveAsync(await this.editedAsync(chatId, author, id, baseVersion, html, edits, title, scope.transaction), writing, scope);
    });
  }

  public async editedAsync(chatId: string, author: PageAuthor, id: string, baseVersion: number, html: string | null, edits: readonly PageTextEdit[],
    title: string | null, transaction?: SqlTransaction): Promise<PageWrite> {
    if (Object.isNull(html) === (edits.length === 0))
      throw new PageException(ToolFailureCode.Refused, PagesResources.editMissing);
    if (!Object.isNull(title))
      PagesStore.requireTitle(title);
    const current = await this.readAsync(chatId, id, null, PageKind.Page, transaction);
    const page = current.page;
    PagesStore.requireCurrent(page, baseVersion);
    const next = html ?? PagesStore.withEdits(current.html, edits);
    PagesStore.requireSize(PagesStore.bytesOf(next));
    return new PageWrite(new Page(page.id, chatId, title ?? page.title, page.version + 1, page.madeBy, author, page.path, PagesStore.bytesOf(next),
      page.createdAt, new Date().toISOString()), next, false);
  }

  public async findAsync(id: string, transaction?: SqlTransaction): Promise<Page> {
    const record = (await (transaction ?? this.connection).queryAsync(new SqlQuery(PagesResources.selectPageById, [id])))[0];
    if (Object.isUndefined(record))
      throw new PageException(ToolFailureCode.Refused, PagesResources.unknown);
    return PagesStore.requireKind(Page.fromJson(PagesStore.jsonOf(record)), PageKind.Page);
  }

  public async versionsAsync(id: string): Promise<readonly PageVersion[]> {
    return (await this.connection.queryAsync(new SqlQuery(PagesResources.selectPageVersions, [id]))).map(t => new PageVersion(
      t.readInteger(PagesResources.versionColumn), PageAuthor.fromJson(PagesStore.jsonOf(t)), t.readString(PagesResources.createdAtColumn)));
  }

  public async restoreAsync(id: string, version: number, author: PageAuthor): Promise<Page> {
    return this.inTransactionAsync(async scope => {
      const transaction = scope.transaction;
      const page = await this.findAsync(id, transaction);
      await this.requireNotArtboardAsync(page.chatId, id, transaction);
      const html = (await this.readAsync(page.chatId, id, version, PageKind.Page, transaction)).html;
      return this.saveAsync(new PageWrite(new Page(page.id, page.chatId, page.title, page.version + 1, page.madeBy, author, page.path,
        PagesStore.bytesOf(html), page.createdAt, new Date().toISOString()), html, false), () => undefined, scope);
    });
  }

  public copyOf(page: Page): string {
    return this.files.pathOf(page.chatId, page.id);
  }

  public async chatIdsAsync(): Promise<readonly string[]> {
    const records = await this.connection.queryAsync(new SqlQuery(PagesResources.selectChats));
    return [...new Set([...records.map(t => t.readString(PagesResources.chatIdColumn)), ...this.files.list()])];
  }

  public async removeChatAsync(chatId: string): Promise<void> {
    await this.connection.runInTransactionAsync(async transaction => {
      await transaction.executeAsync(new SqlQuery(PagesResources.deletePageVersionsByChat, [chatId]));
      await transaction.executeAsync(new SqlQuery(PagesResources.deletePagesByChat, [chatId]));
    });
    this.files.remove(chatId);
  }

  public async saveAsync(write: PageWrite, writing: () => void, scope?: PageTransaction): Promise<Page> {
    await this.saveAllAsync([write], writing, scope);
    return write.page;
  }

  public async saveAllAsync(writes: readonly PageWrite[], writing: () => void, scope?: PageTransaction): Promise<void> {
    if (Object.isUndefined(scope))
      return this.inTransactionAsync(t => this.saveAllAsync(writes, writing, t));
    writing();
    await PagesStore.writeRowsAsync(writes, scope.transaction);
    scope.copies.push(...writes.filter(t => t.page.kind === PageKind.Page));
  }

  public async inTransactionAsync<T>(work: (scope: PageTransaction) => Promise<T>): Promise<T> {
    const copies: PageWrite[] = [];
    const result = await this.connection.runInTransactionAsync(transaction => work(new PageTransaction(transaction, copies)));
    for (const write of copies)
      try {
        this.files.write(write.page.chatId, write.page.id, write.html);
      }
      catch (error) {
        this.log.write(PagesResources.formatCopyNotSaved(PagesStore.kindOf(error)));
      }
    return result;
  }

  public static fileSize(folder: string, path: string): number {
    return statSync(PagesStore.fileIn(folder, path)).size;
  }

  public static withEdits(html: string, edits: readonly PageTextEdit[]): string {
    let text = html;
    for (const [index, edit] of edits.entries()) {
      const at = text.indexOf(edit.find);
      if (at < 0)
        throw new PageException(ToolFailureCode.Refused, PagesResources.formatEditRefused(PagesResources.findMissing, index));
      if (text.indexOf(edit.find, at + 1) >= 0)
        throw new PageException(ToolFailureCode.Refused, PagesResources.formatEditRefused(PagesResources.findRepeated, index));
      text = `${text.slice(0, at)}${edit.replace}${text.slice(at + edit.find.length)}`;
    }
    return text;
  }

  public static requireTitle(title: string): void {
    if ([...title].length > PagesResources.maximumTitleLength)
      throw new PageException(ToolFailureCode.Refused, PagesResources.titleTooLong);
  }

  public static bytesOf(text: string): number {
    return Buffer.byteLength(text, "utf8");
  }

  private async recordsAsync(chatId: string, transaction?: SqlTransaction): Promise<readonly Page[]> {
    return (await (transaction ?? this.connection).queryAsync(new SqlQuery(PagesResources.selectPages, [chatId])))
      .map(t => Page.fromJson(PagesStore.jsonOf(t)));
  }

  private async artboardsOfAsync(records: readonly Page[], transaction: SqlTransaction): Promise<ReadonlySet<string>> {
    const artboards = new Set<string>();
    for (const canvas of records.filter(t => t.kind === PageKind.Canvas)) {
      const content = await this.readAsync(canvas.chatId, canvas.id, null, PageKind.Canvas, transaction);
      for (const artboard of CanvasManifest.fromJson(JsonReader.parse(content.html).toJson()).artboards)
        artboards.add(artboard.pageId);
    }
    return artboards;
  }

  private async requireAsync(chatId: string, id: string, kind: PageKind, transaction?: SqlTransaction): Promise<Page> {
    const record = (await (transaction ?? this.connection).queryAsync(new SqlQuery(PagesResources.selectPage, [id, chatId])))[0];
    if (Object.isUndefined(record))
      throw new PageException(ToolFailureCode.Refused, kind === PageKind.Canvas ? PagesResources.canvasUnknown : PagesResources.unknown);
    return PagesStore.requireKind(Page.fromJson(PagesStore.jsonOf(record)), kind);
  }

  private async requireNotArtboardAsync(chatId: string, id: string, transaction: SqlTransaction): Promise<void> {
    if ((await this.artboardsOfAsync(await this.recordsAsync(chatId, transaction), transaction)).has(id))
      throw new PageException(ToolFailureCode.Refused, PagesResources.artboardPage);
  }

  private static async writeRowsAsync(writes: readonly PageWrite[], transaction: SqlTransaction): Promise<void> {
    for (const write of writes) {
      const page = write.page;
      const json = JSON.stringify(page.toJson());
      if (write.isCreated)
        await transaction.executeAsync(new SqlQuery(PagesResources.insertPage, [page.id, page.chatId, json, page.updatedAt]));
      else
        await transaction.executeAsync(new SqlQuery(PagesResources.updatePage, [json, page.updatedAt, page.id]));
      await transaction.executeAsync(new SqlQuery(PagesResources.insertPageVersion,
        [page.id, page.version, page.chatId, JSON.stringify(page.editedBy.toJson()), write.html, page.updatedAt]));
      await transaction.executeAsync(new SqlQuery(PagesResources.trimPageVersions, [page.id, page.version - PagesResources.keptVersions]));
    }
  }

  private static requireCurrent(page: Page, baseVersion: number): void {
    if (baseVersion !== page.version)
      throw new PageException(ToolFailureCode.Stale, PagesResources.formatStale(page.version));
  }

  private static requireKind(page: Page, kind: PageKind): Page {
    if (page.kind !== kind)
      throw new PageException(ToolFailureCode.Refused, kind === PageKind.Page ? PagesResources.notAPage : PagesResources.notACanvas);
    return page;
  }

  private static jsonOf(record: DataRecord): unknown {
    return JsonReader.parse(record.readString(PagesResources.jsonColumn)).toJson();
  }

  private static fileIn(folder: string, path: string): string {
    const resolved = resolve(folder, path);
    const stat = statSync(resolved, { throwIfNoEntry: false });
    if (Object.isUndefined(stat) || !stat.isFile())
      throw new PageException(ToolFailureCode.Refused, PagesResources.fileMissing);
    const file = realpathSync.native(resolved);
    if (!file.startsWith(`${realpathSync.native(folder)}${sep}`))
      throw new PageException(ToolFailureCode.Refused, PagesResources.outsideFolder);
    if (!PagesResources.extensions.includes(extname(file).toLowerCase()))
      throw new PageException(ToolFailureCode.Refused, PagesResources.notHtml);
    PagesStore.requireSize(stat.size);
    return file;
  }

  private static requireSize(bytes: number): void {
    if (bytes > PagesResources.maximumBytes)
      throw new PageException(ToolFailureCode.TooLarge, PagesResources.tooLarge);
  }

  private static kindOf(error: unknown): string {
    return error instanceof Error ? error.name : typeof error;
  }
}
