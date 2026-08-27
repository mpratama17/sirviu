import { redirect } from "next/navigation";

/**
 * Root path tidak punya UI sendiri — `proxy.ts` sudah redirect ke /login
 * bila belum authenticated, jadi sampai di sini berarti sudah login.
 */
export default function RootPage() {
  redirect("/dashboard");
}
