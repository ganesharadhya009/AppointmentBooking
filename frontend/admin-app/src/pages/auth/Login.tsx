import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Eye, EyeOff, ShieldCheck, Building2, Users2, ArrowRight, AlertCircle } from "lucide-react";
import { useAuthStore, ROLE_LABELS } from "@/store/authStore";
import { directoryApi, ApiError, type PagedResult } from "@/lib/apiClient";

interface StaffMemberResponse {
  id: string;
  name: string;
  email: string;
  role: number;
  isActive: boolean;
}

export default function Login() {
  const navigate = useNavigate();
  const login = useAuthStore((s) => s.login);
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!identifier || !password) {
      setError("Enter your email and password.");
      return;
    }
    setError("");
    setLoading(true);
    try {
      const result = await directoryApi.get<PagedResult<StaffMemberResponse>>("/staff-members", {
        isActive: true,
        pageSize: 100,
      });
      const match = result.items.find((s) => s.email.toLowerCase() === identifier.trim().toLowerCase());
      if (!match) {
        setError("No active staff account found for that email.");
        return;
      }
      login({ id: match.id, name: match.name, email: match.email, role: ROLE_LABELS[match.role] });
      navigate("/dashboard");
    } catch (err) {
      setError(
        err instanceof ApiError
          ? `Sign-in failed: ${err.message}`
          : "Couldn't reach the server. Make sure directory-api is running."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative flex min-h-screen bg-ink-950">
      {/* Left brand panel */}
      <div className="relative hidden w-[46%] flex-col justify-between overflow-hidden bg-gradient-to-br from-brand-700 via-brand-600 to-teal-600 p-12 lg:flex">
        <div className="pointer-events-none absolute inset-0 bg-noise opacity-30" />
        <motion.div
          animate={{ y: [0, -18, 0], x: [0, 12, 0] }}
          transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
          className="pointer-events-none absolute -right-20 top-10 h-72 w-72 rounded-full bg-white/10 blur-3xl"
        />
        <motion.div
          animate={{ y: [0, 20, 0], x: [0, -14, 0] }}
          transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
          className="pointer-events-none absolute bottom-0 left-0 h-80 w-80 rounded-full bg-teal-300/20 blur-3xl"
        />

        <div className="relative z-10 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/15 ring-1 ring-white/25 backdrop-blur">
            <img src="/logo.webp" alt="BimBa" className="h-8 w-8 object-contain" />
          </div>
          <div>
            <div className="text-lg font-extrabold text-white">BimBa&#8209;Pro</div>
            <div className="text-[11px] font-medium text-white/60">CDC Connect Admin Console</div>
          </div>
        </div>

        <div className="relative z-10">
          <h1 className="max-w-md text-[34px] font-extrabold leading-[1.15] tracking-tight text-white">
            Operations, made calm for every branch.
          </h1>
          <p className="mt-4 max-w-sm text-sm leading-relaxed text-white/65">
            One console for branches, therapists, consultants, bookings and billing across the CDC Connect
            therapy network &mdash; built for the people who keep it running smoothly.
          </p>

          <div className="mt-10 grid grid-cols-3 gap-4">
            <Stat icon={<Building2 size={16} />} value="3" label="Branches live" />
            <Stat icon={<Users2 size={16} />} value="143" label="Families served" />
            <Stat icon={<ShieldCheck size={16} />} value="18" label="Modules covered" />
          </div>
        </div>

        <div className="relative z-10 text-[11px] font-medium text-white/40">
          &copy; {new Date().getFullYear()} Srijana Healthcare Solutions &middot; bimba.cdcconnect.in/admin
        </div>
      </div>

      {/* Right form panel */}
      <div className="relative flex flex-1 items-center justify-center bg-canvas px-6 py-12">
        <div className="pointer-events-none absolute inset-0 bg-noise opacity-[0.4] lg:hidden" />
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="relative w-full max-w-[420px]"
        >
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-teal-500">
              <img src="/logo.webp" alt="BimBa" className="h-7 w-7 object-contain" />
            </div>
            <div className="text-base font-extrabold text-ink-950">BimBa&#8209;Pro</div>
          </div>

          <h2 className="text-2xl font-extrabold tracking-tight text-ink-950">Welcome back</h2>
          <p className="mt-1.5 text-sm text-ink-700/55">Sign in to your back-office account to continue.</p>

          <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-ink-700">Phone number or email</label>
              <input
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder="you@cdcconnect.in"
                className="h-11 rounded-xl bg-white px-4 text-sm text-ink-900 shadow-soft ring-1 ring-inset ring-ink-900/10 outline-none transition-all placeholder:text-ink-700/35 focus:ring-2 focus:ring-brand-500/60"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-ink-700">Password</label>
              <div className="relative">
                <input
                  type={showPass ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  className="h-11 w-full rounded-xl bg-white px-4 pr-11 text-sm text-ink-900 shadow-soft ring-1 ring-inset ring-ink-900/10 outline-none transition-all placeholder:text-ink-700/35 focus:ring-2 focus:ring-brand-500/60"
                />
                <button
                  type="button"
                  onClick={() => setShowPass((s) => !s)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-ink-700/40 hover:text-ink-700"
                >
                  {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              <p className="text-[11px] text-ink-700/40">
                Password isn&apos;t verified yet &mdash; sign-in matches your email to an active staff record.
              </p>
            </div>

            {error && (
              <div className="flex items-center gap-2 rounded-xl bg-rose-50 px-3.5 py-2.5 text-xs font-semibold text-rose-600 ring-1 ring-inset ring-rose-200">
                <AlertCircle size={14} />
                {error}
              </div>
            )}

            <div className="flex items-center justify-between pt-1 text-xs">
              <label className="flex items-center gap-2 font-medium text-ink-700/60">
                <input type="checkbox" className="h-3.5 w-3.5 rounded accent-brand-600" />
                Remember me
              </label>
              <button type="button" className="font-semibold text-brand-600 hover:text-brand-700">
                Forgot password?
              </button>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="mt-2 flex h-11 items-center justify-center gap-2 rounded-xl bg-gradient-to-b from-brand-500 to-brand-600 text-sm font-bold text-white shadow-[0_1px_0_rgba(255,255,255,0.15)_inset,0_10px_24px_-10px_rgba(79,70,229,0.6)] transition-transform active:scale-[0.99] disabled:opacity-70"
            >
              {loading ? (
                <motion.span
                  animate={{ rotate: 360 }}
                  transition={{ duration: 0.8, repeat: Infinity, ease: "linear" }}
                  className="h-4 w-4 rounded-full border-2 border-white/40 border-t-white"
                />
              ) : (
                <>
                  Sign in <ArrowRight size={15} />
                </>
              )}
            </button>
          </form>

          <p className="mt-8 text-center text-[11px] text-ink-700/35">
            Protected back-office access &middot; unauthorized use is prohibited.
          </p>
        </motion.div>
      </div>
    </div>
  );
}

function Stat({ icon, value, label }: { icon: React.ReactNode; value: string; label: string }) {
  return (
    <div className="rounded-2xl bg-white/10 p-3.5 ring-1 ring-white/15 backdrop-blur">
      <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/15 text-white">{icon}</div>
      <div className="mt-2.5 text-lg font-extrabold text-white">{value}</div>
      <div className="text-[10px] font-medium text-white/50">{label}</div>
    </div>
  );
}
