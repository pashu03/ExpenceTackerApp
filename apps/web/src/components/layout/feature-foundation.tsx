import { Sparkles } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "./page-header";

export function FeatureFoundation({
  title,
  description,
  nextStep,
}: {
  title: string;
  description: string;
  nextStep: string;
}) {
  return (
    <>
      <PageHeader title={title} description={description} />
      <Card>
        <CardContent className="grid min-h-72 place-items-center text-center">
          <div className="grid max-w-md justify-items-center gap-4">
            <span className="grid size-12 place-items-center rounded-2xl bg-[var(--brand-soft)] text-[var(--brand)]">
              <Sparkles size={22} aria-hidden="true" />
            </span>
            <div>
              <h2 className="text-lg font-semibold">Foundation ready</h2>
              <p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">{nextStep}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </>
  );
}

