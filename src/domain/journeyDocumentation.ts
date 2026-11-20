import { abbreviateHomePath } from "./journeyRegistry";

export type DocumentationNodeKind = "folder" | "file";
export type DocumentationPreviewKind = "markdown" | "text" | "unavailable";

export type DocumentationNode = {
  relativePath: string;
  name: string;
  kind: DocumentationNodeKind;
  previewKind: DocumentationPreviewKind;
  sizeBytes?: number;
  modifiedAt?: number;
  children: DocumentationNode[];
  childrenLoaded?: boolean;
};

export type DocumentationTree = {
  status: "ready" | "empty";
  rootLabel: string;
  items: DocumentationNode[];
};

export type DocumentationTreeViewState =
  | DocumentationTree
  | { status: "loading" }
  | { status: "error"; message: string };

export type DocumentationContent =
  | {
      status: "ready";
      relativePath: string;
      previewKind: "markdown" | "text";
      content: string;
      sizeBytes?: number;
      modifiedAt?: number;
    }
  | {
      status: "unavailable";
      relativePath: string;
      previewKind: "unavailable";
      sizeBytes?: number;
      modifiedAt?: number;
      reason: string;
    };

export type DocumentationContentViewState =
  | DocumentationContent
  | { status: "idle" }
  | { status: "loading"; relativePath: string }
  // A folder opens as a listing of its own children, not as an unavailable preview.
  | { status: "folder"; relativePath: string; entries: DocumentationNode[]; sizeBytes?: number; modifiedAt?: number }
  | { status: "error"; relativePath: string; message: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isSafeRelativePath(value: unknown): value is string {
  return typeof value === "string"
    && value.length > 0
    && !value.startsWith("/")
    && !value.startsWith("\\")
    && !/^[A-Za-z]:[\\/]/.test(value)
    && value.split(/[\\/]/).every((part) => part.length > 0 && part !== "." && part !== "..");
}

function optionalNonNegativeNumber(value: unknown): number | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    throw new Error("Journey documentation payload is invalid.");
  }
  return value;
}

function normalizeNode(value: unknown): DocumentationNode {
  if (!isRecord(value)
    || !isSafeRelativePath(value.relativePath)
    || typeof value.name !== "string"
    || !value.name.trim()
    || !["folder", "file"].includes(String(value.kind))
    || !["markdown", "text", "unavailable"].includes(String(value.previewKind))
    || !Array.isArray(value.children)) {
    throw new Error("Journey documentation node is invalid.");
  }

  const node: DocumentationNode = {
    relativePath: value.relativePath,
    name: value.name,
    kind: value.kind as DocumentationNodeKind,
    previewKind: value.previewKind as DocumentationPreviewKind,
    sizeBytes: optionalNonNegativeNumber(value.sizeBytes),
    modifiedAt: optionalNonNegativeNumber(value.modifiedAt),
    children: value.children.map(normalizeNode),
    childrenLoaded: typeof value.childrenLoaded === "boolean" ? value.childrenLoaded : undefined,
  };

  if ((node.kind === "file" && (node.children.length > 0 || node.childrenLoaded === false))
    || (node.kind === "folder" && node.childrenLoaded === false && node.children.length > 0)) {
    throw new Error("Journey documentation node is invalid.");
  }
  return node;
}

export function sortDocumentationNodes(nodes: DocumentationNode[]): DocumentationNode[] {
  return nodes
    .map((node) => ({ ...node, children: sortDocumentationNodes(node.children) }))
    .sort((left, right) => {
      if (left.kind !== right.kind) return left.kind === "folder" ? -1 : 1;
      return left.name.localeCompare(right.name, undefined, { sensitivity: "base" });
    });
}

export function normalizeDocumentationTree(value: unknown): DocumentationTree {
  if (!isRecord(value)
    || !["ready", "empty"].includes(String(value.status))
    || typeof value.rootLabel !== "string"
    || !Array.isArray(value.items)) {
    throw new Error("Journey documentation tree is invalid.");
  }
  return {
    status: value.status as DocumentationTree["status"],
    rootLabel: value.rootLabel,
    items: sortDocumentationNodes(value.items.map(normalizeNode)),
  };
}

export function normalizeDocumentationContent(value: unknown): DocumentationContent {
  if (!isRecord(value) || !isSafeRelativePath(value.relativePath)) {
    throw new Error("Journey document content is invalid.");
  }

  const sizeBytes = optionalNonNegativeNumber(value.sizeBytes);
  const modifiedAt = optionalNonNegativeNumber(value.modifiedAt);
  if (value.status === "ready"
    && (value.previewKind === "markdown" || value.previewKind === "text")
    && typeof value.content === "string") {
    return {
      status: "ready",
      relativePath: value.relativePath,
      previewKind: value.previewKind,
      content: value.content,
      sizeBytes,
      modifiedAt,
    };
  }
  if (value.status === "unavailable"
    && value.previewKind === "unavailable"
    && typeof value.reason === "string"
    && value.reason.length > 0) {
    return {
      status: "unavailable",
      relativePath: value.relativePath,
      previewKind: "unavailable",
      reason: value.reason,
      sizeBytes,
      modifiedAt,
    };
  }
  throw new Error("Journey document content is invalid.");
}

// The workspace root is a folder like any other for selection, but it lives outside `items`, so
// it has no path of its own: the empty relative path names it.
export function documentationRootNode(rootLabel: string, items: DocumentationNode[]): DocumentationNode {
  return { relativePath: "", name: rootLabel, kind: "folder", previewKind: "unavailable", children: items };
}

export type DocumentationLocation = { shown: string; full: string | undefined };

/**
 * CR260 iteration 3: where a place is on disk, for the field's path bar. Composed here from the
 * Journey's registered folder, the one the native side reads the tree from, so the documentation
 * transport keeps carrying workspace-relative paths only. The home folder is shortened for display
 * and kept whole in `full`.
 */
export function documentationLocation(
  workspaceRoot: string | undefined,
  relativePath: string,
  homeDirectory: string | undefined,
): DocumentationLocation {
  const registered = workspaceRoot?.trim();
  if (!registered) return { shown: relativePath || "Journey root", full: undefined };
  const separator = registered.includes("\\") && !registered.includes("/") ? "\\" : "/";
  const home = homeDirectory?.replace(/[\\/]+$/, "");
  const trimmed = registered.length > 1 ? registered.replace(/[\\/]+$/, "") : registered;
  const root = home && (trimmed === "~" || trimmed.startsWith(`~${separator}`)) ? `${home}${trimmed.slice(1)}` : trimmed;
  const tail = relativePath ? `${separator}${relativePath.split("/").join(separator)}` : "";
  return { shown: `${abbreviateHomePath(root, homeDirectory)}${tail}`, full: `${root}${tail}` };
}

export function findDocumentationNode(
  nodes: DocumentationNode[],
  relativePath: string,
): { node: DocumentationNode; ancestorPaths: string[] } | undefined {
  for (const node of nodes) {
    if (node.relativePath === relativePath) return { node, ancestorPaths: [] };
    const child = findDocumentationNode(node.children, relativePath);
    if (child) return { node: child.node, ancestorPaths: [node.relativePath, ...child.ancestorPaths] };
  }
  return undefined;
}

/** The folders on the way to a workspace path, shallow first. */
export function documentationAncestorPaths(relativePath: string): string[] {
  const components = relativePath.split("/");
  return components.slice(0, -1).map((_, index) => components.slice(0, index + 1).join("/"));
}

/**
 * Find a place the tree may not hold yet. A folder selected in the tree opens as a listing in the
 * viewer without the tree loading it, so a file opened from that listing is under a folder the
 * tree never read. Each such folder on the way is read, shallow first, and the tree returned holds
 * them. No match means the place was looked for where it was and is not there; a failed read
 * rejects, so the caller can tell "could not read" from "gone".
 */
export async function resolveDocumentationPlace(
  items: DocumentationNode[],
  relativePath: string,
  listChildren: (folderPath: string) => Promise<DocumentationNode[]>,
): Promise<{ items: DocumentationNode[]; match: { node: DocumentationNode; ancestorPaths: string[] } | undefined }> {
  let next = items;
  for (const path of documentationAncestorPaths(relativePath)) {
    const ancestor = findDocumentationNode(next, path);
    if (!ancestor || ancestor.node.kind !== "folder") break;
    if (ancestor.node.childrenLoaded === false) {
      next = replaceDocumentationNodeChildren(next, path, await listChildren(path));
    }
  }
  return { items: next, match: findDocumentationNode(next, relativePath) };
}

export function replaceDocumentationNodeChildren(
  nodes: DocumentationNode[],
  parentPath: string,
  children: DocumentationNode[],
): DocumentationNode[] {
  let changed = false;
  const next = nodes.map((node) => {
    if (node.relativePath === parentPath) {
      changed = true;
      return { ...node, children, childrenLoaded: true };
    }
    const nextChildren = replaceDocumentationNodeChildren(node.children, parentPath, children);
    if (nextChildren === node.children) return node;
    changed = true;
    return { ...node, children: nextChildren };
  });
  return changed ? next : nodes;
}

export function loadedDocumentationPaths(nodes: DocumentationNode[]): Set<string> {
  const paths = new Set<string>();
  for (const node of nodes) {
    paths.add(node.relativePath);
    for (const childPath of loadedDocumentationPaths(node.children)) paths.add(childPath);
  }
  return paths;
}

export function toggleExpandedDocumentationPath(paths: ReadonlySet<string>, path: string): Set<string> {
  const next = new Set(paths);
  if (next.has(path)) next.delete(path);
  else next.add(path);
  return next;
}
