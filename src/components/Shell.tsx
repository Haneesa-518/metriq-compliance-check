import { Link, useRouterState } from "@tanstack/react-router";
import { ScanLine, FileSearch, BookText, Home, History } from "lucide-react";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/", label: "Overview", icon: Home },
  { to: "/check", label: "Compliance Check", icon: FileSearch },
  { to: "/history", label: "History", icon: History },
  { to: "/rules", label: "Rule Library", icon: BookText },
];

export function Navbar({ right }: { right?: React.ReactNode }) {
  const path = useRouterState({ select: (s) => s.location.pathname });
  return (
    <header className="no-print sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-[1600px] items-center gap-4 px-4 sm:px-6">
        <Link to="/" className="flex items-center gap-2">
          <span className="flex size-8 items-center justify-center rounded bg-primary text-primary-foreground">
            <ScanLine className="size-4" />
          </span>
          <span className="text-sm font-semibold tracking-tight">
            MetriQ
            <span className="ml-2 hidden text-xs font-normal text-muted-foreground sm:inline">
              Legal Metrology Compliance Checker
            </span>
          </span>
        </Link>
        <nav className="ml-4 hidden items-center gap-1 md:flex">
          {NAV.map((n) => (
            <Link
              key={n.to}
              to={n.to}
              className={cn(
                "rounded px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground",
                path === n.to && "bg-accent text-foreground",
              )}
            >
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-2">{right}</div>
      </div>
    </header>
  );
}

export function Sidebar({ items }: { items: { id: string; label: string }[] }) {
  return (
    <nav className="no-print hidden w-52 shrink-0 lg:block">
      <div className="sticky top-20 space-y-1">
        <p className="label-caps mb-3 px-3">Sections</p>
        {items.map((i) => (
          <a
            key={i.id}
            href={`#${i.id}`}
            className="block rounded px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            {i.label}
          </a>
        ))}
      </div>
    </nav>
  );
}

export function Footer() {
  return (
    <footer className="mt-16 border-t border-border py-8">
      <div className="mx-auto max-w-[1600px] space-y-2 px-4 text-xs text-muted-foreground sm:px-6">
        <p className="font-semibold text-foreground">MetriQ — compliance-assistance prototype</p>
        <p className="max-w-3xl leading-relaxed">
          This is a hackathon prototype. It does not provide legal advice, is not affiliated with or
          certified by any government body, and its output is not legally binding. Rule entries are
          marked <span className="font-mono">needs_verification</span> until confirmed against the
          official published documents. All results must be verified by a qualified
          authority/professional.
        </p>
      </div>
    </footer>
  );
}
