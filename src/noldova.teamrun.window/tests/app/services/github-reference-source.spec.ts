/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { Signal } from "@angular/core";
import type { JsonValue } from "@noldova/context.json";
import { FailureCode } from "@noldova/desktop.protocol";
import { DeviceCode, HostAccount, HostItem, HostPerson, HostReference, HostSignIn, ReferenceKind, ReferenceState } from "@noldova/git.hosting.protocol";
import { GitFolderParams, GitRemote, GitStatus, RemoteTransport } from "@noldova/git.protocol";
import type { LinkReference } from "@noldova/ui.components.angular";

import { GitHubReferenceSource } from "../../../src/app/services/github-reference-source";
import { DeferredResponse } from "../../fixtures/deferred-response.fixture";
import { FakeWindowPartContext } from "../../fixtures/fake-window-part-context.fixture";
import { Wait } from "../../fixtures/wait.fixture";

describe("GitHubReferenceSource", () => {
  const readMethod = "git-github.readReference";
  const signInEvent = "git-github.signInChanged";
  const signInMethod = "git-github.readSignIn";
  const statusMethod = "git.status";
  const statusOf = (remote: GitRemote | null): JsonValue => new GitStatus("main", null, null, [], false, "f1", null, remote).toJson();
  const gitHubRemote = new GitRemote("origin", "github.com", "noldova-com/teamrun", RemoteTransport.Https);
  const statusReads = (): readonly JsonValue[] => context.requests.filter(t => t.method === statusMethod).map(t => t.parameters);
  const urlOf = (number: number, kind: string = "issues"): string => `https://github.com/octocat/hello-world/${kind}/${number}`;
  const itemOf = (number: number, title: string = "Fix the greeting"): JsonValue =>
    new HostItem(new HostReference("git-github", "octocat", "hello-world", number), ReferenceKind.Issue, ReferenceState.Open, title, urlOf(number),
      new HostPerson("monalisa", null, null), Date.parse("2026-11-01T09:30:00.000Z"), null, 2, null).toJson();
  const numberOf = (parameters: JsonValue): number => HostReference.fromJson(parameters).number;
  const signedIn = HostSignIn.signedIn(new HostAccount("monalisa", null, null, ["repo"])).toJson();
  const signedOut = HostSignIn.signedOut().toJson();
  const waiting = HostSignIn.waiting(new DeviceCode("WDJB-MJHT", "https://github.com/login/device", Date.parse("2026-11-07T10:00:00.000Z"))).toJson();
  let context: FakeWindowPartContext;
  let held: Map<number, DeferredResponse>;

  const shown = (item: Signal<LinkReference | null>): readonly (string | null)[] | null => {
    const value = item();
    return value === null ? null : [value.reference, value.state?.label ?? null, value.title];
  };
  const reads = (): readonly number[] => context.requests.filter(t => t.method === readMethod).map(t => numberOf(t.parameters));
  const source = (): GitHubReferenceSource => {
    const found = GitHubReferenceSource.of(context);
    if (found === null)
      throw new Error("No source is registered for the context.");
    return found;
  };
  const find = (url: string): Signal<LinkReference | null> => {
    const item = source().find(url);
    if (item === null)
      throw new Error(`${url} isn't a GitHub item.`);
    return item;
  };

  beforeEach(() => {
    held = new Map();
    context = new FakeWindowPartContext().answerModule(readMethod, t => {
      const response = new DeferredResponse();
      held.set(numberOf(t), response);
      return response.promise;
    }).answerModule(signInMethod, () => signedIn);
    GitHubReferenceSource.register(context);
    context.emitModule(signInEvent, signedIn);
  });

  afterEach(() => {
    GitHubReferenceSource.release(context);
  });

  it("shows an item as its reference with no state while GitHub reads it, then as the item, asking by the item's reference", async () => {
    const item = find(urlOf(1));

    expect(shown(item)).toEqual(["octocat/hello-world#1", null, null]);
    await Wait.until(() => expect(reads()).toEqual([1]));
    expect(context.requests.find(t => t.method === readMethod)?.parameters).toEqual({ host: "git-github", owner: "octocat", repository: "hello-world", number: 1 });

    held.get(1)?.resolve(itemOf(1));

    await Wait.until(() => expect(shown(item)).toEqual(["octocat/hello-world#1", "Open", "Fix the greeting"]));
  });

  it("knows no link but a GitHub issue's or pull request's, and asks GitHub nothing about the others", () => {
    expect(["https://example.com/octocat/hello-world/issues/1", "https://github.com/octocat/hello-world", "chat://c1", "docs/readme.md"]
      .map(t => source().find(t))).toEqual([null, null, null, null]);
    expect(context.methods).toEqual([signInMethod]);
  });

  it("turns the reference into a plain link when no one is signed in to GitHub, and asks no one to sign in", async () => {
    const item = find(urlOf(1));
    await Wait.until(() => expect(reads()).toEqual([1]));

    held.get(1)?.resolve(null);

    await Wait.until(() => expect(item()).toBeNull());
    expect(context.methods).toEqual([signInMethod, readMethod]);
    expect(context.lines).toEqual([]);
  });

  it("turns the reference into a plain link when the read fails, the runtime is gone, the answer doesn't parse or the module doesn't answer, and logs each once", async () => {
    context.answerModule(readMethod, t => {
      const number = numberOf(t);
      if (number === 1)
        throw new Error("GitHub answered 502.");
      if (number === 2)
        throw Object.assign(new Error("The runtime is gone."), { code: FailureCode.Disconnected });
      if (number === 3)
        return { title: "No more than a title" };
      return number === 4 ? Promise.reject(new Error("The GitHub module isn't running.")) : Promise.reject("The GitHub module stopped.");
    });

    const items = [1, 2, 3, 4, 5].map(t => find(urlOf(t)));

    await Wait.until(() => expect(items.map(t => t())).toEqual([null, null, null, null, null]));
    expect(context.lines.map(t => /^Reading a GitHub reference failed, so it shows as a plain link: \w+$/.test(t))).toEqual([true, true, true, true, true]);
    expect(context.lines.filter(t => t.endsWith(": string"))).toHaveLength(1);
    expect(context.lines.join(" ")).not.toMatch(/octocat|hello-world|502|isn't running|stopped/);
  });

  it("reads an item once for every link and message that names it, as an issue's address or a pull request's, in any case", async () => {
    const first = find(urlOf(5));
    const again = [find(urlOf(5, "pull")), find("https://github.com/Octocat/Hello-World/issues/5/"), find(`${urlOf(5)}#issuecomment-1`)];

    await Wait.until(() => expect(reads()).toEqual([5]));
    expect(again.map(t => t === first)).toEqual([true, true, true]);
  });

  it("finds owner/repo#N in a reply's text, and no bare #N, and reads it once with the item's address", async () => {
    const matches = GitHubReferenceSource.of(context)?.findText("octocat/hello-world#5 and #6") ?? [];
    const first = find(urlOf(5, "pull"));

    expect(matches.map(t => [t.start, t.length, t.url])).toEqual([[0, 21, urlOf(5)]]);
    expect(matches.map(t => find(t.url) === first)).toEqual([true]);
    await Wait.until(() => expect(reads()).toEqual([5]));
  });

  it("reads a chat folder's GitHub repository once, and finds a bare #N as that repository's item through the repository's reader", async () => {
    context.answerModule(statusMethod, () => statusOf(gitHubRemote));
    const home = source().homeOf("/work/teamrun");
    const before = home();
    await Wait.until(() => expect(home()).toBe("noldova-com/teamrun"));
    const reader = source().readerFor(home());

    expect([before, source().homeOf("/work/teamrun") === home, source().readerFor("noldova-com/teamrun") === reader, source().readerFor(null) === source()])
      .toEqual([null, true, true, true]);
    expect(reader.findText?.("Fixed in #12, see octocat/hello-world#5.").map(t => t.url)).toEqual([
      "https://github.com/noldova-com/teamrun/issues/12", urlOf(5)
    ]);
    expect(reader.find(urlOf(5), "#5") === find(urlOf(5))).toBe(true);
    expect(statusReads()).toEqual([{ folder: "/work/teamrun" }]);
  });

  it("knows no repository for a chat without a folder, a folder Git can't read or isn't running for, or a remote that isn't GitHub's, so a bare #N stays text", async () => {
    context.answerModule(statusMethod, t => {
      const folder = GitFolderParams.fromJson(t).folder;
      if (folder === "/work/gone")
        return Promise.reject(new Error("The Git module isn't running."));
      if (folder === "/work/plain")
        return statusOf(null);
      if (folder === "/work/broken")
        return { branch: 1 };
      return statusOf(folder === "/work/gitlab" ? new GitRemote("origin", "gitlab.com", "noldova-com/teamrun", RemoteTransport.Https) : gitHubRemote);
    });
    const homes = [null, "relative/teamrun", "/work/gone", "/work/plain", "/work/broken", "/work/gitlab", "/work/teamrun"].map(t => source().homeOf(t));

    await Wait.until(() => expect(homes.at(-1)?.()).toBe("noldova-com/teamrun"));
    expect([homes.map(t => t()), statusReads().length]).toEqual([[null, null, null, null, null, null, "noldova-com/teamrun"], 5]);
    expect(source().readerFor(null).findText?.("Fixed in #12.")).toEqual([]);
  });

  it("forgets every chat's repository while Git is off and reads each again when it is back", async () => {
    let path = "noldova-com/teamrun";
    context.answerModule(statusMethod, () => statusOf(new GitRemote("origin", "github.com", path, RemoteTransport.Https)));
    const home = source().homeOf("/work/teamrun");
    await Wait.until(() => expect(home()).toBe("noldova-com/teamrun"));

    context.changeDependency("git", false);
    const off = home();
    path = "noldova-com/teamrun-next";
    context.changeDependency("git", true);

    await Wait.until(() => expect(home()).toBe("noldova-com/teamrun-next"));
    expect([off, statusReads().length]).toEqual([null, 2]);
  });

  it("keeps a chat's repository unknown when Git goes off while its folder's read is unanswered, and a later read still lands", async () => {
    const answers: DeferredResponse[] = [];
    context.answerModule(statusMethod, () => {
      const answer = new DeferredResponse();
      answers.push(answer);
      return answer.promise;
    });
    const home = source().homeOf("/work/teamrun");
    context.changeDependency("git", false);
    const later = source().homeOf("/work/later");

    answers[0]?.resolve(statusOf(gitHubRemote));
    answers[1]?.resolve(statusOf(new GitRemote("origin", "github.com", "octocat/hello-world", RemoteTransport.Https)));

    await Wait.until(() => expect(later()).toBe("octocat/hello-world"));
    expect(home()).toBeNull();
  });

  it("keeps the newer read's repository when Git goes off and on while the folder's first read is unanswered, and that read answers first", async () => {
    const answers: DeferredResponse[] = [];
    context.answerModule(statusMethod, () => {
      const answer = new DeferredResponse();
      answers.push(answer);
      return answer.promise;
    });
    const home = source().homeOf("/work/teamrun");
    context.changeDependency("git", false);
    context.changeDependency("git", true);

    answers[0]?.resolve(statusOf(new GitRemote("origin", "github.com", "octocat/old", RemoteTransport.Https)));
    answers[1]?.resolve(statusOf(gitHubRemote));

    await Wait.until(() => expect(home()).toBe("noldova-com/teamrun"));
    expect(statusReads()).toEqual([{ folder: "/work/teamrun" }, { folder: "/work/teamrun" }]);
  });

  it("reads a chat's folder again when the chat opens again, once its earlier read has answered, so a remote added since links a bare #N", async () => {
    const answers: DeferredResponse[] = [];
    context.answerModule(statusMethod, () => {
      const answer = new DeferredResponse();
      answers.push(answer);
      return answer.promise;
    });
    source().readHomeAgain(null);
    source().readHomeAgain("/work/teamrun");
    const home = source().homeOf("/work/teamrun");
    source().readHomeAgain("/work/teamrun");
    const other = source().homeOf("/work/other");
    answers[0]?.resolve(statusOf(null));
    answers[1]?.resolve(statusOf(new GitRemote("origin", "github.com", "octocat/hello-world", RemoteTransport.Https)));
    await Wait.until(() => expect(other()).toBe("octocat/hello-world"));
    const before = home();

    source().readHomeAgain("/work/teamrun");
    answers[2]?.resolve(statusOf(gitHubRemote));

    await Wait.until(() => expect(home()).toBe("noldova-com/teamrun"));
    expect([before, statusReads()]).toEqual([null, [{ folder: "/work/teamrun" }, { folder: "/work/other" }, { folder: "/work/teamrun" }]]);
  });

  it("reads every remembered item again when the person signs in, keeping a shown item while it reads and showing a plain one as read", async () => {
    const plain = find(urlOf(1));
    const filled = find(urlOf(2));
    await Wait.until(() => expect(reads()).toEqual([1, 2]));
    held.get(1)?.resolve(null);
    held.get(2)?.resolve(itemOf(2));
    await Wait.until(() => expect([shown(plain), shown(filled)]).toEqual([null, ["octocat/hello-world#2", "Open", "Fix the greeting"]]));

    context.emitModule(signInEvent, signedIn);

    expect([shown(plain), shown(filled)]).toEqual([["octocat/hello-world#1", null, null], ["octocat/hello-world#2", "Open", "Fix the greeting"]]);
    await Wait.until(() => expect(reads()).toEqual([1, 2, 1, 2]));
    held.get(1)?.resolve(itemOf(1, "Add a README"));
    held.get(2)?.resolve(itemOf(2, "Fix the greeting again"));
    await Wait.until(() => expect([shown(plain), shown(filled)]).toEqual([["octocat/hello-world#1", "Open", "Add a README"],
      ["octocat/hello-world#2", "Open", "Fix the greeting again"]]));
  });

  it("turns every chip into a plain link when the person signs out, and drops the reads under way, answered or failed, without a log", async () => {
    const items = [1, 2, 3, 4].map(t => find(urlOf(t)));
    const waitingRead = find(urlOf(5));
    await Wait.until(() => expect(reads()).toEqual([1, 2, 3, 4]));

    context.emitModule(signInEvent, signedOut);

    expect([...items, waitingRead].map(t => t())).toEqual([null, null, null, null, null]);
    const later = [6, 7].map(t => find(urlOf(t)));
    held.get(1)?.resolve(itemOf(1));
    held.get(2)?.reject(new Error("GitHub answered 401."));
    expect([later.map(t => t()), reads()]).toEqual([[null, null], [1, 2, 3, 4]]);

    context.emitModule(signInEvent, signedIn);

    await Wait.until(() => expect(reads()).toEqual([1, 2, 3, 4, 1, 2]));
    expect(context.lines).toEqual([]);
  });

  it("changes nothing while a sign-in waits for its code", async () => {
    const item = find(urlOf(1));
    await Wait.until(() => expect(reads()).toEqual([1]));
    held.get(1)?.resolve(itemOf(1));
    await Wait.until(() => expect(shown(item)).toEqual(["octocat/hello-world#1", "Open", "Fix the greeting"]));

    context.emitModule(signInEvent, waiting);

    expect([shown(item), reads()]).toEqual([["octocat/hello-world#1", "Open", "Fix the greeting"], [1]]);
  });

  it("turns every chip plain when the GitHub module stops, reads them again when it starts, and ignores other modules", async () => {
    const item = find(urlOf(1));
    await Wait.until(() => expect(reads()).toEqual([1]));
    held.get(1)?.resolve(itemOf(1));
    await Wait.until(() => expect(shown(item)?.[1]).toBe("Open"));

    context.changeDependency("computer-use", false);
    const kept = shown(item);
    context.changeDependency("git-github", false);
    const stopped = item();
    context.changeDependency("git-github", true);

    expect([kept, stopped]).toEqual([["octocat/hello-world#1", "Open", "Fix the greeting"], null]);
    await Wait.until(() => expect([shown(item), reads(), context.methods.filter(t => t === signInMethod)]).toEqual([["octocat/hello-world#1", null, null], [1, 1],
      [signInMethod, signInMethod]]));
    held.get(1)?.resolve(itemOf(1));
    await Wait.until(() => expect(shown(item)?.[1]).toBe("Open"));
  });

  it("reads the sign-in when it starts, and while no one is signed in shows every GitHub link plain and asks GitHub nothing about it", async () => {
    GitHubReferenceSource.release(context);
    const signIn = new DeferredResponse();
    context = new FakeWindowPartContext().answerModule(readMethod, () => itemOf(1)).answerModule(signInMethod, () => signIn.promise);
    GitHubReferenceSource.register(context);
    const before = find(urlOf(1));

    signIn.resolve(signedOut);
    await signIn.promise;
    const after = find(urlOf(2));

    expect([before(), after(), context.methods]).toEqual([null, null, [signInMethod]]);
    context.emitModule(signInEvent, signedIn);
    await Wait.until(() => expect([shown(before)?.[1], shown(after)?.[1]]).toEqual(["Open", "Open"]));
  });

  it("treats a failed or unreadable sign-in as signed out, and reads items once GitHub's module starts again and says someone is signed in", async () => {
    for (const failed of [(): Promise<JsonValue> => Promise.reject(new Error("The GitHub module isn't running.")), (): JsonValue => ({ state: 7 })]) {
      GitHubReferenceSource.release(context);
      const answers = [failed, (): JsonValue => signedIn];
      context = new FakeWindowPartContext().answerModule(readMethod, () => itemOf(1)).answerModule(signInMethod, () => (answers.shift() ?? failed)());
      GitHubReferenceSource.register(context);
      const item = find(urlOf(1));

      context.changeDependency("git-github", true);

      expect([item(), reads()]).toEqual([null, []]);
      await Wait.until(() => expect(shown(item)?.[1]).toBe("Open"));
      expect([context.methods.filter(t => t === signInMethod).length, reads(), context.lines]).toEqual([2, [1], []]);
    }
  });

  it("reads at most four items at a time and starts the next as each read ends", async () => {
    const items = [1, 2, 3, 4, 5, 6].map(t => find(urlOf(t)));

    await Wait.until(() => expect(reads()).toEqual([1, 2, 3, 4]));
    expect(items.map(t => shown(t)?.[0])).toEqual([1, 2, 3, 4, 5, 6].map(t => `octocat/hello-world#${t}`));
    held.get(2)?.resolve(null);
    await Wait.until(() => expect(reads()).toEqual([1, 2, 3, 4, 5]));
    held.get(1)?.resolve(itemOf(1));
    await Wait.until(() => expect(reads()).toEqual([1, 2, 3, 4, 5, 6]));
  });

  it("remembers the 500 items named last, so an item named again stays, and the one named longest ago is read again", async () => {
    context.answerModule(readMethod, () => null);
    const first = find(urlOf(1));
    for (let number = 2; number <= 500; number++)
      find(urlOf(number));
    await Wait.until(() => expect(reads()).toHaveLength(500));

    const kept = find(urlOf(1));
    find(urlOf(501));
    await Wait.until(() => expect(reads()).toHaveLength(501));
    const keptAgain = find(urlOf(1));
    find(urlOf(2));

    await Wait.until(() => expect(reads()).toHaveLength(502));
    expect([kept === first, keptAgain === first, reads().at(-1)]).toEqual([true, true, 2]);
  });

  it("stops following GitHub and turns its chips plain when released, and has no source for a context it doesn't know", async () => {
    const item = find(urlOf(1));
    await Wait.until(() => expect(reads()).toEqual([1]));
    expect([context.events, context.dependencyListeners.size]).toEqual([[signInEvent], 1]);

    GitHubReferenceSource.release(context);

    expect([item(), context.events, context.dependencyListeners.size, GitHubReferenceSource.of(context)]).toEqual([null, [], 0, null]);
    expect(GitHubReferenceSource.of(new FakeWindowPartContext())).toBeNull();
  });
});
