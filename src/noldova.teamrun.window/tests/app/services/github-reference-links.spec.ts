/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ReferenceKind } from "@noldova/git.hosting.protocol";
import { GitRemote, RemoteTransport } from "@noldova/git.protocol";

import { GitHubReferenceLinks } from "../../../src/app/services/github-reference-links";

describe("GitHubReferenceLinks", () => {
  const read = (url: string): readonly (string | number)[] | null => {
    const link = GitHubReferenceLinks.of(url);
    return link === null ? null : [link.reference.host, link.reference.owner, link.reference.repository, link.reference.number, link.kind, link.reference.text, link.key];
  };

  it("reads an issue's and a pull request's address, with a trailing slash, a query or a fragment, and the host in any case", () => {
    expect([
      read("https://github.com/octocat/hello-world/issues/1"),
      read("https://github.com/octocat/hello-world/pull/42"),
      read("https://github.com/octocat/hello-world/pull/42/"),
      read("https://github.com/octocat/hello-world/issues/7?tab=comments"),
      read("https://github.com/octocat/hello-world/issues/7#issuecomment-1"),
      read("HTTPS://GitHub.COM/Octocat/Hello.World_2/pull/9999999999")
    ]).toEqual([
      ["git-github", "octocat", "hello-world", 1, ReferenceKind.Issue, "octocat/hello-world#1", "octocat/hello-world#1"],
      ["git-github", "octocat", "hello-world", 42, ReferenceKind.PullRequest, "octocat/hello-world#42", "octocat/hello-world#42"],
      ["git-github", "octocat", "hello-world", 42, ReferenceKind.PullRequest, "octocat/hello-world#42", "octocat/hello-world#42"],
      ["git-github", "octocat", "hello-world", 7, ReferenceKind.Issue, "octocat/hello-world#7", "octocat/hello-world#7"],
      ["git-github", "octocat", "hello-world", 7, ReferenceKind.Issue, "octocat/hello-world#7", "octocat/hello-world#7"],
      ["git-github", "Octocat", "Hello.World_2", 9999999999, ReferenceKind.PullRequest, "Octocat/Hello.World_2#9999999999", "octocat/hello.world_2#9999999999"]
    ]);
  });

  it("leaves every other address on github.com a plain link: a repository, a run, a pull request's files, a short path, and a number out of range", () => {
    expect([
      "https://github.com/",
      "https://github.com/octocat",
      "https://github.com/octocat/hello-world",
      "https://github.com/octocat/hello-world/issues",
      "https://github.com/octocat/hello-world/issues/",
      "https://github.com/octocat/hello-world/actions/runs/1",
      "https://github.com/octocat/hello-world/pull/42/files",
      "https://github.com/octocat/hello-world/pull/42//",
      "https://github.com/octocat/hello-world/issues/0",
      "https://github.com/octocat/hello-world/issues/012",
      "https://github.com/octocat/hello-world/issues/12345678901",
      "https://github.com/octocat/hello-world/issues/1e3",
      "https://github.com//hello-world/issues/1"
    ].map(read)).toEqual(new Array(13).fill(null));
  });

  it("leaves another scheme, host, port or user info a plain link, and an owner or repository GitHub doesn't allow", () => {
    expect([
      "http://github.com/octocat/hello-world/issues/1",
      "https://gitlab.com/octocat/hello-world/issues/1",
      "https://github.com.example/octocat/hello-world/issues/1",
      "https://www.github.com/octocat/hello-world/issues/1",
      "https://github.com:8443/octocat/hello-world/issues/1",
      "https://monalisa@github.com/octocat/hello-world/issues/1",
      "https://:secret@github.com/octocat/hello-world/issues/1",
      "github.com/octocat/hello-world/issues/1",
      "https://github.com/-octocat/hello-world/issues/1",
      "https://github.com/octo_cat/hello-world/issues/1",
      `https://github.com/${"a".repeat(40)}/hello-world/issues/1`,
      "https://github.com/octocat/../issues/1",
      "https://github.com/octocat/%2E%2E/issues/1",
      "https://github.com/octocat/hello%20world/issues/1",
      `https://github.com/octocat/${"r".repeat(101)}/issues/1`
    ].map(read)).toEqual(new Array(15).fill(null));
  });

  describe("in a reply's text", () => {
    const home = "noldova-com/teamrun";
    const found = (text: string, repository: string | null = null): readonly string[][] =>
      GitHubReferenceLinks.inText(text, repository).map(t => [text.slice(t.start, t.start + t.length), t.url]);

    it("finds owner/repo#N anywhere in the text, as a link to the item that GitHub sends on to a pull request when it is one", () => {
      expect(found("See octocat/hello-world#1, and octo-cat/Hello.World_2#42.")).toEqual([
        ["octocat/hello-world#1", "https://github.com/octocat/hello-world/issues/1"],
        ["octo-cat/Hello.World_2#42", "https://github.com/octo-cat/Hello.World_2/issues/42"]
      ]);
      expect(found("(octocat/hello-world#1761)\nnoldova-com/git#9")).toEqual([
        ["octocat/hello-world#1761", "https://github.com/octocat/hello-world/issues/1761"],
        ["noldova-com/git#9", "https://github.com/noldova-com/git/issues/9"]
      ]);
    });

    it("finds #N only when the chat's repository is known, as that repository's item, and keeps owner/repo#N beside it", () => {
      expect([found("Fixed in #12 and (#7)."), found("Fixed in #12 and (#7).", home), found("See octocat/hello-world#1 and #2.", home)]).toEqual([[], [
        ["#12", "https://github.com/noldova-com/teamrun/issues/12"],
        ["#7", "https://github.com/noldova-com/teamrun/issues/7"]
      ], [
        ["octocat/hello-world#1", "https://github.com/octocat/hello-world/issues/1"],
        ["#2", "https://github.com/noldova-com/teamrun/issues/2"]
      ]]);
    });

    it("finds no reference glued to a word, a path, an address or an entity, none with a number GitHub doesn't give, and no repository GitHub doesn't allow", () => {
      expect([
        "C#1", "word_octocat/x#1", "a/b/c#1", "example.com/a#1", "x.y/z#1", "#octocat/x#1", "octocat/x#12abc", "octocat/x#12-3", "octocat/x##12", "octocat/x#0",
        "octocat/x#012", "octocat/x#12345678901", "octocat/..#1", "octocat/.#1", "-octocat/x#1", "octocat/x#", "&#12;", "##12", "#12abc", "#0"
      ].map(t => found(t, home))).toEqual(new Array(20).fill([]));
    });

    it("takes the chat's repository from a GitHub remote's owner/repository path, and none from another host, a remote without a path or another path", () => {
      const remote = (host: string | null, path: string | null): GitRemote => new GitRemote("origin", host, path, RemoteTransport.Https);
      expect([
        remote("github.com", "noldova-com/teamrun"), null, remote("gitlab.com", "noldova-com/teamrun"), remote(null, null), remote("github.com", null),
        remote("github.com", "group/sub/teamrun"), remote("github.com", "octo_cat/teamrun"), remote("github.com", "noldova-com")
      ].map(t => GitHubReferenceLinks.homeOf(t))).toEqual(["noldova-com/teamrun", null, null, null, null, null, null, null]);
    });
  });
});
