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

/**
 * Extracts the source line and column from an MDX/Acorn error object.
 *
 * Attempts to read `error.line` and `error.column`, then falls back to
 * `error.position.start.line` and `error.position.start.column`. If neither
 * location is available, both `line` and `column` default to `1`.
 *
 * @param error - The error object produced by the MDX compiler or parser
 * @returns An object with `line` and `column` indicating the error location; both default to `1` when unavailable
 */
function getIssueLocation(error: any): { line: number; column: number } {
  const line = error?.line ?? error?.position?.start?.line ?? 1;
  const column = error?.column ?? error?.position?.start?.column ?? 1;
  return { line, column };
}

/**
 * Produce a user-facing message describing an MDX compile error.
 *
 * If the source message contains "Could not parse expression with acorn", append a hint about common causes (unescaped `{...}` placeholders or unmatched JSX tags) and suggested remedies.
 *
 * @param error - Error object or value; the function prefers `error.reason`, then `error.message`, and falls back to `'Unknown MDX compile error'` when neither is present.
 * @returns The resolved error message string, possibly augmented with guidance for acorn parse failures.
 */
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

/**
 * Produces a line-by-line masked copy of Markdown content that hides code spans and fenced code blocks.
 *
 * For fenced code blocks (```...``` or ~~~...~~~) the entire fenced lines are replaced with empty strings.
 * For inline code spans delimited by backticks (`...`) characters inside the span are replaced with spaces so
 * column positions remain aligned. Escaped backticks (`\``) are treated as literal backticks and replaced with two spaces.
 *
 * @param lines - The input text split into lines.
 * @returns An array of lines where fenced-code lines are empty and inline code characters are replaced with spaces.
 */
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

/**
 * Finds unexpanded template placeholders of the form `{N}` or `{N+<digits>}` in the provided lines and emits validation issues for each match.
 *
 * @param maskedLines - Line-by-line input where code spans and fenced blocks have been masked (typically produced by `maskCodeSpans`)
 * @returns An array of validation issues, one per placeholder found; each issue uses `ruleId: 'mdx-template-placeholder'` and includes `line`, `column`, a replacement guidance `message`, and `severity: 'error'`
 */
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

/**
 * Finds bare JSX-like opening tags in already-masked lines and reports them as MDX validation issues.
 *
 * Scans each line for tokens that look like `<Tag ...>` or self-closing `<tag/>`; any tag name not present
 * in the allowed HTML tag set is reported as an `mdx-bare-jsx-tag` issue.
 *
 * @param maskedLines - Array of input lines where fenced code blocks and inline code spans have been masked.
 * @returns An array of `MdxValidationIssue` objects (one per offending tag). Each issue includes the 1-based
 * line and column where the tag starts, `ruleId: 'mdx-bare-jsx-tag'`, a human-readable message, and `severity: 'error'`.
 */
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

/**
 * Performs a pre-compilation scan of MDX content for template placeholders and bare JSX-like tags.
 *
 * @param content - The raw MDX/Markdown source to inspect
 * @returns An array of `MdxValidationIssue` entries for any detected `{N}`/`{N+digits}` placeholders or bare JSX-like tags; empty if none were found
 */
function runPrePass(content: string): MdxValidationIssue[] {
  const lines = content.split(/\r?\n/);
  const masked = maskCodeSpans(lines);
  return [...findTemplatePlaceholders(masked), ...findBareJsxTags(masked)];
}

/**
 * Validates Markdown/MDX content and returns structured MDX validation results.
 *
 * Performs a pre-compilation pass for template placeholders and bare JSX-like tags; if any pre-pass issues are found, compilation is skipped and those issues are returned. If the pre-pass passes, attempts to compile the content as MDX and reports a `mdx-compile-error` issue when compilation fails.
 *
 * @param content - The Markdown/MDX source to validate
 * @returns `true` if the content passes pre-pass checks and compiles as MDX, `false` otherwise; `issues` contains zero or more `MdxValidationIssue` entries describing detected problems
 */
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
