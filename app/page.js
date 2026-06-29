import { requireAuth } from "@/lib/auth";
import DashboardClient from "./DashboardClient";

export default async function Home() {
  const authenticated = await requireAuth();
  return <DashboardClient initialAuthenticated={authenticated} />;
}
