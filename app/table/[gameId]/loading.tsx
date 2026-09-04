import { Loader2 } from "lucide-react";

export default function TableLoading() {
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 items-center justify-center px-4 py-20">
      <p className="text-muted-foreground flex items-center gap-2 text-sm">
        <Loader2 className="size-4 animate-spin" aria-hidden />
        Bringing the table up…
      </p>
    </div>
  );
}
