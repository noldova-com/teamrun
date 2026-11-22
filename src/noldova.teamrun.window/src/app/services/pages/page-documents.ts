/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { ContentPadding, DocumentContribution, type IWindowPartContext } from "@noldova/desktop.window";
import { Page, PageEventName, PageKind } from "@noldova/teamrun.protocol";

import { PageDocumentResources } from "./page-document-resources";

export class PageDocuments {
  private static readonly releases: WeakMap<IWindowPartContext, () => void> = new WeakMap();
  private static readonly resyncs: WeakMap<IWindowPartContext, Set<() => void>> = new WeakMap();

  public static register(context: IWindowPartContext): void {
    context.registerDocument(new DocumentContribution(PageDocumentResources.documentName,
      () => import("../../components/pages/page-document/page-document.component").then(t => t.PageDocumentComponent), ContentPadding.None));
    PageDocuments.releases.get(context)?.();
    PageDocuments.releases.set(context, context.onEvent(PageDocumentResources.formatMethod(PageEventName.PageShown), t => {
      const page = PageDocuments.pageOf(t);
      if (page?.kind === PageKind.Page)
        PageDocuments.open(context, page);
    }));
  }

  public static release(context: IWindowPartContext): void {
    PageDocuments.releases.get(context)?.();
    PageDocuments.releases.delete(context);
  }

  public static onResync(context: IWindowPartContext, listener: () => void): () => void {
    const listeners = PageDocuments.resyncs.get(context) ?? new Set<() => void>();
    const entry = (): void => listener();
    PageDocuments.resyncs.set(context, listeners);
    listeners.add(entry);
    return () => listeners.delete(entry);
  }

  public static resync(context: IWindowPartContext): void {
    for (const listener of [...PageDocuments.resyncs.get(context) ?? []])
      listener();
  }

  public static open(context: IWindowPartContext, page: Page): void {
    context.openDocument(PageDocumentResources.documentName, page.id, page.title, { imageGlyph: PageDocumentResources.tabGlyph });
  }

  private static pageOf(payload: unknown): Page | null {
    try {
      return Page.fromJson(payload);
    }
    catch {
      return null;
    }
  }
}
