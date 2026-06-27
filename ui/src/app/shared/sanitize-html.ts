import {inject, Pipe, SecurityContext, type PipeTransform} from '@angular/core';
import {DomSanitizer} from '@angular/platform-browser';

@Pipe({name: 'sanitizeHtml'})
export class SanitizeHtmlPipe implements PipeTransform {
  readonly #sanitizer = inject(DomSanitizer);

  transform(value: string | string[] | undefined | null) {
    if (!value) return value;
    return this.#sanitizer.sanitize(SecurityContext.HTML, Array.isArray(value) ? value.join() : value);
  }
}
