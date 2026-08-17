const functions = require('firebase-functions');
const admin = require('firebase-admin');
admin.initializeApp();

exports.proxyFile = functions.https.onRequest((req, res) => {
  // ── Set ALL framing headers BEFORE any async operations ──
  // This ensures they are sent regardless of Firebase proxy behavior
  res.setHeader('X-Frame-Options', '');
  res.setHeader('Content-Security-Policy', 'frame-ancestors *');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  res.setHeader('Cross-Origin-Embedder-Policy', 'unsafe-none');

  const rawPath = req.path.replace(/^\/files\//, '');
  const filePath = decodeURIComponent(rawPath);

  if (!filePath) {
    return res.status(400).send('Missing file path');
  }

  const bucket = admin.storage().bucket();
  const file = bucket.file(filePath);

  file.getMetadata()
    .then(([metadata]) => {
      res.setHeader('Content-Type', metadata.contentType || 'application/pdf');
      res.setHeader('Cache-Control', 'public, max-age=3600');
      file.createReadStream()
        .on('error', (err) => {
          console.error('Stream error:', err.message);
          if (!res.headersSent) res.status(404).send('File not found');
        })
        .pipe(res);
    })
    .catch((err) => {
      console.error('Metadata error:', err.message);
      if (!res.headersSent) res.status(404).send('File not found');
    });
});
