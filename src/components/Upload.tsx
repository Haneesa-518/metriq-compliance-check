import { useCallback, useRef, useState } from "react";
import { Upload, X, ImageIcon, CheckCircle2, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const MAX_BYTES = 8 * 1024 * 1024;
const ACCEPTED = ["image/jpeg", "image/jpg", "image/png"];

export function UploadZone({
  onFile,
  onError,
  disabled,
}: {
  onFile: (dataUrl: string, name: string) => void;
  onError: (msg: string) => void;
  disabled?: boolean;
}) {
  const [over, setOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handle = useCallback(
    (file: File | undefined) => {
      if (!file) return;
      if (!ACCEPTED.includes(file.type.toLowerCase())) {
        onError("Unsupported file type. Please upload a JPG, JPEG or PNG image.");
        return;
      }
      if (file.size > MAX_BYTES) {
        onError("That image is larger than 8 MB. Please upload a smaller file.");
        return;
      }
      const reader = new FileReader();
      reader.onerror = () => onError("The file could not be read. Please try another image.");
      reader.onload = () => {
        const result = typeof reader.result === "string" ? reader.result : "";
        if (!result.startsWith("data:image/")) {
          onError("The file does not appear to be a valid image.");
          return;
        }
        onFile(result, file.name);
      };
      reader.readAsDataURL(file);
    },
    [onFile, onError],
  );

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        if (!disabled) handle(e.dataTransfer.files?.[0]);
      }}
      className={cn(
        "flex flex-col items-center justify-center rounded-lg border border-dashed border-border bg-surface px-6 py-14 text-center transition-colors",
        over && "border-primary bg-primary/5",
        disabled && "pointer-events-none opacity-60",
      )}
    >
      <span className="mb-4 flex size-12 items-center justify-center rounded-full bg-accent">
        <Upload className="size-5 text-primary" />
      </span>
      <p className="text-sm font-medium">Drag and drop a product label image</p>
      <p className="mt-1 text-xs text-muted-foreground">JPG, JPEG or PNG · up to 8 MB</p>
      <Button
        variant="secondary"
        className="mt-5"
        onClick={() => inputRef.current?.click()}
        type="button"
      >
        Browse file
      </Button>
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg"
        className="hidden"
        onChange={(e) => {
          handle(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
    </div>
  );
}

export function ImagePreview({
  src,
  name,
  onClear,
}: {
  src: string;
  name?: string;
  onClear?: () => void;
}) {
  return (
    <div className="panel overflow-hidden">
      <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
        <div className="flex min-w-0 items-center gap-2">
          <ImageIcon className="size-4 shrink-0 text-muted-foreground" />
          <span className="truncate text-xs text-muted-foreground">{name ?? "Uploaded label"}</span>
        </div>
        {onClear && (
          <button
            type="button"
            onClick={onClear}
            aria-label="Remove image"
            className="rounded p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <X className="size-4" />
          </button>
        )}
      </div>
      <img src={src} alt="Uploaded product package label" className="max-h-[420px] w-full object-contain bg-background" />
    </div>
  );
}

export const PROGRESS_STEPS = [
  "Image received",
  "Extracting text",
  "Identifying declarations",
  "Applying compliance rules",
  "Preparing report",
];

export const URL_PROGRESS_STEPS = [
  "Fetching product page",
  "Extracting product information",
  "Analyzing available product images",
  "Running compliance checks",
  "Preparing report",
];

export function AnalysisProgress({ step, steps = PROGRESS_STEPS }: { step: number; steps?: string[] }) {
  return (
    <ol className="panel space-y-3 p-5">
      {steps.map((label, i) => {
        const done = i < step;
        const active = i === step;
        return (
          <li key={label} className="flex items-center gap-3 text-sm">
            {done ? (
              <CheckCircle2 className="size-4 text-pass" />
            ) : active ? (
              <Loader2 className="size-4 animate-spin text-primary" />
            ) : (
              <span className="size-4 rounded-full border border-border" />
            )}
            <span className={cn(done || active ? "text-foreground" : "text-muted-foreground")}>
              {label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
