import { compile } from '@mdx-js/mdx';

export type MdxRuleId =
  | 'mdx-compile-error'
  | 'mdx-template-placeholder'
  | 'mdx-bare-jsx-tag';

export interface MdxValidationIssue {
  line: number;
  column: number;
  ruleId: MdxRuleId;
  message: string;
  severity: 'error';
}

export interface MdxValidationResult {
  valid: boolean;
  issues: MdxValidationIssue[];
}

function getIssueLocation(error: any): { line: number; column: number } {
  const line = error?.line ?? error?.position?.start?.line ?? 1;
  const column = error?.column ?? error?.position?.start?.column ?? 1;
  return { line, column };
}

function getIssueMessage(error: any): string {
  const raw = error?.reason ?? error?.message ?? 'Unknown MDX compile error';
  if (typeof raw === 'string' && raw.includes('Could not parse expression with acorn')) {
    return (
      raw +
      ' — this usually means an unescaped `{...}` expression or unmatched JSX tag. Wrap placeholder text in backticks or replace with a concrete value.'
    );
  }
  return raw;
}

function maskCodeSpans(lines: string[]): string[] {
  const out: string[] = new Array(lines.length);
  let activeFence: string | null = null;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const fenceMatch = /^\s*(```+|~~~+)/.exec(line);
    if (fenceMatch) {
      const delimiter = fenceMatch[1];
      if (activeFence === null) {
        activeFence = delimiter;
        out[i] = '';
        continue;
      } else if (delimiter === activeFence) {
        activeFence = null;
        out[i] = '';
        continue;
      }
    }
    if (activeFence !== null) {
      out[i] = '';
      continue;
    }
    let masked = '';
    let inInline = false;
    for (let c = 0; c < line.length; c++) {
      const ch = line[c];
      if (ch === '\\' && c + 1 < line.length && line[c + 1] === '`') {
        masked += '  ';
        c++;
        continue;
      }
      if (ch === '`') {
        inInline = !inInline;
        masked += ' ';
        continue;
      }
      masked += inInline ? ' ' : ch;
    }
    out[i] = masked;
  }
  return out;
}

function findTemplatePlaceholders(maskedLines: string[]): MdxValidationIssue[] {
  const issues: MdxValidationIssue[] = [];
  const pattern = /\{N(?:\+\d+)?\}/g;
  for (let i = 0; i < maskedLines.length; i++) {
    let m: RegExpExecArray | null;
    pattern.lastIndex = 0;
    while ((m = pattern.exec(maskedLines[i])) !== null) {
      issues.push({
        line: i + 1,
        column: m.index + 1,
        ruleId: 'mdx-template-placeholder',
        message:
          `Unexpanded task placeholder \`${m[0]}\` found — standard closing tasks must be renumbered with concrete integers before dashboard submission. ` +
          `Replace ${m[0]} with the actual task number (e.g., if the last implementation task is 3, {N} becomes 4, {N+1} becomes 5, etc.).`,
        severity: 'error',
      });
    }
  }
  return issues;
}

const ALLOWED_HTML_TAGS = new Set([
  'a', 'abbr', 'address', 'article', 'aside', 'audio', 'b', 'blockquote', 'br',
  'button', 'caption', 'cite', 'code', 'col', 'colgroup', 'data', 'datalist',
  'dd', 'del', 'details', 'dfn', 'div', 'dl', 'dt', 'em', 'embed', 'fieldset',
  'figcaption', 'figure', 'footer', 'form', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'header', 'hr', 'i', 'iframe', 'img', 'input', 'ins', 'kbd', 'label',
  'legend', 'li', 'main', 'mark', 'meter', 'nav', 'ol', 'optgroup', 'option',
  'output', 'p', 'pre', 'progress', 'q', 's', 'samp', 'section', 'select',
  'small', 'source', 'span', 'strong', 'sub', 'summary', 'sup', 'table',
  'tbody', 'td', 'template', 'textarea', 'tfoot', 'th', 'thead', 'time', 'tr',
  'track', 'u', 'ul', 'var', 'video', 'wbr',
]);

function findBareJsxTags(maskedLines: string[]): MdxValidationIssue[] {
  const issues: MdxValidationIssue[] = [];
  const pattern = /<([A-Z][a-zA-Z0-9]*|[a-z][a-z0-9-]*)(?:\s[^>]*)?\s*\/?>/g;
  for (let i = 0; i < maskedLines.length; i++) {
    let m: RegExpExecArray | null;
    pattern.lastIndex = 0;
    while ((m = pattern.exec(maskedLines[i])) !== null) {
      const tag = m[1];
      if (ALLOWED_HTML_TAGS.has(tag)) continue;
      issues.push({
        line: i + 1,
        column: m.index + 1,
        ruleId: 'mdx-bare-jsx-tag',
        message:
          `Bare \`<${tag}>\` token outside code fences — MDX parses this as a JSX opening tag and will reject the file. ` +
          `Wrap in backticks, escape as \`&lt;${tag}&gt;\`, or replace with a plain placeholder like \`[${tag}]\`.`,
        severity: 'error',
      });
    }
  }
  return issues;
}

function runPrePass(content: string): MdxValidationIssue[] {
  const lines = content.split(/\r?\n/);
  const masked = maskCodeSpans(lines);
  return [...findTemplatePlaceholders(masked), ...findBareJsxTags(masked)];
}

export async function validateMarkdownForMdx(content: string): Promise<MdxValidationResult> {
  const prePassIssues = runPrePass(content);

  if (prePassIssues.length > 0) {
    return { valid: false, issues: prePassIssues };
  }

  try {
    await compile(content, { format: 'mdx' });
    return { valid: true, issues: [] };
  } catch (error) {
    const { line, column } = getIssueLocation(error);
    return {
      valid: false,
      issues: [
        {
          line,
          column,
          ruleId: 'mdx-compile-error',
          message: getIssueMessage(error),
          severity: 'error',
        },
      ],
    };
  }
}

export function formatMdxValidationIssues(issues: MdxValidationIssue[]): string[] {
  return issues.map(
    (issue) => `Line ${issue.line}:${issue.column} [${issue.ruleId}] ${issue.message}`,
  );
}
