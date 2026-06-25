// Dev only: ng serve (:4200) forwards API calls to the .NET backend so the browser stays single-origin,
// matching production where Dse.Api serves both the SPA and the API. Target = launchSettings http profile.
module.exports = [
  {
    context: ['/api'],
    target: 'http://localhost:5076',
    secure: false,
    changeOrigin: true,
  },
];
