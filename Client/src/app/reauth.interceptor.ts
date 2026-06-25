import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { catchError, throwError } from 'rxjs';

const REAUTH_THROTTLE_MS = 10_000;

// On a 401 (the Ping PA.APP_DSE token expired), an XHR can't follow the gateway's re-auth redirect.
// Drive a top-level navigation through the gateway so PingAccess silently refreshes the token against
// the still-valid SSO session (or shows login if it's gone), then returns to where we were. The throttle
// prevents a redirect loop when the SSO session is truly dead.
export const reauthInterceptor: HttpInterceptorFn = (req, next) =>
  next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      if (error.status === 401) {
        const last = Number(sessionStorage.getItem('reauth.at') ?? 0);
        if (Date.now() - last > REAUTH_THROTTLE_MS) {
          sessionStorage.setItem('reauth.at', String(Date.now()));
          sessionStorage.setItem('reauth.returnUrl', location.pathname + location.search + location.hash);
          location.assign('/?reauth=' + Date.now());
        }
      }

      return throwError(() => error);
    }),
  );
