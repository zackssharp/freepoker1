"use client";

import { RotateCcw } from "lucide-react";
import { useEffect } from "react";

import { Button } from "@/components/ui/button";

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto flex w-full max-w-lg flex-1 flex-col items-center justify-center gap-4 px-4 py-20 text-center">
      <h1 className="text-2xl font-semibold">The table went quiet</h1>
      <p className="text-muted-foreground text-sm text-pretty">
        Something failed on the server. If this is a fresh checkout, the usual
        cause is a missing <code className="font-mono">DATABASE_URL</code> — see
        the README for the Neon setup.
      </p>
      {error.digest && (
        <p className="text-muted-foreground font-mono text-xs">
          digest {error.digest}
        </p>
      )}
      <Button onClick={reset}>
        <RotateCcw className="size-4" aria-hidden />
        Try again
      </Button>
    </div>
  );
}
