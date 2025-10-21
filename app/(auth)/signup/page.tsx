import { AuthForm, SignupFooter } from "@/components/auth-form";
import { signUp } from "@/lib/supabase/auth";

export const metadata = { title: "Create account • Merch Watcher" };

export default function SignupPage() {
  return (
    <AuthForm
      action={signUp}
      submitLabel="Create account"
      footer={<SignupFooter />}
      passwordAutoComplete="new-password"
      passwordMinLength={8}
    />
  );
}
