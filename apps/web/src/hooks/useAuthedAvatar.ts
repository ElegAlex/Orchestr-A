import { useEffect, useState } from "react";
import api from "@/lib/api";

/**
 * SEC-016 — uploaded avatars are now served behind the authenticated
 * `/api/uploads/*` route. An `<img src>` cannot carry the `Authorization`
 * header, so uploaded avatars must be fetched with the axios client (which
 * attaches the Bearer token + handles 401-refresh) and turned into an object
 * URL.
 *
 * Object URLs are cached at module scope keyed by `avatarUrl` and deliberately
 * NOT revoked: the same avatar is rendered by many components at once (lists,
 * chips, the nav bar), so per-component revocation would break still-mounted
 * consumers. The cache is bounded by the number of distinct avatars seen this
 * session, and is cleared on a full page reload (logout redirects).
 *
 * Preset SVGs (`/avatars/*.svg`) and any absolute `http(s)` avatar are returned
 * unchanged — they are public static assets and need no Bearer header.
 */
const UPLOADS_PREFIX = "/api/uploads/";

const blobUrlCache = new Map<string, string>();
const inflight = new Map<string, Promise<string>>();

function needsAuthFetch(avatarUrl: string): boolean {
  return avatarUrl.startsWith(UPLOADS_PREFIX);
}

async function loadAuthedBlob(avatarUrl: string): Promise<string> {
  const cached = blobUrlCache.get(avatarUrl);
  if (cached) return cached;

  const pending = inflight.get(avatarUrl);
  if (pending) return pending;

  // axios baseURL is "/api"; avatarUrl is "/api/uploads/..." — strip the
  // duplicate prefix so the request resolves to "/api/uploads/...".
  const path = avatarUrl.replace(/^\/api/, "");
  const promise = api
    .get(path, { responseType: "blob" })
    .then((res) => {
      const objectUrl = URL.createObjectURL(res.data as Blob);
      blobUrlCache.set(avatarUrl, objectUrl);
      inflight.delete(avatarUrl);
      return objectUrl;
    })
    .catch((err) => {
      inflight.delete(avatarUrl);
      throw err;
    });

  inflight.set(avatarUrl, promise);
  return promise;
}

/**
 * Resolve a renderable `src` for a user's `avatarUrl`.
 * - Uploaded avatar (`/api/uploads/*`): authenticated fetch → object URL.
 * - Preset SVG / external URL: returned unchanged.
 * - Falsy / fetch failure: `src` is null and `failed` is true → the caller
 *   falls back to a preset or the monogram.
 */
export function useAuthedAvatar(avatarUrl: string | null | undefined): {
  src: string | null;
  failed: boolean;
} {
  const needsFetch = !!avatarUrl && needsAuthFetch(avatarUrl);

  // Resolve synchronously during render (no setState-in-effect): passthrough
  // URLs and already-cached object URLs need no async work.
  const immediate: string | null = !avatarUrl
    ? null
    : needsFetch
      ? (blobUrlCache.get(avatarUrl) ?? null)
      : avatarUrl;

  // Async fetch result, tagged with the avatarUrl it belongs to so a stale
  // resolution from a previous avatarUrl is ignored after the prop changes.
  const [fetched, setFetched] = useState<{
    url: string;
    src: string | null;
    failed: boolean;
  } | null>(null);

  useEffect(() => {
    if (!avatarUrl || !needsFetch || blobUrlCache.has(avatarUrl)) {
      return; // nothing to fetch
    }
    let active = true;
    loadAuthedBlob(avatarUrl)
      .then((objectUrl) => {
        if (active)
          setFetched({ url: avatarUrl, src: objectUrl, failed: false });
      })
      .catch(() => {
        if (active) setFetched({ url: avatarUrl, src: null, failed: true });
      });
    return () => {
      active = false;
    };
  }, [avatarUrl, needsFetch]);

  const fetchedForCurrent =
    fetched && fetched.url === avatarUrl ? fetched : null;

  return {
    src: immediate ?? fetchedForCurrent?.src ?? null,
    failed: fetchedForCurrent?.failed ?? false,
  };
}
