import { db } from "@/lib/db";
import { reunions } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function Home() {
  const activeReunions = await db
    .select()
    .from(reunions)
    .where(eq(reunions.isActive, true))
    .limit(1);

  if (activeReunions.length > 0) {
    redirect(`/${activeReunions[0].slug}`);
  }

  return (
    <div className="flex min-h-screen items-center justify-center">
      <p className="text-gray-500">No active reunions at the moment.</p>
    </div>
  );
}
