/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { JsonValue } from "@noldova/context.json";
import { BranchPullRequest, BranchQuery, CheckState, DeviceCode, HostAccount, HostChanges, HostCheck, HostItem, HostPerson, HostReference, HostSignIn,
  ReferenceKind, ReferenceState } from "@noldova/git.hosting.protocol";
import { FileState, GitFolderParams, GitRemote, GitStatus, RemoteTransport, StatusEntry } from "@noldova/git.protocol";
import { EventName, Message, MessageAuthor, MessageStatus, Page, TeammateDocument, TeammateWork } from "@noldova/teamrun.protocol";

import { OrganizationCardField } from "../../../src/app/enums/organization-card-field";
import { TeammateSourceState } from "../../../src/app/enums/teammate-source-state";
import { EngineResync } from "../../../src/app/services/engine-resync";
import { TeammateWorkReader } from "../../../src/app/services/teammate-work.reader";
import { DeferredResponse } from "../../fixtures/deferred-response.fixture";
import { FakeWindowPartContext } from "../../fixtures/fake-window-part-context.fixture";
import { SampleData } from "../../fixtures/sample-data.fixture";
import { SamplePages } from "../../fixtures/sample-pages.fixture";
import { Wait } from "../../fixtures/wait.fixture";

describe("TeammateWorkReader", () => {
  const workMethod = "teamrun.teammateWorkRead";
  const editedMethod = "teamrun.pageEditedList";
  const statusMethod = "git.status";
  const watchMethod = "git.watch";
  const unwatchMethod = "git.unwatch";
  const pullRequestMethod = "git-github.readBranchPullRequest";
  const signInMethod = "git-github.readSignIn";
  const signInEvent = "git-github.signInChanged";
  const head = "a".repeat(40);
  const otherHead = "b".repeat(40);
  const app = "/work/app";
  const site = "/work/site";
  const copy = "/work/app-copy";
  const local = "/work/local";
  const gitHub = (path: string): GitRemote => new GitRemote("origin", "github.com", path, RemoteTransport.Https);
  const entry = (path: string): StatusEntry =>
    new StatusEntry(path, undefined, null, undefined, FileState.Modified, FileState.Unmodified, null, null, null, null);
  const statusOf = (branch: string | null, remote: GitRemote | null, commit: string | null = head, entries: readonly StatusEntry[] = []): JsonValue =>
    new GitStatus(branch, commit, null, entries, false, `f-${branch}-${commit}`, null, remote).toJson();
  const pullRequestOf = (number: number, state: ReferenceState = ReferenceState.Open): HostItem =>
    new HostItem(new HostReference("git-github", "noldova-com", "app", number), ReferenceKind.PullRequest, state, `Change ${number}`,
      `https://github.com/noldova-com/app/pull/${number}`, new HostPerson("dev", null, null), Date.parse("2026-11-20T09:00:00.000Z"),
      state === ReferenceState.Merged ? Date.parse("2026-11-20T10:00:00.000Z") : null, 0, new HostChanges(1, 0, 1, "feature", "main", head));
  const answerOf = (item: HostItem | null, checks: readonly HostCheck[] = []): JsonValue => new BranchPullRequest(item, checks).toJson();
  const workOf = (folder: string | null, folders: readonly string[] = Object.isNull(folder) ? [] : [folder],
    documents: readonly TeammateDocument[] = []): JsonValue => new TeammateWork("t1", folder, folders, documents).toJson();
  const missing = TeammateSourceState.ModuleMissing;
  const signedIn = HostSignIn.signedIn(new HostAccount("dev", null, null, ["repo"])).toJson();
  const replyOf = (teammateId: string, ended: boolean): JsonValue =>
    new Message("m2", "c1", 1, MessageAuthor.Provider, "m1", ended ? MessageStatus.Completed : MessageStatus.Running, [], SampleData.provenance,
      SampleData.timestamp, SampleData.timestamp, ended ? SampleData.timestamp : null, [], teammateId, "Opus").toJson();
  const count = (method: string): number => context.requests.filter(t => t.method === method).length;
  const foldersOf = (method: string): readonly string[] =>
    context.requests.filter(t => t.method === method).map(t => GitFolderParams.fromJson(t.parameters).folder);
  const titles = (pages: readonly Page[]): readonly string[] => pages.map(t => t.title);
  let context: FakeWindowPartContext;
  let reader: TeammateWorkReader | null;
  let statuses: Map<string, JsonValue>;
  let answers: Map<string, JsonValue>;

  const start = (fields: ReadonlySet<OrganizationCardField> = new Set(Object.values(OrganizationCardField))): TeammateWorkReader => {
    reader = new TeammateWorkReader(context, "t1", fields);
    reader.start();
    return reader;
  };
  const shownPullRequests = (work: TeammateWorkReader): readonly (string | null)[][] =>
    work.pullRequests().items.map(t => [t.folder, t.pullRequest.title, t.checksState]);

  beforeEach(() => {
    reader = null;
    statuses = new Map([[app, statusOf("feature", gitHub("noldova-com/app"), head, [entry("a.ts"), entry("b.ts")])]]);
    const checks = [new HostCheck("build", CheckState.Succeeded, null), new HostCheck("lint", CheckState.Running, null)];
    answers = new Map([["feature", answerOf(pullRequestOf(7), checks)]]);
    context = new FakeWindowPartContext()
      .answerModule(workMethod, () => workOf(app))
      .answerModule(editedMethod, () => [SamplePages.page("p1", "Plan").toJson(), SamplePages.canvas("p2", "Board").toJson()])
      .answerModule(statusMethod, t => {
        const status = statuses.get(GitFolderParams.fromJson(t).folder);
        if (Object.isUndefined(status))
          throw new Error("not a git repository");
        return status;
      })
      .answerModule(watchMethod, () => null)
      .answerModule(unwatchMethod, () => null)
      .answerModule(signInMethod, () => signedIn)
      .answerModule(pullRequestMethod, t => answers.get(BranchQuery.fromJson(t).branch) ?? answerOf(null));
    context.changeDependency("git", true);
    context.changeDependency("git-github", true);
  });

  afterEach(() => {
    reader?.stop();
    vi.restoreAllMocks();
  });

  it("names every state a source of the teammate's work can be in", () => {
    expect(Object.values(TeammateSourceState)).toEqual(["Reading", "Shown", "NoFolder", "ModuleMissing", "SignedOut", "Failed"]);
  });

  it("reads the teammate's work and artifacts, watches its folder and shows its branch with its changes and its open pull request with CI state", async () => {
    const work = start();

    await Wait.until(() => expect(shownPullRequests(work)).toEqual([[app, "Change 7", CheckState.Running]]));
    expect(context.requests.find(t => t.method === workMethod)?.parameters).toEqual({ teammateId: "t1" });
    expect(context.requests.find(t => t.method === editedMethod)?.parameters).toEqual({ teammateId: "t1" });
    expect(titles(work.artifacts())).toEqual(["Plan", "Board"]);
    expect([work.git().state, work.git().folder, work.git().status?.branch, work.git().changes]).toEqual([TeammateSourceState.Shown, app, "feature", 2]);
    expect(work.pullRequests().state).toBe(TeammateSourceState.Shown);
    expect(foldersOf(watchMethod)).toEqual([app]);
    expect(context.requests.find(t => t.method === pullRequestMethod)?.parameters)
      .toEqual(new BranchQuery("github.com", "noldova-com/app", "feature", head).toJson());
    expect([work.workFailure(), work.artifactsFailure()]).toEqual([null, null]);
  });

  it("lists open and draft pull requests once each, leaving out merged ones, other hosts, detached heads and folders git can't read", async () => {
    statuses = new Map([
      [app, statusOf("feature", gitHub("noldova-com/app"))],
      [copy, statusOf("feature", gitHub("noldova-com/app"))],
      [site, statusOf("draft", gitHub("noldova-com/app"))],
      ["/work/merged", statusOf("merged", gitHub("noldova-com/app"))],
      ["/work/none", statusOf("none", gitHub("noldova-com/app"))],
      ["/work/gitlab", statusOf("feature", new GitRemote("origin", "gitlab.com", "noldova-com/app", RemoteTransport.Https))],
      ["/work/detached", statusOf(null, gitHub("noldova-com/app"))],
      [local, statusOf("main", null, null)]
    ]);
    answers = new Map([["feature", answerOf(pullRequestOf(7))], ["draft", answerOf(pullRequestOf(8, ReferenceState.Draft))],
      ["merged", answerOf(pullRequestOf(9, ReferenceState.Merged))]]);
    context.answerModule(workMethod, () => workOf(app, [app, copy, site, "/work/merged", "/work/none", "/work/gitlab", "/work/detached", local, "/work/gone"]));

    const work = start();

    await Wait.until(() => expect(shownPullRequests(work)).toEqual([[app, "Change 7", null], [site, "Change 8", null]]));
    expect(context.requests.filter(t => t.method === pullRequestMethod).map(t => BranchQuery.fromJson(t.parameters).branch))
      .toEqual(["feature", "feature", "draft", "merged", "none"]);
    expect(context.lines).toEqual(["The teammate's pull requests leave out /work/gone, whose Git state couldn't be read: not a git repository"]);
  });

  it("says Git isn't there when its module isn't, and asks it nothing", async () => {
    context.changeDependency("git", false);

    const work = start();

    await Wait.until(() => expect([work.git().state, work.pullRequests().state]).toEqual([TeammateSourceState.ModuleMissing, missing]));
    expect(work.git().folder).toBe(app);
    expect([count(statusMethod), count(watchMethod), count(signInMethod), count(pullRequestMethod)]).toEqual([0, 0, 0, 0]);
  });

  it("shows Git without pull requests when the GitHub module isn't there, and reads them once it comes", async () => {
    context.changeDependency("git-github", false);
    const work = start();
    await Wait.until(() => expect([work.git().state, work.pullRequests().state]).toEqual([TeammateSourceState.Shown, TeammateSourceState.ModuleMissing]));
    expect(count(pullRequestMethod)).toBe(0);

    context.changeDependency("git-github", true);

    await Wait.until(() => expect(shownPullRequests(work)).toEqual([[app, "Change 7", CheckState.Running]]));
    expect(count(watchMethod)).toBe(1);
  });

  it("asks for a sign-in when no one is signed in to GitHub, and reads the pull requests once someone is, ignoring a sign-in still waiting", async () => {
    context.answerModule(signInMethod, () => HostSignIn.signedOut().toJson());
    const work = start();
    await Wait.until(() => expect(work.pullRequests().state).toBe(TeammateSourceState.SignedOut));
    expect(count(pullRequestMethod)).toBe(0);

    const code = new DeviceCode("WDJB-MJHT", "https://github.com/login/device", Date.parse("2026-11-20T10:00:00.000Z"));
    context.emitModule(signInEvent, HostSignIn.waiting(code).toJson());
    expect(work.pullRequests().state).toBe(TeammateSourceState.SignedOut);
    context.emitModule(signInEvent, signedIn);

    await Wait.until(() => expect(shownPullRequests(work)).toEqual([[app, "Change 7", CheckState.Running]]));
    expect(count(signInMethod)).toBe(1);
  });

  it("says the teammate has no folder yet, and watches none", async () => {
    context.answerModule(workMethod, () => workOf(null));

    const work = start();

    await Wait.until(() => expect([work.git().state, work.pullRequests().state]).toEqual([TeammateSourceState.NoFolder, TeammateSourceState.Shown]));
    expect([work.pullRequests().items, work.git().changes]).toEqual([[], 0]);
    expect([count(statusMethod), count(watchMethod)]).toEqual([0, 0]);
  });

  it("says why Git or GitHub failed, and logs a watch git refuses while it still shows the branch", async () => {
    statuses = new Map();
    context.answerModule(watchMethod, () => {
      throw new Error("too many watches");
    }).answerModule(pullRequestMethod, () => Promise.reject("GitHub answered 502"));
    context.answerModule(workMethod, () => workOf(app, [app, site]));
    statuses.set(site, statusOf("feature", gitHub("noldova-com/app")));

    const work = start();

    await Wait.until(() => expect([work.git().state, work.git().failure, work.pullRequests().state, work.pullRequests().failure])
      .toEqual([TeammateSourceState.Failed, "not a git repository", TeammateSourceState.Failed, "GitHub answered 502"]));
    expect(context.lines).toContain("The teammate's Git state doesn't follow changes in /work/app: too many watches");
  });

  it("says why its work or its artifacts couldn't be read, lists no artifact from an answer that isn't a list, and clears each once it reads", async () => {
    context.answerModule(workMethod, () => {
      throw new Error("The database is locked.");
    }).answerModule(editedMethod, () => Promise.reject("The pages store is closed."));
    const work = start();
    await Wait.until(() => expect([work.workFailure(), work.artifactsFailure()]).toEqual(["The database is locked.", "The pages store is closed."]));
    expect([work.work(), work.artifacts()]).toEqual([null, []]);

    context.answerModule(workMethod, () => workOf(app)).answerModule(editedMethod, () => ({}));
    context.emit(EventName.StateResyncRequested, null);

    await Wait.until(() => expect([work.workFailure(), work.artifactsFailure()]).toEqual([null, null]));
    expect([work.work()?.folder, work.artifacts()]).toEqual([app, []]);
  });

  it("reads its work again when the window reconnects to a restarted runtime", async () => {
    const work = start();
    await Wait.until(() => expect(work.work()?.folder).toBe(app));
    context.answerModule(workMethod, () => workOf(site));

    EngineResync.request(context);

    await Wait.until(() => expect(work.work()?.folder).toBe(site));
  });

  it("reads its work again when one of its replies ends, and not for another teammate's or one still running", async () => {
    const work = start();
    await Wait.until(() => expect(work.pullRequests().state).toBe(TeammateSourceState.Shown));
    context.answerModule(workMethod, () => workOf(site, [site, app], [new TeammateDocument("/work/site/README.md", "c1", SampleData.timestamp)]));
    statuses.set(site, statusOf("main", null));

    context.emit(EventName.MessageUpdated, replyOf("t2", true));
    context.emit(EventName.MessageUpdated, replyOf("t1", false));
    expect(count(workMethod)).toBe(1);
    context.emit(EventName.MessageUpdated, replyOf("t1", true));

    await Wait.until(() => expect(work.git().folder).toBe(site));
    expect(work.work()?.documents.map(t => t.path)).toEqual(["/work/site/README.md"]);
    expect([foldersOf(watchMethod), foldersOf(unwatchMethod)]).toEqual([[app, site], [app]]);
    await Wait.until(() => expect(shownPullRequests(work)).toEqual([[app, "Change 7", CheckState.Running]]));
  });

  it("reads the branch again when git says its folder changed, and the pull requests only when its branch or head moved", async () => {
    const work = start();
    await Wait.until(() => expect(work.pullRequests().state).toBe(TeammateSourceState.Shown));
    const reads = (): readonly number[] => [count(statusMethod), count(pullRequestMethod)];
    expect(reads()).toEqual([2, 1]);

    context.emitModule("git.changed", { folder: site });
    statuses.set(app, statusOf("feature", gitHub("noldova-com/app"), head, [entry("a.ts")]));
    context.emitModule("git.changed", { folder: app });
    await Wait.until(() => expect(work.git().changes).toBe(1));
    expect(reads()).toEqual([3, 1]);

    statuses.set(app, statusOf("feature", gitHub("noldova-com/app"), otherHead));
    context.emitModule("git.changed", { folder: app });
    await Wait.until(() => expect(reads()).toEqual([5, 2]));

    statuses.set(app, statusOf("other", gitHub("noldova-com/app"), otherHead));
    context.emitModule("git.changed", { folder: app });
    await Wait.until(() => expect(work.pullRequests().items).toEqual([]));
    expect(reads()).toEqual([7, 3]);
  });

  it.each([EventName.ConversationRewound, EventName.ConversationDeleted, EventName.ProjectFolderChanged])(
    "reads its work and its artifacts again on %s, as its folders or documents may have changed", async name => {
      const work = start();
      await Wait.until(() => expect(work.pullRequests().state).toBe(TeammateSourceState.Shown));
      context.answerModule(workMethod, () => workOf(site, [site], [new TeammateDocument("/work/site/README.md", "c1", SampleData.timestamp)]));
      context.answerModule(editedMethod, () => [SamplePages.page("p3", "Notes").toJson()]);
      statuses.set(site, statusOf("main", null));

      context.emit(name, null);

      await Wait.until(() => expect([work.git().folder, work.git().status?.branch, titles(work.artifacts())]).toEqual([site, "main", ["Notes"]]));
      expect(work.work()?.documents.map(t => t.path)).toEqual(["/work/site/README.md"]);
      await Wait.until(() => expect(work.pullRequests().items).toEqual([]));
    });

  it("reads only the sources whose fields are on", async () => {
    const documents = start(new Set([OrganizationCardField.Documents, OrganizationCardField.Status]));
    await Wait.until(() => expect(documents.work()?.folder).toBe(app));
    const artifacts = new TeammateWorkReader(context, "t1", new Set([OrganizationCardField.Artifacts]));
    artifacts.start();
    await Wait.until(() => expect(titles(artifacts.artifacts())).toEqual(["Plan", "Board"]));
    artifacts.stop();

    expect([workMethod, editedMethod, statusMethod, watchMethod, signInMethod, pullRequestMethod].map(count)).toEqual([1, 1, 0, 0, 0, 0]);
    expect([documents.git().state, documents.pullRequests().state, documents.artifacts()]).toEqual([TeammateSourceState.Reading, TeammateSourceState.Reading, []]);
  });

  it("asks GitHub about the newest ten of its folders", async () => {
    const folders = [app, ...Array.from({ length: 11 }, (_, index) => `/work/f${index + 2}`)];
    context.answerModule(workMethod, () => workOf(app, folders));
    for (const folder of folders.slice(1))
      statuses.set(folder, statusOf(null, null));

    const work = start();

    await Wait.until(() => expect(work.pullRequests().state).toBe(TeammateSourceState.Shown));
    expect([...new Set(foldersOf(statusMethod))].sort()).toEqual(folders.slice(0, 10).sort());
  });

  it("moves its watch from one folder to the next in turn, so a quick second move leaves no folder watched", async () => {
    const work = start();
    await Wait.until(() => expect(work.pullRequests().state).toBe(TeammateSourceState.Shown));
    const held = new DeferredResponse();
    context.answerModule(unwatchMethod, () => held.promise);
    statuses.set(site, statusOf("main", null));
    statuses.set(copy, statusOf("main", null));
    context.answerModule(workMethod, () => workOf(site));
    context.emit(EventName.MessageUpdated, replyOf("t1", true));
    await Wait.until(() => expect(foldersOf(unwatchMethod)).toEqual([app]));
    context.answerModule(workMethod, () => workOf(copy));
    context.emit(EventName.MessageUpdated, replyOf("t1", true));
    await Wait.until(() => expect(count(workMethod)).toBe(3));

    context.answerModule(unwatchMethod, () => null);
    held.resolve(null);

    await Wait.until(() => expect(work.git().folder).toBe(copy));
    expect(context.requests.filter(t => t.method === watchMethod || t.method === unwatchMethod).map(t => `${t.method} ${GitFolderParams.fromJson(t.parameters).folder}`))
      .toEqual([`${watchMethod} ${app}`, `${unwatchMethod} ${app}`, `${watchMethod} ${site}`, `${unwatchMethod} ${site}`, `${watchMethod} ${copy}`]);
  });

  it("reads its artifacts again when a page is shown or changes", async () => {
    const work = start();
    await Wait.until(() => expect(titles(work.artifacts())).toEqual(["Plan", "Board"]));
    context.answerModule(editedMethod, () => [SamplePages.page("p3", "Notes").toJson()]);

    context.emitModule(SamplePages.updated, SamplePages.page("p3", "Notes").toJson());
    await Wait.until(() => expect(titles(work.artifacts())).toEqual(["Notes"]));
    context.answerModule(editedMethod, () => []);
    context.emitModule(SamplePages.shown, SamplePages.page("p3", "Notes").toJson());

    await Wait.until(() => expect(work.artifacts()).toEqual([]));
  });

  it("follows Git leaving and coming back, and ignores other modules", async () => {
    const work = start();
    await Wait.until(() => expect(work.pullRequests().state).toBe(TeammateSourceState.Shown));

    context.changeDependency("browser", true);
    context.changeDependency("git", false);
    await Wait.until(() => expect([work.git().state, work.pullRequests().state]).toEqual([TeammateSourceState.ModuleMissing, missing]));
    context.changeDependency("git", true);

    await Wait.until(() => expect(shownPullRequests(work)).toEqual([[app, "Change 7", CheckState.Running]]));
    expect([work.git().state, foldersOf(watchMethod), count(unwatchMethod), count(signInMethod)]).toEqual([TeammateSourceState.Shown, [app, app], 0, 2]);
  });

  it("reads pull requests for no folder when the sign-in comes before its work", async () => {
    const held = new DeferredResponse();
    context.answerModule(workMethod, () => held.promise);
    const work = start();

    context.emitModule(signInEvent, signedIn);

    await Wait.until(() => expect(work.pullRequests().state).toBe(TeammateSourceState.Shown));
    expect([work.pullRequests().items, count(signInMethod)]).toEqual([[], 0]);
    held.resolve(workOf(app));
    await Wait.until(() => expect(work.pullRequests().items).toHaveLength(1));
  });

  it("stops listening and unwatches its folder when stopped, and drops answers that come after", async () => {
    const work = start();
    await Wait.until(() => expect(work.pullRequests().state).toBe(TeammateSourceState.Shown));
    const parsed = [vi.spyOn(TeammateWork, "fromJson"), vi.spyOn(Page, "fromJson"), vi.spyOn(GitStatus, "fromJson"), vi.spyOn(BranchPullRequest, "fromJson")];
    const heldWork = new DeferredResponse();
    const heldPages = new DeferredResponse();
    const heldStatus = new DeferredResponse();
    const heldPullRequest = new DeferredResponse();
    context.answerModule(workMethod, () => heldWork.promise).answerModule(editedMethod, () => heldPages.promise)
      .answerModule(statusMethod, () => heldStatus.promise).answerModule(pullRequestMethod, () => heldPullRequest.promise);
    context.emit(EventName.StateResyncRequested, null);
    context.emitModule("git.changed", { folder: app });
    context.emitModule(signInEvent, signedIn);
    await Wait.until(() => expect(count(statusMethod)).toBe(4));

    work.stop();
    reader = null;
    heldWork.resolve(workOf(site));
    heldPages.resolve([SamplePages.page("p3", "Notes").toJson()]);
    heldStatus.resolve(statusOf("other", gitHub("noldova-com/app"), otherHead));
    heldPullRequest.resolve(answerOf(pullRequestOf(9)));

    await Wait.until(() => expect(parsed.map(t => t.mock.calls.length)).toEqual([1, 1, 2, 1]));
    expect(foldersOf(unwatchMethod)).toEqual([app]);
    expect([work.work()?.folder, titles(work.artifacts()), work.git().status?.branch, shownPullRequests(work)])
      .toEqual([app, ["Plan", "Board"], "feature", [[app, "Change 7", CheckState.Running]]]);
    context.emit(EventName.StateResyncRequested, null);
    context.emitModule("git.changed", { folder: app });
    expect([count(workMethod), count(statusMethod)]).toEqual([2, 4]);
  });

  it("drops failures that come after it stopped", async () => {
    let reads = 0;
    const late = Object.defineProperty(new Error(), "message", {
      get: () => {
        reads++;
        return "late";
      }
    });
    const heldWork = new DeferredResponse();
    const heldPages = new DeferredResponse();
    context.answerModule(workMethod, () => heldWork.promise).answerModule(editedMethod, () => heldPages.promise);
    const work = start();
    await Wait.until(() => expect(count(editedMethod)).toBe(1));

    work.stop();
    reader = null;
    heldWork.reject(late);
    heldPages.reject(late);

    await Wait.until(() => expect(reads).toBe(2));
    expect([work.workFailure(), work.artifactsFailure(), work.work(), work.git().state, count(unwatchMethod)])
      .toEqual([null, null, null, TeammateSourceState.Reading, 0]);
  });
});
