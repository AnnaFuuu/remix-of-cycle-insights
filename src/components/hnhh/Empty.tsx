import { Card } from "@/components/ui/card";

export function Empty({ title, description }: { title: string; description?: string }) {
  return (
    <Card className="flex flex-col items-center justify-center border-dashed p-10 text-center">
      <h3 className="text-base font-semibold text-foreground">{title}</h3>
      {description && <p className="mt-2 max-w-sm text-sm text-muted-foreground">{description}</p>}
    </Card>
  );
}