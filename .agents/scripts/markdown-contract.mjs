const RAW_HTML_BLOCK_TAGS = new Set([
  "address", "article", "aside", "base", "basefont", "blockquote", "body", "caption",
  "center", "col", "colgroup", "dd", "details", "dialog", "dir", "div", "dl", "dt",
  "fieldset", "figcaption", "figure", "footer", "form", "frame", "frameset", "h1", "h2",
  "h3", "h4", "h5", "h6", "head", "header", "hr", "html", "iframe", "legend", "li",
  "link", "main", "menu", "menuitem", "nav", "noframes", "ol", "optgroup", "option", "p",
  "param", "search", "section", "summary", "table", "tbody", "td", "tfoot", "th", "thead",
  "title", "tr", "track", "ul",
]);

function rawHtmlBlockStart(line) {
  const typeOne = line.match(/^ {0,3}<(script|pre|style|textarea)(?=[\t />]|$)/i);
  if (typeOne) {
    return { closingPattern: new RegExp(`</${typeOne[1]}[ \\t]*>`, "i") };
  }
  if (/^ {0,3}<\?/.test(line)) return { closingPattern: /\?>/ };
  if (/^ {0,3}<!\[CDATA\[/i.test(line)) return { closingPattern: /\]\]>/ };
  if (/^ {0,3}<![A-Z]/.test(line)) return { closingPattern: />/ };

  const blockTag = line.match(/^ {0,3}<\/?([A-Za-z][A-Za-z0-9-]*)(?=[\t />]|$)/);
  if (blockTag && RAW_HTML_BLOCK_TAGS.has(blockTag[1].toLowerCase())) {
    return { untilBlankLine: true };
  }
  const completeTag = /^ {0,3}(?:<\/[A-Za-z][A-Za-z0-9-]*[ \t]*>|<[A-Za-z][A-Za-z0-9-]*(?:[ \t]+[^<>]*)?\/?>)[ \t]*$/;
  return completeTag.test(line) ? { untilBlankLine: true } : null;
}

function stripHtmlCommentsFromLine(line, commentOpen) {
  let output = "";
  let cursor = 0;
  let insideComment = commentOpen;
  while (cursor < line.length) {
    if (insideComment) {
      const commentEnd = line.indexOf("-->", cursor);
      if (commentEnd === -1) {
        output += " ".repeat(line.length - cursor);
        return { line: output, commentOpen: true };
      }
      output += " ".repeat(commentEnd + 3 - cursor);
      cursor = commentEnd + 3;
      insideComment = false;
      continue;
    }
    if (line[cursor] === "\\" && cursor + 1 < line.length) {
      output += line.slice(cursor, cursor + 2);
      cursor += 2;
      continue;
    }
    if (line[cursor] === "`") {
      let delimiterEnd = cursor + 1;
      while (line[delimiterEnd] === "`") delimiterEnd += 1;
      const delimiter = line.slice(cursor, delimiterEnd);
      const codeEnd = line.indexOf(delimiter, delimiterEnd);
      if (codeEnd === -1) {
        throw new Error("Multiline inline code is not allowed in contract Markdown");
      }
      output += line.slice(cursor, codeEnd + delimiter.length);
      cursor = codeEnd + delimiter.length;
      continue;
    }
    if (!line.startsWith("<!--", cursor)) {
      output += line[cursor];
      cursor += 1;
      continue;
    }
    output += " ".repeat(4);
    cursor += 4;
    insideComment = true;
  }
  return { line: output, commentOpen: insideComment };
}

export function stripNonContractMarkdown(content) {
  if (/[\u2028\u2029]/u.test(content)) {
    throw new Error("Unicode line separators are not allowed in contract Markdown");
  }
  const output = [];
  let fence = null;
  let htmlCommentOpen = false;
  for (const sourceLine of content.split(/\r\n?|\n/)) {
    if (fence) {
      const closing = sourceLine.match(/^ {0,3}(`+|~+)[ \t]*$/);
      if (
        closing
        && closing[1][0] === fence.character
        && closing[1].length >= fence.length
      ) {
        fence = null;
      }
      output.push("");
      continue;
    }
    if (htmlCommentOpen) {
      const stripped = stripHtmlCommentsFromLine(sourceLine, true);
      htmlCommentOpen = stripped.commentOpen;
      output.push(stripped.line);
      continue;
    }
    const opening = sourceLine.match(/^ {0,3}(`{3,}|~{3,})(.*)$/);
    if (opening && (opening[1][0] === "~" || !opening[2].includes("`"))) {
      fence = { character: opening[1][0], length: opening[1].length };
      output.push("");
      continue;
    }
    const stripped = stripHtmlCommentsFromLine(sourceLine, false);
    htmlCommentOpen = stripped.commentOpen;
    const rawHtml = rawHtmlBlockStart(stripped.line);
    if (rawHtml) {
      throw new Error("Raw HTML is not allowed in contract Markdown");
    }
    output.push(stripped.line);
  }
  return output.join("\n");
}
