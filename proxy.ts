import { NextRequest, NextResponse } from "next/server";
import {
  REQUEST_CORRELATION_HEADER,
  resolveRequestCorrelationId,
} from "@enchev/contracts";

export function proxy(request: NextRequest) {
  if (
    request.nextUrl.pathname === "/" &&
    (process.env.VERCEL === "1" || process.env.FORGE_SNAPSHOT_PREVIEW === "1")
  ) {
    const target = request.nextUrl.clone();
    target.pathname = "/forge-snapshot/site/index.html";
    target.search = "";
    return NextResponse.rewrite(target);
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
  matcher: ["/", "/api/:path*"],
};
