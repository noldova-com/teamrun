/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestData, TestMethod } from "@noldova/teamrun-foundation-testing";
import { LinkPolicy } from "@noldova/teamrun-shell-desktop";

@TestClass
export class LinkPolicyTests {
  @TestMethod
  @TestData("https://example.com/docs?page=2#top", "https://example.com/docs?page=2#top")
  @TestData("HTTP://Example.com", "http://example.com/")
  @TestData("mailto:support@example.com?subject=TeamRun", "mailto:support@example.com?subject=TeamRun")
  public allowsWellFormedHttpHttpsAndMailtoLinksInTheirNormalizedForm(url: string, expected: string): void {
    Assert.areEqual(expected, LinkPolicy.findAllowed(url));
  }

  @TestMethod
  @TestData("file:///etc/passwd")
  @TestData("javascript:alert(1)")
  @TestData("data:text/html,<p>hi</p>")
  @TestData("teamrun://open")
  @TestData("https://user@example.com/")
  @TestData("https://user:secret@example.com/")
  @TestData("not a link")
  @TestData("")
  public refusesOtherSchemesCredentialsAndTextThatIsNotALink(url: string): void {
    Assert.isNull(LinkPolicy.findAllowed(url));
  }

  @TestMethod
  public refusesALinkLongerThanTheLimitAndAValueThatIsNotText(): void {
    Assert.areEqual(32768, LinkPolicy.findAllowed(`https://example.com/${"x".repeat(32748)}`)?.length);
    Assert.isNull(LinkPolicy.findAllowed(`https://example.com/${"x".repeat(32749)}`));
    Assert.isNull(LinkPolicy.findAllowed(5));
    Assert.isNull(LinkPolicy.findAllowed(null));
  }
}
