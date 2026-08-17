/**
 * Vercel serverless PDF proxy
 * GET /api/proxy?url=ENCODED_FIREBASE_STORAGE_URL
 *
 * Fetches PDF from Firebase Storage server-side and relays it
 * with embed-friendly headers (no X-Frame-Options blocking).
 */
export default async function handler(req, res) {
  const url = req.query.url;

  if (!url) {
    return res.status(400).send('Missing ?url= parameter');
  }

  // Only allow Firebase Storage URLs
  if (
    !url.startsWith('https://firebasestorage.googleapis.com/') &&
    !url.startsWith('https://storage.googleapis.com/')
  ) {
    return res.status(403).send('Only Firebase Storage URLs are allowed');
  }

  try {
    const upstream = await fetch(url, {
      headers: {
        // Pass through auth headers if present
        ...(req.headers.authorization && { authorization: req.headers.authorization }),
      },
    });

    if (!upstream.ok) {
      return res.status(upstream.status).send(`Upstream error: ${upstream.status}`);
    }

    const contentType = upstream.headers.get('content-type') || 'application/pdf';
    const contentLength = upstream.headers.get('content-length');
    const buffer = await upstream.arrayBuffer();

    // Set embed-friendly headers
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=86400');
    res.setHeader('Access-Control-Allow-Origin', '*');
    // NO X-Frame-Options = embeddable in iframes
    if (contentLength) res.setHeader('Content-Length', contentLength);

    return res.status(200).send(Buffer.from(buffer));
  } catch (err) {
    return res.status(502).send(`Proxy error: ${err.message}`);
  }
}
