import { HomeExperience } from "@/components/HomeExperience";
import { getCurrentUser } from "@/lib/auth/session";

export default async function HomePage() {
  const user = await getCurrentUser();
  return <HomeExperience signedIn={user !== null} />;
}
