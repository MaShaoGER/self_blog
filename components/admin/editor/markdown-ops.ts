export type Edit = { value: string; selStart: number; selEnd: number };

/** Wrap the selection with markers, or insert placeholder text wrapped by them. */
export function wrap(value: string, start: number, end: number, before: string, after = before, placeholder = "文字"): Edit {
  const selected = value.slice(start, end) || placeholder;
  const next = value.slice(0, start) + before + selected + after + value.slice(end);
  const s = start + before.length;
  return { value: next, selStart: s, selEnd: s + selected.length };
}

/** Toggle a prefix (e.g. "## ", "> ") on every line touched by the selection. */
export function prefixLines(value: string, start: number, end: number, prefix: string): Edit {
  const lineStart = value.lastIndexOf("\n", start - 1) + 1;
  const lineEndIdx = value.indexOf("\n", end);
  const lineEnd = lineEndIdx === -1 ? value.length : lineEndIdx;
  const lines = value.slice(lineStart, lineEnd).split("\n");
  const all = lines.every((l) => l.startsWith(prefix));
  const changed = lines.map((l) => (all ? l.slice(prefix.length) : prefix + l.replace(/^#{1,6}\s+/, ""))).join("\n");
  const next = value.slice(0, lineStart) + changed + value.slice(lineEnd);
  return { value: next, selStart: lineStart, selEnd: lineStart + changed.length };
}

/** Insert a block on its own line(s) at the cursor. */
export function insertBlock(value: string, pos: number, block: string): Edit {
  const before = value.slice(0, pos);
  const after = value.slice(pos);
  const lead = before === "" || before.endsWith("\n\n") ? "" : before.endsWith("\n") ? "\n" : "\n\n";
  const tail = after === "" || after.startsWith("\n\n") ? "" : after.startsWith("\n") ? "\n" : "\n\n";
  const next = before + lead + block + tail + after;
  const caret = before.length + lead.length + block.length;
  return { value: next, selStart: caret, selEnd: caret };
}

/** ISO string -> value for <input type="datetime-local"> in the browser's zone. */
export function toLocalInput(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

export function fromLocalInput(v: string): string {
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
}
