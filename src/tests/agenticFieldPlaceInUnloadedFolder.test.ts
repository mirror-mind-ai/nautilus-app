import { describe, expect, it, vi } from "vitest";
import {
  documentationAncestorPaths,
  resolveDocumentationPlace,
  type DocumentationNode,
} from "../domain/journeyDocumentation";
import browserSource from "../app/JourneyDocumentationBrowser.tsx?raw";

// A folder selected in the tree opens as a listing in the viewer, and a file opened from that
// listing is under a folder the tree never loaded. Back, Forward and Reload looked for the file in
// the tree, did not find it, and said "That place is no longer in the Journey workspace" (or "The
// previously selected artifact is no longer present") about a file that was there. Found on an
// installed Windows build; the names do not matter, plain ASCII reproduces it.

const file = (relativePath: string): DocumentationNode => ({
  relativePath, name: relativePath.split("/").at(-1)!, kind: "file", previewKind: "markdown", children: [],
});
const folder = (relativePath: string, children?: DocumentationNode[]): DocumentationNode => ({
  relativePath, name: relativePath.split("/").at(-1)!, kind: "folder", previewKind: "unavailable",
  children: children ?? [], childrenLoaded: children !== undefined,
});

describe("a place under a folder the tree has not loaded", () => {
  it("names the folders on the way to a place, shallow first", () => {
    expect(documentationAncestorPaths("docs/guides/start.md")).toEqual(["docs", "docs/guides"]);
    expect(documentationAncestorPaths("notes.txt")).toEqual([]);
    expect(documentationAncestorPaths("")).toEqual([]);
  });

  it("finds a file opened from a folder's listing by loading that folder", async () => {
    const items = [folder("docs"), file("notes.txt")];
    const listChildren = vi.fn(async (path: string) => (path === "docs" ? [file("docs/plain.md")] : []));
    const resolved = await resolveDocumentationPlace(items, "docs/plain.md", listChildren);
    expect(listChildren.mock.calls).toEqual([["docs"]]);
    expect(resolved.match?.node.relativePath).toBe("docs/plain.md");
    expect(resolved.match?.ancestorPaths).toEqual(["docs"]);
    // The tree it returns holds the folder's children, so the next lookup needs no read.
    expect(resolved.items.find((node) => node.relativePath === "docs")?.childrenLoaded).toBe(true);
    expect(items[0].childrenLoaded).toBe(false);
  });

  it("loads every unloaded folder on the way, shallow first, and only those", async () => {
    const items = [folder("docs", [folder("docs/guides"), file("docs/read.md")])];
    const listChildren = vi.fn(async (path: string) =>
      path === "docs/guides" ? [folder("docs/guides/deep")] : path === "docs/guides/deep" ? [file("docs/guides/deep/a.md")] : []);
    const resolved = await resolveDocumentationPlace(items, "docs/guides/deep/a.md", listChildren);
    expect(listChildren.mock.calls).toEqual([["docs/guides"], ["docs/guides/deep"]]);
    expect(resolved.match?.ancestorPaths).toEqual(["docs", "docs/guides", "docs/guides/deep"]);
  });

  it("reads nothing when the tree already holds the place", async () => {
    const items = [folder("docs", [file("docs/plain.md")])];
    const listChildren = vi.fn(async () => []);
    const resolved = await resolveDocumentationPlace(items, "docs/plain.md", listChildren);
    expect(listChildren).not.toHaveBeenCalled();
    expect(resolved.items).toBe(items);
    expect(resolved.match?.node.relativePath).toBe("docs/plain.md");
  });

  it("says a place is gone only after looking where it was", async () => {
    const removedFile = await resolveDocumentationPlace([folder("docs")], "docs/plain.md", async () => [file("docs/other.md")]);
    expect(removedFile.match).toBeUndefined();
    const removedFolder = await resolveDocumentationPlace([file("notes.txt")], "docs/plain.md", vi.fn(async () => []));
    expect(removedFolder.match).toBeUndefined();
    const folderBecameFile = await resolveDocumentationPlace([file("docs")], "docs/plain.md", vi.fn(async () => []));
    expect(folderBecameFile.match).toBeUndefined();
  });

  it("lets a failed read surface, so the field can say it could not read rather than that the place is gone", async () => {
    await expect(resolveDocumentationPlace([folder("docs")], "docs/plain.md", async () => { throw new Error("bounded read failed"); }))
      .rejects.toThrow("bounded read failed");
  });

  it("is what Back and Forward resolve a place with, and Reload keeps the shown place's folders", () => {
    const goTo = browserSource.slice(browserSource.indexOf("function goTo("), browserSource.indexOf("function showBriefing("));
    expect(goTo).toContain("resolveDocumentationPlace(");
    // Not found is said only after the resolution, never straight from the tree as it happens to be.
    expect(goTo.indexOf("resolveDocumentationPlace(")).toBeLessThan(goTo.indexOf("That place is no longer in the Journey workspace."));
    const loadTree = browserSource.slice(browserSource.indexOf("async function loadTree("), browserSource.indexOf("function reloadField("));
    expect(loadTree).toContain("documentationAncestorPaths(selectedNode.relativePath)");
  });
});
