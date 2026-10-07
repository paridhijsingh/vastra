import { AuthForm } from "@/components/AuthForm";

type SearchParams = Promise<{ registered?: string; next?: string }>;

export default async function SignInPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const nextPath =
    typeof params.next === "string" && params.next.startsWith("/")
      ? params.next
      : "/";
  const initialMessage =
    params.registered === "1"
      ? "Account created. Sign in with your username and password."
      : undefined;

  return (
    <AuthForm mode="signin" nextPath={nextPath} initialMessage={initialMessage} />
  );
}
