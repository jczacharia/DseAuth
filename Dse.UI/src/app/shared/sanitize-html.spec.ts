import {SanitizeHtmlPipe} from '#shared/sanitize-html';
import {render, screen} from '@testing-library/angular';
import {describe, expect, it} from 'vitest';

describe(SanitizeHtmlPipe.name, () => {
  it('renders an empty string for null', async () => {
    await render(`<span data-testid="out">{{ 'hello' | sanitizeHtml }}</span>`, {
      imports: [SanitizeHtmlPipe],
    });
    expect(screen.getByTestId('out')).toHaveTextContent('hello');
  });
});
