import { notFound, redirect } from "next/navigation";

import { PokerTable } from "@/components/table/poker-table";
import { getTableView } from "@/lib/queries";
import { getCurrentUser } from "@/lib/session";

export const metadata = { title: "Table" };

export default async function TablePage(props: PageProps<"/table/[gameId]">) {
  const { gameId } = await props.params;

  const user = await getCurrentUser();
  if (!user) redirect("/");

  const view = await getTableView(gameId, user.id);
  if (!view) notFound();

  return <PokerTable initialView={view} />;
}
