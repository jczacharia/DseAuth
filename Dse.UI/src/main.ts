import {bootstrapApplication} from '@angular/platform-browser';
import {App} from './app/app';
import {appConfig} from './app/app.config';

// Native Temporal ships in modern engines (Chrome 137+, Node 26). The dynamic
// import keeps the polyfill in its own chunk, fetched only by clients without it.
if (!('Temporal' in globalThis)) {
  await import('temporal-polyfill/global');
}

try {
  await bootstrapApplication(App, appConfig);
} catch (err) {
  console.error(err); // eslint-disable-line no-console
}
