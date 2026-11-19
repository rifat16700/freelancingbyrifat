import { useState } from "react";
import { AlertCircle, ArrowRight, Check, KeyRound, Lock, Mail, Moon, RefreshCw, ShieldCheck, Smartphone, Sun } from "lucide-react";
import { Button, Field, Input } from "../components/ui";
import { LogoIcon } from "../nav";
import { useStore } from "../store";
import { proxyFetch } from "../lib/api";
import { cn } from "../utils/cn";
import type { AuthUser } from "../types";

export function Login({ onDone }: { onDone: (user: AuthUser) => void }) {
  const { settings, themeMode, toggleTheme } = useStore();
  const [step, setStep] = useState<0 | 1 | 2>(0);
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [pin, setPin] = useState("");
  const [otp, setOtp] = useState("");
  const [challengeId, setChallengeId] = useState("");
  const [otpTarget, setOtpTarget] = useState("Telegram");
  const [infoMsg, setInfoMsg] = useState("");
  const [errMsg, setErrMsg] = useState("");
  const [busy, setBusy] = useState(false);

  const steps = [
    { icon: Mail, label: "Account" },
    { icon: KeyRound, label: "Security PIN" },
    { icon: Smartphone, label: "Telegram OTP" },
  ];

  const submitCredentials = async (withPin?: string) => {
    setErrMsg("");
    setInfoMsg("");
    if (!email.trim() || !pass) {
      setErrMsg("ইউজারনেম/ইমেইল এবং পাসওয়ার্ড দিন।");
      return;
    }
    setBusy(true);
    try {
      const res = await proxyFetch("/admin-login", {
        email: email.trim(),
        username: email.trim(),
        password: pass,
        security_pin: withPin ?? pin,
      });

      if (res?.require_pin) {
        setStep(1);
        setInfoMsg(res.error || "আপনার Master Security PIN দিন।");
        return;
      }

      if (res?.require_otp && res?.challenge_id) {
        setChallengeId(String(res.challenge_id));
        setOtpTarget(String(res.otp_target || "Telegram"));
        setInfoMsg(String(res.message || "আপনার Telegram-এ 6-ডিজিটের OTP পাঠানো হয়েছে।"));
        setStep(2);
        return;
      }

      if (res?.success && res?.token) {
        localStorage.setItem("admin_token", String(res.token));
        if (res.expires_at) localStorage.setItem("admin_token_exp", String(res.expires_at));
        onDone({
          email: String(res.user?.email || email.trim()),
          role: String(res.user?.role || "master_admin"),
          permissions: res.user?.permissions || ["*"],
        });
        return;
      }

      setErrMsg(res?.error || "ভুল ইউজারনেম বা পাসওয়ার্ড প্রদান করা হয়েছে!");
    } catch (e: any) {
      setErrMsg(e?.message || "সার্ভারের সাথে সংযোগ করা যায়নি।");
    } finally {
      setBusy(false);
    }
  };

  const submitOtp = async () => {
    setErrMsg("");
    if (otp.trim().length < 6) {
      setErrMsg("৬-ডিজিটের Telegram OTP কোড দিন।");
      return;
    }
    setBusy(true);
    try {
      const res = await proxyFetch("/admin-login", {
        challenge_id: challengeId,
        otp_code: otp.trim(),
      });
      if (res?.success && res?.token) {
        localStorage.setItem("admin_token", String(res.token));
        if (res.expires_at) localStorage.setItem("admin_token_exp", String(res.expires_at));
        onDone({
          email: String(res.user?.email || email.trim()),
          role: String(res.user?.role || "master_admin"),
          permissions: res.user?.permissions || ["*"],
        });
        return;
      }
      setErrMsg(res?.error || "ভুল অথবা মেয়াদোত্তীর্ণ OTP কোড!");
    } catch (e: any) {
      setErrMsg(e?.message || "OTP যাচাই করা যায়নি।");
    } finally {
      setBusy(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (step === 0) submitCredentials("");
    else if (step === 1) submitCredentials(pin);
    else submitOtp();
  };

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="relative hidden overflow-hidden bg-slate-950 p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="absolute -left-24 top-1/3 h-96 w-96 rounded-full bg-indigo-600/40 blur-3xl" />
        <div className="absolute -right-10 bottom-0 h-80 w-80 rounded-full bg-violet-600/30 blur-3xl" />
        <div className="relative flex items-center gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600">
            <LogoIcon size={22} />
          </div>
          <span className="text-lg font-bold">{settings.storeName || "Admin Control Center"}</span>
        </div>
        <div className="relative">
          <h1 className="text-4xl font-bold leading-tight">Run your whole shop<br />from one calm screen.</h1>
          <p className="mt-4 max-w-md text-slate-400">Orders, customers, stock, coupons, multi-brand storefronts and 90+ business insights — protected by AlwaysData 2FA.</p>
          <div className="mt-8 grid max-w-md grid-cols-3 gap-3">
            {[["2FA", "Telegram OTP"], ["PBKDF2", "Encrypted Auth"], ["D1 + R2", "Live Backend"]].map(([a, b]) => (
              <div key={b} className="rounded-2xl border border-white/10 bg-white/5 p-4"><div className="text-xl font-bold">{a}</div><div className="text-xs text-slate-400">{b}</div></div>
            ))}
          </div>
        </div>
        <div className="relative text-xs text-slate-500">Secured with AlwaysData Private Storage & Mandatory Telegram Bot 2FA</div>
      </div>

      <div className="relative flex items-center justify-center bg-slate-50 p-6">
        <button
          type="button"
          onClick={toggleTheme}
          title={themeMode === "dark" ? "Switch to Light Mode" : "Switch to Dark Mode"}
          className="absolute right-6 top-6 rounded-xl border border-slate-200 bg-white p-2.5 text-slate-600 shadow-sm hover:bg-slate-100"
        >
          {themeMode === "dark" ? <Sun size={18} className="text-amber-400" /> : <Moon size={18} />}
        </button>

        <div className="w-full max-w-md">
          <div className="mb-6 flex items-center justify-center gap-2">
            {steps.map((s, i) => (
              <div key={s.label} className="flex items-center gap-2">
                <div className={cn("grid h-9 w-9 place-items-center rounded-full text-sm transition", i < step ? "bg-emerald-500 text-white" : i === step ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/30" : "bg-slate-200 text-slate-500")}>
                  {i < step ? <Check size={16} /> : <s.icon size={16} />}
                </div>
                {i < 2 && <div className={cn("h-0.5 w-8 rounded", i < step ? "bg-emerald-500" : "bg-slate-200")} />}
              </div>
            ))}
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-xl shadow-slate-200/60">
            <div className="mb-6 flex items-center gap-3">
              <div className="grid h-11 w-11 place-items-center rounded-2xl bg-indigo-50 text-indigo-600"><ShieldCheck /></div>
              <div>
                <h2 className="text-xl font-bold text-slate-900">{["Admin Login", "Security PIN", "Telegram 2FA OTP"][step]}</h2>
                <p className="text-sm text-slate-500">
                  {[
                    "Sign in with your Master or Staff account",
                    "Enter your 4–8 digit Master Security PIN",
                    `Enter the 6-digit OTP sent to ${otpTarget}`,
                  ][step]}
                </p>
              </div>
            </div>

            {errMsg && (
              <div className="mb-4 flex items-start gap-2.5 rounded-2xl border border-rose-200 bg-rose-50 p-3.5 text-xs font-medium text-rose-700">
                <AlertCircle size={16} className="mt-0.5 shrink-0" />
                <span>{errMsg}</span>
              </div>
            )}
            {infoMsg && !errMsg && (
              <div className="mb-4 rounded-2xl border border-indigo-200 bg-indigo-50/70 p-3.5 text-xs font-medium text-indigo-800">
                {infoMsg}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {step === 0 && (
                <>
                  <Field label="Email / Username" required>
                    <Input
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      type="text"
                      placeholder="admin@yourdomain.com"
                      autoComplete="username"
                      autoFocus
                    />
                  </Field>
                  <Field label="Password" required>
                    <Input
                      value={pass}
                      onChange={(e) => setPass(e.target.value)}
                      type="password"
                      placeholder="••••••••"
                      autoComplete="current-password"
                    />
                  </Field>
                </>
              )}

              {step === 1 && (
                <Field label="Master Security PIN" hint="4–8 digit numeric security PIN">
                  <Input
                    value={pin}
                    onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
                    inputMode="numeric"
                    maxLength={8}
                    placeholder="••••"
                    className="text-center text-xl tracking-[.5em]"
                    autoFocus
                  />
                </Field>
              )}

              {step === 2 && (
                <Field label="6-digit Telegram OTP" hint="Check your Telegram bot message (valid for 5 minutes)">
                  <Input
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                    inputMode="numeric"
                    maxLength={6}
                    placeholder="••••••"
                    className="text-center text-xl tracking-[.4em]"
                    autoFocus
                  />
                </Field>
              )}

              <Button variant="primary" size="lg" className="w-full" type="submit" disabled={busy}>
                {busy ? "Verifying…" : step < 2 ? "Continue" : "Verify OTP & Sign in"} <ArrowRight size={16} />
              </Button>
            </form>

            {step > 0 && (
              <div className="mt-4 flex items-center justify-between text-xs">
                <button
                  type="button"
                  onClick={() => { setStep(0); setOtp(""); setErrMsg(""); setInfoMsg(""); }}
                  className="font-medium text-slate-500 hover:text-slate-800"
                >
                  ← Back to login
                </button>
                {step === 2 && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => submitCredentials(pin)}
                    className="inline-flex items-center gap-1 font-semibold text-indigo-600 hover:underline"
                  >
                    <RefreshCw size={12} /> Resend OTP
                  </button>
                )}
              </div>
            )}

            <div className="mt-6 flex items-center justify-center gap-1.5 text-xs text-slate-400">
              <Lock size={12} /> Mandatory Telegram 2FA • AlwaysData Private Storage
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
