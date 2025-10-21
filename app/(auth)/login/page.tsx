import { AuthForm, LoginFooter } from "@/components/auth-form";
import { signIn } from "@/lib/supabase/auth";

export const metadata = { title: "Sign in • Merch Watcher" };

export default function LoginPage() {
  return <AuthForm action={signIn} submitLabel="Sign in" footer={<LoginFooter />} />;
}
