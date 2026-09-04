import { describe, expect, it } from 'vitest';
import { sanitizeRichBlockText } from './sanitize-rich-block-text';

describe('sanitizeRichBlockText', () => {
  it('keeps plain text with no tags unchanged', () => {
    expect(sanitizeRichBlockText('Просто текст без разметки')).toBe('Просто текст без разметки');
  });

  it('keeps the allowed formatting tags', () => {
    const html = '<p>Обычный <strong>жирный</strong> и <em>курсив</em></p>';
    expect(sanitizeRichBlockText(html)).toBe(html);
  });

  it('keeps a link and forces target/rel regardless of what was sent', () => {
    const html = '<a href="https://example.com">ссылка</a>';
    expect(sanitizeRichBlockText(html)).toBe(
      '<a href="https://example.com" target="_blank" rel="noopener noreferrer">ссылка</a>',
    );
  });

  it('strips a script tag entirely', () => {
    expect(sanitizeRichBlockText('<script>alert(1)</script>текст')).toBe('текст');
  });

  it('strips an img tag with an onerror handler (not in the allowlist at all)', () => {
    expect(sanitizeRichBlockText('<img src=x onerror="alert(1)">текст')).toBe('текст');
  });

  it('strips a javascript: link href', () => {
    const result = sanitizeRichBlockText('<a href="javascript:alert(1)">кликни</a>');
    expect(result).not.toContain('javascript:');
  });

  it('strips disallowed tags (div/span/table) but keeps their text content', () => {
    const html = '<div class="x"><span style="color:red">текст</span></div>';
    expect(sanitizeRichBlockText(html)).toBe('текст');
  });

  it('strips inline style/class attributes even on allowed tags', () => {
    const html = '<p style="position:fixed" class="evil">текст</p>';
    expect(sanitizeRichBlockText(html)).toBe('<p>текст</p>');
  });

  it('preserves line breaks (br), normalized to self-closing form', () => {
    const html = '<p>Первая строка<br>Вторая строка</p>';
    expect(sanitizeRichBlockText(html)).toBe('<p>Первая строка<br />Вторая строка</p>');
  });
});
