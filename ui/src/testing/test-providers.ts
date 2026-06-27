import {provideHttpClient} from '@angular/common/http';
import {provideHttpClientTesting} from '@angular/common/http/testing';
import {type EnvironmentProviders, type Provider} from '@angular/core';
import {provideRouter} from '@angular/router';

const testProviders: (Provider | EnvironmentProviders)[] = [
  provideHttpClient(),
  provideHttpClientTesting(),
  provideRouter([]),
];

export default testProviders;
