import { AuthCallback } from "@/components/auth-callback";

export default function AuthCallbackPage() {
  return (
    <main className="login-page">
      <section className="login-form-wrap">
        <div className="login-form">
          <p className="eyebrow">Secure access</p>
          <h1>メールリンク認証</h1>
          <AuthCallback required />
        </div>
      </section>
    </main>
  );
}
