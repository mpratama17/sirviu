import { GoogleSignInButton } from "@/components/auth/google-sign-in-button";

export default async function LoginPage({
  searchParams,
}: PageProps<"/login">) {
  const params = await searchParams;
  const error = typeof params.error === "string" ? params.error : null;

  return (
    <div className="flex min-h-svh flex-col items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm rounded-lg border border-border bg-card p-8 shadow-card">
        <div className="flex flex-col items-center gap-2 text-center">
          <span className="text-2xl font-semibold tracking-tight text-foreground">
            SIRVIU
          </span>
          <p className="text-sm text-muted-foreground">
            Sistem Informasi Reviu Berjenjang
          </p>
        </div>

        <div className="mt-8">
          <GoogleSignInButton />
          {error ? (
            <p role="alert" className="mt-3 text-center text-sm text-destructive">
              {error}
            </p>
          ) : null}
        </div>
      </div>

      <p className="mt-6 text-center text-xs text-text-muted">
        © {new Date().getFullYear()} Inspektorat — Internal use only.
      </p>
    </div>
  );
}
