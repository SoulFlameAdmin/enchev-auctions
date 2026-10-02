import { NextRequest, NextResponse } from "next/server";
import {
  REQUEST_CORRELATION_HEADER,
  resolveRequestCorrelationId,
} from "@enchev/contracts";

export function proxy(request: NextRequest) {
  // The cinematic preview must render the authorized Forge snapshot as the
  // top-level document. Rendering it inside an iframe causes Edge/Chromium
  // to show "This page couldn't load" on protected preview deployments.
  if (request.nextUrl.pathname === "/") {
    const target = request.nextUrl.clone();
    target.pathname = "/api/forge-mirror";
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
