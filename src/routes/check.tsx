import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { AlertCircle, Link2, Play } from "lucide-react";
import { Navbar, Footer } from "@/components/Shell";
import { UploadZone, ImagePreview, AnalysisProgress, PROGRESS_STEPS, URL_PROGRESS_STEPS } from "@/components/Upload";
import { DisclaimerNote } from "@/components/Analysis";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { analyzeProduct, analyzeProductUrl, friendlyError, getDemoCases, runDemo } from "@/services/api";

export const Route = createFileRoute("/check")({
  validateSearch: (search: Record<string, unknown>): { demo?: boolean } =>
    search["demo"] === true || search["demo"] === "true" ? { demo: true } : {},
  head: () => ({
    meta: [
      { title: "Run a Compliance Check — MetriQ" },
      {
        name: "description",
        content:
          "Upload a JPG or PNG product label, or paste a public e-commerce product URL, to extract declarations and run MetriQ's deterministic Legal Metrology rule checks.",
      },
      { property: "og:title", content: "Run a Compliance Check — MetriQ" },
      {
        property: "og:description",
        content:
          "Analyze a product label image or a public e-commerce product listing with prototype package-declaration checks.",
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
  const [url, setUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState(-1);
  const [mode, setMode] = useState<"image" | "url">("image");

  const busy = step >= 0;
  const steps = mode === "url" ? URL_PROGRESS_STEPS : PROGRESS_STEPS;

  function startTicker(total: number) {
    return window.setInterval(() => setStep((s) => (s < total - 2 ? s + 1 : s)), 900);
  }

  async function handleAnalyze() {
    if (!image) return;
    setError(null);
    setMode("image");
    setStep(0);
    const ticker = startTicker(PROGRESS_STEPS.length);
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

  async function handleAnalyzeUrl() {
    const value = url.trim();
    if (!value) {
      setError("Please enter a product URL.");
      return;
    }
    setError(null);
    setStep(0);
    const ticker = startTicker(URL_PROGRESS_STEPS.length);
    try {
      const record = await analyzeProductUrl(value);
      window.clearInterval(ticker);
      setStep(URL_PROGRESS_STEPS.length);
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
          <h1 className="text-xl font-semibold">Check product compliance</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Analyze a product package image or a publicly accessible e-commerce product listing.
            Both routes use the same deterministic rule engine. Nothing is stored on a server — the
            analysis record is kept in your browser session.
          </p>
          <DisclaimerNote className="mt-4 max-w-2xl" />

          <Tabs
            value={mode}
            onValueChange={(v) => {
              if (busy) return;
              setMode(v as "image" | "url");
              setError(null);
            }}
            className="mt-6"
          >
            <TabsList>
              <TabsTrigger value="image">Upload image</TabsTrigger>
              <TabsTrigger value="url">Product URL</TabsTrigger>
            </TabsList>

            <TabsContent value="image" className="mt-4 space-y-4">
              {!image ? (
                <UploadZone
                  disabled={busy}
                  onError={(m) => setError(m)}
                  onFile={(u, name) => {
                    setError(null);
                    setImage({ url: u, name });
                  }}
                />
              ) : (
                <ImagePreview
                  src={image.url}
                  name={image.name}
                  onClear={busy ? undefined : () => setImage(null)}
                />
              )}
              {!busy && (
                <Button size="lg" disabled={!image} onClick={handleAnalyze}>
                  Analyze label
                </Button>
              )}
            </TabsContent>

            <TabsContent value="url" className="mt-4 space-y-4">
              <div className="panel space-y-3 p-5">
                <label htmlFor="product-url" className="label-caps">
                  Product URL
                </label>
                <div className="flex flex-col gap-3 sm:flex-row">
                  <div className="relative flex-1">
                    <Link2 className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="product-url"
                      type="url"
                      inputMode="url"
                      placeholder="Paste e-commerce product URL here…"
                      className="pl-9"
                      value={url}
                      disabled={busy}
                      onChange={(e) => setUrl(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !busy) void handleAnalyzeUrl();
                      }}
                    />
                  </div>
                  <Button size="lg" disabled={busy} onClick={handleAnalyzeUrl}>
                    Analyze URL
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Enter a publicly accessible product listing URL. MetriQ analyzes the information
                  available on the product page and uses available product images when possible. Pages
                  that require sign-in or block automated access cannot be analyzed — upload a
                  screenshot instead.
                </p>
                <p className="text-xs text-muted-foreground">
                  An online listing is not required to display every physical-package declaration, so
                  declarations that only appear on the pack are flagged for human verification rather
                  than treated as failures.
                </p>
              </div>
            </TabsContent>
          </Tabs>

          <div className="mt-4 space-y-4">
            {error && (
              <div className="flex gap-2 rounded-md border border-fail/40 bg-fail/10 px-3 py-2.5 text-sm text-fail">
                <AlertCircle className="mt-0.5 size-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}
            {busy && <AnalysisProgress step={step} steps={steps} />}
          </div>
        </section>

        <aside id="demo" className={demo ? "order-first lg:order-none" : undefined}>
          <div className="panel p-5">
            <p className="label-caps">Demo mode</p>
            <p className="mt-2 text-sm text-muted-foreground">
              Runs entirely offline with synthetic sample text — no image, URL, API key or external
              site needed. Sample data is fictional and labelled as such.
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
