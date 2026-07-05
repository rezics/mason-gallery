const R2_ROUTE_PREFIX = "/r2/";

type AssetBinding = {
  fetch(request: Request): Promise<Response>;
};

type R2ObjectBody = {
  body?: ReadableStream;
  httpEtag: string;
  writeHttpMetadata(headers: Headers): void;
};

type R2BucketBinding = {
  get(
    key: string,
    options?: {
      onlyIf?: Headers;
      range?: Headers;
    },
  ): Promise<R2ObjectBody | null>;
};

interface Env {
  ASSETS: AssetBinding;
  MASON_GALLERY_BUCKET: R2BucketBinding;
  R2_PUBLIC_PREFIX: string;
}

function getR2Key(url: URL, publicPrefix: string): string | null {
  if (!url.pathname.startsWith(R2_ROUTE_PREFIX)) return null;

  const key = decodeURIComponent(url.pathname.slice(R2_ROUTE_PREFIX.length));
  if (!key || key.includes("..")) return null;
  if (publicPrefix && !key.startsWith(publicPrefix)) return null;

  return key;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const key = getR2Key(url, env.R2_PUBLIC_PREFIX);

    if (!key) {
      return env.ASSETS.fetch(request);
    }

    if (request.method !== "GET" && request.method !== "HEAD") {
      return new Response("Method Not Allowed", {
        status: 405,
        headers: { Allow: "GET, HEAD" },
      });
    }

    const object = await env.MASON_GALLERY_BUCKET.get(key, {
      onlyIf: request.headers,
      range: request.headers,
    });

    if (object === null) {
      return new Response("Not Found", { status: 404 });
    }

    const headers = new Headers();
    object.writeHttpMetadata(headers);
    headers.set("etag", object.httpEtag);
    headers.set("cache-control", "public, max-age=31536000, immutable");

    if (!headers.has("content-type")) {
      headers.set("content-type", "application/octet-stream");
    }

    return new Response(request.method === "HEAD" ? null : object.body, {
      status: object.body ? 200 : 412,
      headers,
    });
  },
};