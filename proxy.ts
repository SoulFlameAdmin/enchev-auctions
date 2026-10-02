import { NextRequest, NextResponse } from "next/server";
import forgeImagePaths from "./config/forge-image-paths.json";
import {
  REQUEST_CORRELATION_HEADER,
  resolveRequestCorrelationId,
} from "@enchev/contracts";

export function proxy(request: NextRequest) {
  if (request.nextUrl.pathname.startsWith("/forge/sanity/")) {
    const key = request.nextUrl.pathname.slice("/forge/sanity".length);
    const image = (forgeImagePaths as Record<string, string>)[key];
    if (image) return NextResponse.rewrite(new URL(image, request.url));
    return new NextResponse(null, { status: 404 });
  }
  // The supplied standalone frontend owns the homepage DOM and animation runtime.
  // Keep its Next assets under /forge so auction application chunks stay isolated.
  if (request.nextUrl.pathname === "/") {
    return NextResponse.rewrite(new URL("/forge/index.html", request.url));
  }
  const correlationId = resolveRequestCorrelationId(
    request.headers.get(REQUEST_CORRELATION_HEADER),
  );

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set(REQUEST_CORRELATION_HEADER, correlationId);

  const response = NextResponse.next({
    request: { headers: requestHeaders },
  });
  response.headers.set(REQUEST_CORRELATION_HEADER, correlationId);
  return response;
}

export const config = {
  matcher: ["/", "/api/:path*", "/forge/sanity/:path*"],
};
