import { Badge } from "@/components/ui/badge";

export function PageHeader({
  title,
  description,
  eyebrow,
  actions,
}: {
  title: string;
  description?: string;
  eyebrow?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4 border-b bg-gradient-to-b from-secondary/60 to-background px-6 py-8 sm:px-8">
      <div className="min-w-0">
        {eyebrow && (
          <Badge variant="outline" className="mb-2 rounded-full border-primary/30 bg-primary/5 text-[10px] font-medium uppercase tracking-widest text-primary">
            {eyebrow}
          </Badge>
        )}
        <h1 className="truncate text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
          {title}
        </h1>
        {description && (
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  );
}