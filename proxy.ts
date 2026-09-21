import { NextRequest, NextResponse } from "next/server";
import {
  REQUEST_CORRELATION_HEADER,
  resolveRequestCorrelationId,
} from "@enchev/contracts";

export function proxy(request: NextRequest) {
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
  matcher: ["/api/:path*"],
};
