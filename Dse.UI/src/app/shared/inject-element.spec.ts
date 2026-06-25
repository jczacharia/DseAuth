import {Directive, ElementRef} from '@angular/core';
import {By} from '@angular/platform-browser';
import {render} from '@testing-library/angular';
import {injectElement, injectElementRef} from './inject-element';

@Directive({selector: '[useEl]'})
class UseEl {
  readonly ref = injectElementRef<HTMLElement>();
  readonly native = injectElement<HTMLElement>();
}

describe('injectElement / injectElementRef', () => {
  it('should return the host element and its ElementRef', async () => {
    const {fixture} = await render(`<div useEl data-testid="host"></div>`, {imports: [UseEl]});
    const dir = fixture.debugElement.query(By.directive(UseEl)).injector.get(UseEl);
    expect(dir.ref).toBeInstanceOf(ElementRef);
    expect(dir.native).toBe(dir.ref.nativeElement);
    expect(dir.native.dataset['testid']).toBe('host');
  });
});
