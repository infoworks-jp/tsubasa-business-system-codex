export function isProtectedDashboardPath(pathname: string) {
  return (
    pathname === "/" ||
    pathname.startsWith("/products") ||
    pathname.startsWith("/ocr") ||
    pathname.startsWith("/quality")
  );
}

export function isProtectedApiPath(pathname: string) {
  return pathname.startsWith("/api/products") || pathname.startsWith("/api/ocr");
}
