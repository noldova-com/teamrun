/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { CommandRun, NotificationAction, NotificationSeverity, QualifiedName } from "@noldova/desktop.protocol";

import { ErrorNotices } from "../../../src/app/services/error-notices";
import { Resources } from "../../../src/resources";
import { FakeWindowPartContext } from "../../fixtures/fake-window-part-context.fixture";
import { Wait } from "../../fixtures/wait.fixture";

describe("ErrorNotices", () => {
  let context: FakeWindowPartContext;
  let notices: ErrorNotices;

  const open = new CommandRun(QualifiedName.parse(Resources.openChatCommand), { [Resources.chatIdArgument]: "c1" });
  const keys = (kind: string): readonly (string | null)[] => context.shownNotices(kind).map(t => t.key);

  beforeEach(() => {
    context = new FakeWindowPartContext();
    notices = new ErrorNotices(context);
  });

  it("posts an error of its kind and key, with its title, text, opening command and actions", () => {
    const action = new NotificationAction(Resources.tryAgainLabel, new CommandRun(QualifiedName.parse(Resources.reloadCommand), null));

    notices.post(Resources.loadFailedNotice, "chat/c1", "Couldn't load the chat", "The runtime stopped.", open, [action]);

    const [posted] = context.shownNotices();
    expect([posted?.kind.text, posted?.key, posted?.title, posted?.text, posted?.severity, posted?.open, posted?.actions, posted?.progress])
      .toEqual([Resources.loadFailedNotice, "chat/c1", "Couldn't load the chat", "The runtime stopped.", NotificationSeverity.Error, open, [action], null]);
  });

  it("posts a blank text as none, and no actions when given none", () => {
    notices.post(Resources.chatActionFailedNotice, "RenameChat/c1", "Couldn't rename the chat", " ", null);

    expect(context.shownNotices().map(t => [t.text, t.open, t.actions])).toEqual([[null, null, []]]);
  });

  it("replaces the notice of the same kind and key, and keeps those of another key or kind", () => {
    notices.post(Resources.messageNotSentNotice, "c1", Resources.messageNotSentTitle, "first", open);
    notices.post(Resources.messageNotSentNotice, "c2", Resources.messageNotSentTitle, "other", open);
    notices.post(Resources.chatActionFailedNotice, "c1", "Couldn't rename the chat", null, open);
    notices.post(Resources.messageNotSentNotice, "c1", Resources.messageNotSentTitle, "second", open);

    expect(context.shownNotices(Resources.messageNotSentNotice).map(t => [t.key, t.text])).toEqual([["c2", "other"], ["c1", "second"]]);
    expect(keys(Resources.chatActionFailedNotice)).toEqual(["c1"]);
  });

  it("dismisses only the notices of its kind whose keys match, and nothing of a kind it never posted", async () => {
    notices.post(Resources.messageNotSentNotice, "c1", Resources.messageNotSentTitle, "first", open);
    notices.post(Resources.messageNotSentNotice, "c2", Resources.messageNotSentTitle, "second", open);
    notices.post(Resources.chatActionFailedNotice, "c1", "Couldn't rename the chat", null, open);

    notices.dismiss(Resources.messageNotSentNotice, t => t === "c1");
    notices.dismiss(Resources.loadFailedNotice, () => true);

    await Wait.until(() => expect(keys(Resources.messageNotSentNotice)).toEqual(["c2"]));
    expect(keys(Resources.chatActionFailedNotice)).toEqual(["c1"]);
    notices.dismiss(Resources.messageNotSentNotice, t => t === "c1");
    notices.dismiss(Resources.messageNotSentNotice, () => true);
    await Wait.until(() => expect(keys(Resources.messageNotSentNotice)).toEqual([]));
  });

  it("keeps a newer notice of the key when an earlier post's handle arrives only after that post was dismissed", async () => {
    let release = (): void => undefined;
    const held = new Promise<void>(resolve => {
      release = resolve;
    });
    context.notificationHold = held;
    notices.post(Resources.messageNotSentNotice, "c1", Resources.messageNotSentTitle, "first", open);
    notices.post(Resources.messageNotSentNotice, "c2", Resources.messageNotSentTitle, "other", open);
    notices.dismiss(Resources.messageNotSentNotice, t => t === "c1");
    notices.dismiss(Resources.messageNotSentNotice, t => t === "c2");
    context.notificationHold = null;
    notices.post(Resources.messageNotSentNotice, "c1", Resources.messageNotSentTitle, "second", open);

    release();
    await Wait.until(() => expect(keys(Resources.messageNotSentNotice)).toEqual(["c1"]));

    expect(context.shownNotices(Resources.messageNotSentNotice).map(t => t.text)).toEqual(["second"]);
    notices.dismiss(Resources.messageNotSentNotice, () => true);
    await Wait.until(() => expect(context.shownNotices()).toEqual([]));
  });

  it("logs a post Noldova Desktop refuses by the failure's kind, and dismisses nothing for it later", async () => {
    context.notificationFailure = new TypeError("refused");
    notices.post(Resources.loadFailedNotice, "kinds", "Couldn't load the providers TeamRun supports", "offline", null);
    context.notificationFailure = "refused";
    notices.post(Resources.loadFailedNotice, "catalog", "Couldn't load the projects, chats and teammates", "offline", null);

    await Wait.until(() => expect(context.lines).toEqual([Resources.formatNoticeNotPosted(Resources.loadFailedNotice, "TypeError"),
      Resources.formatNoticeNotPosted(Resources.loadFailedNotice, "string")]));
    notices.dismiss(Resources.loadFailedNotice, () => true);
    await Promise.resolve();
    expect(context.notifications).toEqual([]);
  });
});
