/**
 * Copyright 2018 Google Inc. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *     http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

// If the loader is already loaded, just stop.
if (!self.define) {
  let registry = {};

  // Used for `eval` and `importScripts` where we can't get script URL by other means.
  // In both cases, it's safe to use a global var because those functions are synchronous.
  let nextDefineUri;

  const singleRequire = (uri, parentUri) => {
    uri = new URL(uri + ".js", parentUri).href;
    return registry[uri] || (
      
        new Promise(resolve => {
          if ("document" in self) {
            const script = document.createElement("script");
            script.src = uri;
            script.onload = resolve;
            document.head.appendChild(script);
          } else {
            nextDefineUri = uri;
            importScripts(uri);
            resolve();
          }
        })
      
      .then(() => {
        let promise = registry[uri];
        if (!promise) {
          throw new Error(`Module ${uri} didn’t register its module`);
        }
        return promise;
      })
    );
  };

  self.define = (depsNames, factory) => {
    const uri = nextDefineUri || ("document" in self ? document.currentScript.src : "") || location.href;
    if (registry[uri]) {
      // Module is already loading or loaded.
      return;
    }
    let exports = {};
    const require = depUri => singleRequire(depUri, uri);
    const specialDeps = {
      module: { uri },
      exports,
      require
    };
    registry[uri] = Promise.all(depsNames.map(
      depName => specialDeps[depName] || require(depName)
    )).then(deps => {
      factory(...deps);
      return exports;
    });
  };
}
define(['./workbox-43e44e5a'], (function (workbox) { 'use strict';

  self.skipWaiting();
  workbox.clientsClaim();
  /**
   * The precacheAndRoute() method efficiently caches and responds to
   * requests for URLs in the manifest.
   * See https://goo.gl/S9QRab
   */
  workbox.precacheAndRoute([{
    "url": "pwa-maskable-512x512.png",
    "revision": "d02ace58929efbda34c228aac306eb74"
  }, {
    "url": "pwa-512x512.png",
    "revision": "44af876b7c07999af9a890041201b92c"
  }, {
    "url": "pwa-192x192.png",
    "revision": "7ddd1c7df94a6dd53586b9f989fa9978"
  }, {
    "url": "index.html",
    "revision": "c949839d8a0512bf1fb39aa1bfa1efc3"
  }, {
    "url": "icon.svg",
    "revision": "99943b3ead5aa20d117f211b6344dbbe"
  }, {
    "url": "favicon.ico",
    "revision": "0d736d574ec12bd0e64e767c7030c5f3"
  }, {
    "url": "apple-touch-icon.png",
    "revision": "105c1f78193939d6ad2453a84c5c2ade"
  }, {
    "url": "assets/workbox-window.prod.es5-Bd17z0YL.js",
    "revision": null
  }, {
    "url": "assets/purify.es-Dzkdzyfv.js",
    "revision": null
  }, {
    "url": "assets/index.es-CCNhMNSK.js",
    "revision": null
  }, {
    "url": "assets/index-Dj05RJUM.css",
    "revision": null
  }, {
    "url": "assets/index-DHI3RNEm.js",
    "revision": null
  }, {
    "url": "assets/html2canvas-BzN_g_W7.js",
    "revision": null
  }, {
    "url": "assets/aistudio/1792354305419_957ebff5.png",
    "revision": null
  }, {
    "url": "apple-touch-icon.png",
    "revision": "105c1f78193939d6ad2453a84c5c2ade"
  }, {
    "url": "icon.svg",
    "revision": "99943b3ead5aa20d117f211b6344dbbe"
  }, {
    "url": "pwa-192x192.png",
    "revision": "7ddd1c7df94a6dd53586b9f989fa9978"
  }, {
    "url": "pwa-512x512.png",
    "revision": "44af876b7c07999af9a890041201b92c"
  }, {
    "url": "pwa-maskable-512x512.png",
    "revision": "d02ace58929efbda34c228aac306eb74"
  }, {
    "url": "manifest.webmanifest",
    "revision": "98f98b1e7f476de82abc4d22657eeeb9"
  }], {});
  workbox.cleanupOutdatedCaches();
  workbox.registerRoute(new workbox.NavigationRoute(workbox.createHandlerBoundToURL("index.html")));
  workbox.registerRoute(/\/version\.json(\?.*)?$/i, new workbox.NetworkOnly(), 'GET');
  workbox.registerRoute(/^https:\/\/fonts\.googleapis\.com\/.*/i, new workbox.CacheFirst({
    "cacheName": "google-fonts-cache",
    plugins: [new workbox.ExpirationPlugin({
      maxEntries: 10,
      maxAgeSeconds: 31536000
    }), new workbox.CacheableResponsePlugin({
      statuses: [0, 200]
    })]
  }), 'GET');
  workbox.registerRoute(/^https:\/\/fonts\.gstatic\.com\/.*/i, new workbox.CacheFirst({
    "cacheName": "gstatic-fonts-cache",
    plugins: [new workbox.ExpirationPlugin({
      maxEntries: 10,
      maxAgeSeconds: 31536000
    }), new workbox.CacheableResponsePlugin({
      statuses: [0, 200]
    })]
  }), 'GET');

}));
