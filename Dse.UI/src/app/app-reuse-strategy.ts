import {Injectable} from '@angular/core';
import {type ActivatedRouteSnapshot, BaseRouteReuseStrategy, type DetachedRouteHandle} from '@angular/router';

@Injectable()
export class AppReuseStrategy extends BaseRouteReuseStrategy {
  readonly #handles = new Map<string, DetachedRouteHandle>();

  #key(route: ActivatedRouteSnapshot): string | null {
    const reuse = route.routeConfig?.data?.['reuse'] as string | undefined;
    return reuse ? `${reuse}:${route.outlet}` : null;
  }

  override shouldDetach(route: ActivatedRouteSnapshot): boolean {
    return this.#key(route) !== null;
  }

  override store(route: ActivatedRouteSnapshot, handle: DetachedRouteHandle | null): void {
    const key = this.#key(route);
    if (!key) return;
    if (handle) this.#handles.set(key, handle);
    else this.#handles.delete(key);
  }

  override shouldAttach(route: ActivatedRouteSnapshot): boolean {
    const key = this.#key(route);
    return key !== null && this.#handles.has(key);
  }

  override retrieve(route: ActivatedRouteSnapshot): DetachedRouteHandle | null {
    const key = this.#key(route);
    return (key && this.#handles.get(key)) || null;
  }

  retrieveStoredRouteHandles(): DetachedRouteHandle[] {
    return [...this.#handles.values()];
  }
}
