import '@analogjs/vitest-angular/setup-serializers';

import '@analogjs/vitest-angular/setup-snapshots';

import {setupTestBed} from '@analogjs/vitest-angular/setup-testbed';

import '@testing-library/jest-dom/vitest';

import '@angular/compiler';

import testProviders from './test-providers';

// providersFile equivalent: apply the shared test providers to every spec's TestBed.
setupTestBed({providers: testProviders});
