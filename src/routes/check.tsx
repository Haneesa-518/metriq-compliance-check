import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { AlertCircle, Play } from "lucide-react";
import { Navbar, Footer } from "@/components/Shell";
import { UploadZone, ImagePreview, AnalysisProgress, PROGRESS_STEPS } from "@/components/Upload";
import { DisclaimerNote } from "@/components/Analysis";
import { Button } from "@/components/ui/button";
import { analyzeProduct, friendlyError, getDemoCases, runDemo } from "@/services/api";

export const Route = createFileRoute("/check")({
  validateSearch: (search: Record<string, unknown>) => ({
    demo: search.demo === true || search.demo === "true" ? true : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Run a Compliance Check — MetriQ" },
      {
        name: "description",
        content:
          "Upload a JPG or PNG product label to extract declarations and run MetriQ's deterministic Legal Metrology rule checks, or try the synthetic demo cases.",
      },
      { property: "og:title", content: "Run a Compliance Check — MetriQ" },
      {
        property: "og:description",
        content: "Upload a product label image and run prototype package-declaration checks.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CheckPage,
});

function CheckPage() {
  const navigate = useNavigate();
  const { demo } = Route.useSearch();
  const [image, setImage] = useState<{ url: string; name: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState(-1);

  const busy = step >= 0;

  async function handleAnalyze() {
    if (!image) return;
    setError(null);
    setStep(0);
    const ticker = window.setInterval(
      () => setStep((s) => (s < PROGRESS_STEPS.length - 2 ? s + 1 : s)),
      700,
    );
    try {
      const record = await analyzeProduct(image.url);
      window.clearInterval(ticker);
      setStep(PROGRESS_STEPS.length);
      navigate({ to: "/analysis/$id", params: { id: record.id } });
    } catch (err) {
      window.clearInterval(ticker);
      setStep(-1);
      setError(friendlyError(err));
    }
  }

  function handleDemo(id: string) {
    setError(null);
    try {
      const demoCase = getDemoCases().find((d) => d.id === id);
      if (!demoCase) throw new Error("Demo case not found");
      const record = runDemo(demoCase);
      navigate({ to: "/analysis/$id", params: { id: record.id } });
    } catch (err) {
      setError(friendlyError(err));
    }
  }

  return (
    <div className="min-h-screen">
      <Navbar
        right={
          <Button asChild size="sm" variant="secondary">
            <Link to="/rules">Rule library</Link>
          </Button>
        }
      />
      <main className="mx-auto grid max-w-[1600px] gap-8 px-4 py-10 sm:px-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        <section>
          <h1 className="text-xl font-semibold">Upload a product label</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            The image is sent for text extraction only and is not stored on a server. The analysis
            record is kept in your browser session.
          </p>
          <DisclaimerNote className="mt-4 max-w-2xl" />

          <div className="mt-6 space-y-4">
            {!image ? (
              <UploadZone
                disabled={busy}
                onError={(m) => setError(m)}
                onFile={(url, name) => {
                  setError(null);
                  setImage({ url, name });
                }}
              />
            ) : (
              <ImagePreview
                src={image.url}
                name={image.name}
                onClear={busy ? undefined : () => setImage(null)}
              />
            )}

            {error && (
              <div className="flex gap-2 rounded-md border border-fail/40 bg-fail/10 px-3 py-2.5 text-sm text-fail">
                <AlertCircle className="mt-0.5 size-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {busy ? (
              <AnalysisProgress step={step} />
            ) : (
              <Button size="lg" disabled={!image} onClick={handleAnalyze}>
                Analyze label
              </Button>
            )}
          </div>
        </section>

        <aside id="demo" className={demo ? "order-first lg:order-none" : undefined}>
          <div className="panel p-5">
            <p className="label-caps">Demo mode</p>
            <p className="mt-2 text-sm text-muted-foreground">
              Runs entirely offline with synthetic sample text — no image, API key or external service
              needed. Sample data is fictional and labelled as such.
            </p>
            <div className="mt-4 space-y-3">
              {getDemoCases().map((d) => (
                <div key={d.id} className="rounded-md border border-border bg-surface p-3">
                  <p className="text-sm font-medium">{d.label}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{d.description}</p>
                  <Button
                    size="sm"
                    variant="secondary"
                    className="mt-3"
                    onClick={() => handleDemo(d.id)}
                  >
                    <Play className="mr-1 size-3.5" /> Run demo
                  </Button>
                </div>
              ))}
            </div>
          </div>
        </aside>
      </main>
      <Footer />
    </div>
  );
}
