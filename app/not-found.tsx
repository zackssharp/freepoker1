import Link from "next/link";

import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="mx-auto flex w-full max-w-lg flex-1 flex-col items-center justify-center gap-4 px-4 py-20 text-center">
      <p className="text-primary font-mono text-sm">404</p>
      <h1 className="text-2xl font-semibold">No table here</h1>
      <p className="text-muted-foreground text-sm">
        That table has been broken down, or it belongs to another player.
      </p>
      <Button nativeButton={false} render={<Link href="/" />}>
        Back to the lobby
      </Button>
    </div>
  );
}
