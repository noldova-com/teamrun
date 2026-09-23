/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/teamrun-foundation-core";

import type { IComposerDraftStore } from "../interfaces/i-composer-draft-store";
import { ComposerDraft } from "../models/composer-draft";
import { DraftAttachment } from "../models/draft-attachment";
import { DraftManifest } from "../models/draft-manifest";
import { Resources } from "../resources";

export class IndexedDbDraftStore implements IComposerDraftStore {
  private readonly factory: IDBFactory;
  private database: Promise<IDBDatabase> | null = null;
  private closed: boolean = false;

  public constructor(factory: IDBFactory) {
    this.factory = factory;
  }

  public async read(conversationId: string): Promise<ComposerDraft | null> {
    const database = await this.open();
    return new Promise((resolve, reject) => {
      const transaction = database.transaction(Resources.draftStoreNames, Resources.draftReadMode);
      let draft: ComposerDraft | null = null;
      let failure: unknown = null;
      const request = transaction.objectStore(Resources.draftManifestStore).get(conversationId);
      request.onsuccess = () => {
        try {
          const raw: unknown = request.result;
          if (Object.isUndefined(raw))
            return;
          const manifest = DraftManifest.fromStored(raw);
          if (manifest.conversationId !== conversationId)
            throw new Error(Resources.draftUnreadable);
          const files: DraftAttachment[] = [];
          draft = new ComposerDraft(conversationId, manifest.text, []);
          for (const id of manifest.attachmentIds) {
            const attachment = transaction.objectStore(Resources.draftFileStore).get(id);
            attachment.onsuccess = () => {
              try {
                const value = DraftAttachment.fromStored(attachment.result);
                if (value.id !== id)
                  throw new Error(Resources.draftUnreadable);
                files.push(value);
                draft = new ComposerDraft(conversationId, manifest.text, files);
              }
              catch (error) {
                failure = error;
                transaction.abort();
              }
            };
          }
        }
        catch (error) {
          failure = error;
          transaction.abort();
        }
      };
      transaction.oncomplete = () => resolve(draft);
      transaction.onabort = () => reject(failure ?? transaction.error ?? new Error(Resources.draftUnreadable));
    });
  }

  public write(draft: ComposerDraft): Promise<void> {
    return this.commit(draft, null);
  }

  public removeSent(draft: ComposerDraft): Promise<void> {
    return this.commit(new ComposerDraft(draft.conversationId, String.empty, []),
      new DraftManifest(draft.conversationId, draft.text, draft.attachments.map(t => t.id)));
  }

  private async commit(draft: ComposerDraft, expected: DraftManifest | null): Promise<void> {
    const database = await this.open();
    return new Promise((resolve, reject) => {
      const transaction = database.transaction(Resources.draftStoreNames, Resources.draftWriteMode, { durability: Resources.draftDurability });
      const manifests = transaction.objectStore(Resources.draftManifestStore);
      const files = transaction.objectStore(Resources.draftFileStore);
      const ids = draft.attachments.map(t => t.id);
      const previous = manifests.get(draft.conversationId);
      let failure: unknown = null;
      previous.onsuccess = () => {
        try {
          const raw: unknown = previous.result;
          const manifest = Object.isUndefined(raw) ? null : DraftManifest.fromStored(raw);
          if (!Object.isNull(expected) && (Object.isNull(manifest) || !manifest.matches(expected)))
            return;
          if (!Object.isNull(manifest))
            for (const id of manifest.attachmentIds)
              if (!ids.includes(id))
                files.delete(id);
          for (const attachment of draft.attachments) {
            const existing = files.getKey(attachment.id);
            existing.onsuccess = () => {
              if (Object.isUndefined(existing.result))
                files.put(attachment, attachment.id);
            };
          }
          if (draft.text.length === 0 && ids.length === 0)
            manifests.delete(draft.conversationId);
          else
            manifests.put(new DraftManifest(draft.conversationId, draft.text, ids), draft.conversationId);
        }
        catch (error) {
          failure = error;
          transaction.abort();
        }
      };
      transaction.oncomplete = () => resolve();
      transaction.onabort = () => reject(failure ?? transaction.error ?? new Error(Resources.draftSaveFailed));
    });
  }

  public close(): void {
    this.closed = true;
    void this.database?.then(t => t.close(), () => undefined);
  }

  private open(): Promise<IDBDatabase> {
    if (this.closed)
      return Promise.reject(new Error(Resources.draftStoreClosed));
    if (!Object.isNull(this.database))
      return this.database;
    const pending = new Promise<IDBDatabase>((resolve, reject) => {
      let blocked = false;
      const request = this.factory.open(Resources.draftDatabaseName, Resources.draftDatabaseVersion);
      request.onupgradeneeded = () => {
        for (const name of Resources.draftStoreNames)
          request.result.createObjectStore(name);
      };
      request.onerror = () => reject(request.error ?? new Error(Resources.draftUnreadable));
      request.onblocked = () => { blocked = true; reject(new Error(Resources.draftStoreBlocked)); };
      request.onsuccess = () => {
        const database = request.result;
        database.onversionchange = () => { database.close(); this.database = null; };
        if (this.closed || blocked) {
          database.close();
          reject(new Error(Resources.draftStoreClosed));
        }
        else
          resolve(database);
      };
    });
    this.database = pending.catch(error => { this.database = null; throw error; });
    return this.database;
  }
}
