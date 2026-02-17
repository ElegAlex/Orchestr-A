import { NextRequest, NextResponse } from "next/server";

const HOP_BY_HOP = new Set([
  "connection",
  "keep-alive",
  "transfer-encoding",
  "upgrade",
  "proxy-connection",
  "te",
  "trailer",
]);

function filterHeaders(headers: Headers): Record<string, string> {
  const out: Record<string, string> = {};
  headers.forEach((value, key) => {
    if (!HOP_BY_HOP.has(key.toLowerCase())) {
      out[key] = value;
    }
  });
  return out;
}

async function proxy(
  request: NextRequest,
  params: { path: string[] },
): Promise<NextResponse> {
  const apiUrl = process.env.API_URL || "http://localhost:4000";
  const pathSegment = params.path.join("/");
  const search = request.nextUrl.searchParams.toString();
  const target = `${apiUrl}/api/${pathSegment}${search ? `?${search}` : ""}`;

  const hasBody = request.method !== "GET" && request.method !== "HEAD";

  try {
    const response = await fetch(target, {
      method: request.method,
      headers: filterHeaders(request.headers),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ...(hasBody ? { body: request.body, duplex: "half" } : {}),
    } as RequestInit);

    return new NextResponse(response.body, {
      status: response.status,
      headers: filterHeaders(response.headers),
    });
  } catch (err) {
    console.error(`[api-proxy] ${request.method} ${target}`, err);
    return NextResponse.json({ error: "Bad Gateway" }, { status: 502 });
  }
}

type RouteContext = { params: Promise<{ path: string[] }> };

export async function GET(req: NextRequest, ctx: RouteContext) {
  return proxy(req, await ctx.params);
}
export async function POST(req: NextRequest, ctx: RouteContext) {
  return proxy(req, await ctx.params);
}
export async function PUT(req: NextRequest, ctx: RouteContext) {
  return proxy(req, await ctx.params);
}
export async function PATCH(req: NextRequest, ctx: RouteContext) {
  return proxy(req, await ctx.params);
}
export async function DELETE(req: NextRequest, ctx: RouteContext) {
  return proxy(req, await ctx.params);
}
