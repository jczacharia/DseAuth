import {By} from '@angular/platform-browser';
import {render} from '@testing-library/angular';
import {App} from './app';

describe(App.name, () => {
  it('should render router-outlet', async () => {
    const harness = await render(App);
    harness.detectChanges();
    expect(harness.debugElement.query(By.css('router-outlet'))).toBeTruthy();
  });
});
