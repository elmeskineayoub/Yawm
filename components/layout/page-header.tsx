import { ChevronRight } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

export type Crumb = { label: string; href: string };

/**
 * The page's serif title, with an optional breadcrumb above, a description or meta line below,
 * and page-level actions on the right (they wrap below the title on narrow screens).
 */
export function PageHeader({
  title,
  description,
  meta,
  breadcrumb,
  actions,
}: {
  title: ReactNode;
  description?: ReactNode;
  /** Small secondary line (status, dates). Rendered after the description. */
  meta?: ReactNode;
  breadcrumb?: Crumb[];
  actions?: ReactNode;
}) {
  return (
    <header className="mb-8">
      {breadcrumb && breadcrumb.length > 0 && (
        <nav aria-label="Breadcrumb" className="mb-2">
          <ol className="flex flex-wrap items-center gap-1 text-sm text-muted-foreground">
            {breadcrumb.map((crumb, index) => (
              <li key={crumb.href} className="flex min-w-0 items-center gap-1">
                {index > 0 && <ChevronRight aria-hidden className="size-3.5 shrink-0" />}
                <Link href={crumb.href} className="truncate hover:text-foreground hover:underline">
                  {crumb.label}
                </Link>
              </li>
            ))}
          </ol>
        </nav>
      )}
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
        <div className="min-w-0 flex-1 basis-64">
          <h1 className="page-title">{title}</h1>
          {description && <p className="mt-1.5 text-sm text-muted-foreground">{description}</p>}
          {meta && <div className="mt-1.5 text-sm text-muted-foreground">{meta}</div>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </header>
  );
}
