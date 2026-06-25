import {Component} from '@angular/core';
import {RouterOutlet} from '@angular/router';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  host: {class: 'isolate'},
  template: `<router-outlet />`,
})
export class App {}
