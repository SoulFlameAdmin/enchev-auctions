import fs from "node:fs";
import { API_QUERY_MAX_PAGE_SIZE, parseApiListQuery } from "../packages/contracts/src/http-schema.ts";

const config = JSON.parse(fs.readFileSync("config/enchev-pagination-filter-sort-contract.json", "utf8"));

function fail(message) { throw new Error("24.06 PAGINATION_FILTER_SORT FAIL: " + message); }
function requireTrue(condition, message) { if (!condition) fail(message); }
function requireThrows(fn, code) {
  let actual = "";
  try { fn(); } catch (error) { actual = String(error); }
  requireTrue(actual.includes(code), "expected " + code + " but got " + actual);
}

requireTrue(config.taskId === "24.06", "taskId drift");
requireTrue(config.pagination.defaultPage === 1, "default page drift");
requireTrue(config.pagination.defaultPageSize === 20, "default page size drift");
requireTrue(config.pagination.maxPageSize === API_QUERY_MAX_PAGE_SIZE, "max page size drift");

const defaults = parseApiListQuery("");
requireTrue(defaults.page === 1 && defaults.pageSize === 20, "default pagination failed");
requireTrue(Object.keys(defaults.filters).length === 0 && defaults.sort.length === 0, "empty query failed");

const parsed = parseApiListQuery(
  "page=3&pageSize=50&filter=status:live&filter=make:BMW&sort=year:desc&sort=make:asc",
  { allowedFilters: ["status", "make"], allowedSorts: ["year", "make"] },
);
requireTrue(parsed.page === 3 && parsed.pageSize === 50, "explicit pagination failed");
requireTrue(parsed.filters.status === "live" && parsed.filters.make === "BMW", "filter parse failed");
requireTrue(parsed.sort[0]?.field === "year" && parsed.sort[0]?.direction === "desc", "primary sort failed");
requireTrue(parsed.sort[1]?.field === "make" && parsed.sort[1]?.direction === "asc", "secondary sort failed");

if (process.argv.includes("--self-test")) {
  const cases = [
    [() => parseApiListQuery("page=0"), "API_QUERY_INVALID_PAGINATION"],
    [() => parseApiListQuery("pageSize=101"), "API_QUERY_INVALID_PAGINATION"],
    [() => parseApiListQuery("page=1&page=2"), "API_QUERY_DUPLICATE_PARAMETER"],
    [() => parseApiListQuery("cursor=x"), "API_QUERY_UNKNOWN_PARAMETER"],
    [() => parseApiListQuery("filter=bad"), "API_QUERY_INVALID_FILTER"],
    [() => parseApiListQuery("filter=status:live&filter=status:ended"), "API_QUERY_DUPLICATE_FILTER"],
    [() => parseApiListQuery("filter=secret:x", { allowedFilters: ["status"] }), "API_QUERY_FILTER_NOT_ALLOWED"],
    [() => parseApiListQuery("sort=year:sideways"), "API_QUERY_INVALID_SORT"],
    [() => parseApiListQuery("sort=secret:asc", { allowedSorts: ["year"] }), "API_QUERY_SORT_NOT_ALLOWED"],
    [() => parseApiListQuery("sort=year:asc&sort=year:desc"), "API_QUERY_DUPLICATE_SORT"],
  ];
  for (const [fn, code] of cases) requireThrows(fn, code);
  console.log("24.06 PAGINATION_FILTER_SORT_SELF_TEST PASS negative_cases=" + cases.length);
} else {
  console.log("24.06 PAGINATION_FILTER_SORT PASS default_page=1 default_page_size=20 max_page_size=100");
}
