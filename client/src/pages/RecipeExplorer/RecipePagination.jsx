import { Link } from "react-router-dom";
import { ChevronLeft, ChevronRight } from "lucide-react";

const controlClass =
  "flex h-10 w-10 items-center justify-center rounded-lg bg-zinc-800 text-zinc-400 transition hover:bg-zinc-700 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary";
const disabledClass =
  "flex h-10 w-10 items-center justify-center rounded-lg bg-zinc-800 text-zinc-600 opacity-40";

const RecipePagination = ({
  page,
  totalPages,
  pageNumbers,
  getPageHref,
  labels,
}) => (
  <nav
    aria-label={labels.pagination}
    className="mt-10 flex items-center justify-center gap-1.5"
  >
    {page > 1 ? (
      <Link
        to={getPageHref(page - 1)}
        aria-label={labels.previous}
        className={controlClass}
      >
        <ChevronLeft className="h-4 w-4" aria-hidden="true" />
      </Link>
    ) : (
      <span className={disabledClass} aria-hidden="true">
        <ChevronLeft className="h-4 w-4" />
      </span>
    )}

    {pageNumbers.map((pageNumber, index) =>
      pageNumber === "..." ? (
        <span
          key={`dots-${index}`}
          className="w-8 text-center text-zinc-500"
          aria-hidden="true"
        >
          ...
        </span>
      ) : pageNumber === page ? (
        <span
          key={pageNumber}
          aria-current="page"
          aria-label={`${labels.page} ${pageNumber}`}
          className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-sm font-semibold text-white shadow-lg shadow-primary/30"
        >
          {pageNumber}
        </span>
      ) : (
        <Link
          key={pageNumber}
          to={getPageHref(pageNumber)}
          aria-label={`${labels.page} ${pageNumber}`}
          className={`${controlClass} text-sm font-semibold`}
        >
          {pageNumber}
        </Link>
      ),
    )}

    {page < totalPages ? (
      <Link
        to={getPageHref(page + 1)}
        aria-label={labels.next}
        className={controlClass}
      >
        <ChevronRight className="h-4 w-4" aria-hidden="true" />
      </Link>
    ) : (
      <span className={disabledClass} aria-hidden="true">
        <ChevronRight className="h-4 w-4" />
      </span>
    )}
  </nav>
);

export default RecipePagination;
