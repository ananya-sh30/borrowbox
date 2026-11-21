import { useState, useEffect, type FormEvent } from 'react';
import { Eye, EyeOff, ShieldCheck, AlertCircle, X } from 'lucide-react';
import type { AppRoute, User } from '../types';
import { apiRequest, setAuthToken } from '../lib/api';

interface AuthSuccessPayload {
  user: User;
  token?: string;
}

interface LoginPageProps {
  onNavigate: (route: AppRoute) => void;
  onAuthSuccess: (user: User) => Promise<void>;
  onOpenLegal: (type: 'terms' | 'privacy') => void;
}

const COUNTRY_CODES = [
  { code: '+91', label: 'India (+91)' },
  { code: '+1', label: 'US / Canada (+1)' },
  { code: '+44', label: 'UK (+44)' },
  { code: '+61', label: 'Australia (+61)' },
  { code: '+65', label: 'Singapore (+65)' },
];

function GoogleLogo() {
  return (
    <svg className="h-[18px] w-[18px] shrink-0" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  );
}

function GoogleConfigModal({
  open,
  redirectUri,
  message,
  onClose,
}: {
  open: boolean;
  redirectUri: string;
  message: string;
  onClose: () => void;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#252A34]/40 p-4">
      <div className="relative w-full max-w-lg rounded-2xl border border-[#E5E8F0] bg-white p-6 shadow-xl">
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 rounded-lg p-1.5 text-[#646B7A] hover:bg-[#F6F7FB]"
          aria-label="Close modal"
        >
          <X className="h-4 w-4" />
        </button>
        <h2 className="font-display text-lg font-bold text-[#252A34]">
          Google OAuth Setup Required
        </h2>
        <p className="mt-2 text-sm text-[#646B7A]">{message}</p>
        <div className="mt-4 space-y-2 rounded-xl border border-[#E5E8F0] bg-[#F6F7FB] p-4 text-xs text-[#252A34]">
          <p className="font-semibold">To enable live Google Sign-In:</p>
          <ol className="list-decimal space-y-1 pl-4 text-[#646B7A]">
            <li>Create OAuth 2.0 Web Credentials in Google Cloud Console.</li>
            <li>
              Add this exact Authorized Redirect URI:
              <code className="mt-1 block break-all rounded bg-white px-2 py-1 font-mono text-[11px] text-[#252A34]">
                {redirectUri}
              </code>
            </li>
            <li>
              Set <span className="font-mono font-semibold">GOOGLE_CLIENT_ID</span> and{' '}
              <span className="font-mono font-semibold">GOOGLE_CLIENT_SECRET</span> in your
              environment variables and restart the server.
            </li>
          </ol>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="mt-5 w-full rounded-xl bg-[#5478D5] px-4 py-2.5 text-sm font-semibold text-white"
        >
          Use Email &amp; Password Instead
        </button>
      </div>
    </div>
  );
}

export function LoginPage({ onNavigate, onAuthSuccess }: LoginPageProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [forgotOpen, setForgotOpen] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotNewPass, setForgotNewPass] = useState('');
  const [forgotMsg, setForgotMsg] = useState<string | null>(null);

  const [googleHelp, setGoogleHelp] = useState<{
    open: boolean;
    redirectUri: string;
    message: string;
  }>({ open: false, redirectUri: '', message: '' });

  const handleEmailLogin = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await apiRequest<AuthSuccessPayload>('/api/auth/login', {
        method: 'POST',
        body: { email, password, rememberMe },
      });
      if (res.token) setAuthToken(res.token);
      await onAuthSuccess(res.user);
      onNavigate('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to sign in.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setError(null);
    try {
      const status = await apiRequest<{ configured: boolean; redirectUri: string }>(
        '/api/auth/google/status',
      );
      if (!status.configured) {
        setGoogleHelp({
          open: true,
          redirectUri: status.redirectUri,
          message:
            'Google OAuth credentials (GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET) are not configured in this environment yet.',
        });
        return;
      }
      const { url } = await apiRequest<{ url: string }>('/api/auth/google/url');
      window.open(url, 'borrowbox_google_oauth', 'width=540,height=660');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not initiate Google sign-in.');
    }
  };

  const handleForgotSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setForgotMsg(null);
    try {
      const res = await apiRequest<{ message: string }>('/api/auth/forgot-password', {
        method: 'POST',
        body: { email: forgotEmail, newPassword: forgotNewPass },
      });
      setForgotMsg(res.message);
    } catch (err) {
      setForgotMsg(err instanceof Error ? err.message : 'Unable to reset password.');
    }
  };

  return (
    <div className="min-h-[calc(100vh-140px)] bg-[#F6F7FB] px-4 py-12 sm:px-6">
      <div className="mx-auto max-w-md rounded-2xl border border-[#E5E8F0] bg-white p-8 shadow-xs">
        <div className="text-center">
          
          <h1 className="font-display mt-3 text-2xl font-bold text-[#252A34]">Welcome back</h1>
          <p className="mt-1 text-sm text-[#646B7A]">
            Sign in to manage your rental bookings and orders.
          </p>
        </div>

        {error && (
          <div className="mt-4 flex items-start gap-2 rounded-xl bg-red-50 px-3.5 py-2.5 text-xs font-medium text-[#DC2626]">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleEmailLogin} className="mt-6 space-y-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-[#252A34]">Email Address</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full rounded-xl border border-[#E5E8F0] bg-[#F6F7FB] px-3.5 py-2.5 text-sm text-[#252A34] focus:border-[#5478D5] focus:bg-white focus:outline-none"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-[#252A34]">Password</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                className="w-full rounded-xl border border-[#E5E8F0] bg-[#F6F7FB] py-2.5 pr-10 pl-3.5 text-sm text-[#252A34] focus:border-[#5478D5] focus:bg-white focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                className="absolute top-1/2 right-3 -translate-y-1/2 text-[#646B7A] hover:text-[#252A34]"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between text-xs">
            <label className="flex cursor-pointer items-center gap-2 text-[#646B7A]">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="rounded accent-[#5478D5]"
              />
              <span>Remember me</span>
            </label>
            <button
              type="button"
              onClick={() => {
                setForgotEmail(email);
                setForgotMsg(null);
                setForgotOpen(true);
              }}
              className="font-semibold text-[#5478D5] hover:underline"
            >
              Forgot password?
            </button>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full min-h-[44px] rounded-xl bg-[#5478D5] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#4365BE] disabled:opacity-50"
          >
            {loading ? 'Signing in...' : 'Login'}
          </button>
        </form>

        <div className="my-6 flex items-center gap-3">
          <div className="h-px flex-1 bg-[#E5E8F0]" />
          <span className="text-xs text-[#646B7A]">or</span>
          <div className="h-px flex-1 bg-[#E5E8F0]" />
        </div>

        <button
          type="button"
          onClick={handleGoogleSignIn}
          className="flex w-full min-h-[44px] items-center justify-center gap-2.5 rounded-xl border border-[#E5E8F0] bg-white px-4 py-2.5 text-sm font-semibold text-[#252A34] transition-colors hover:bg-[#F6F7FB]"
        >
          <GoogleLogo />
          <span>Continue with Google</span>
        </button>

        <p className="mt-6 text-center text-xs text-[#646B7A]">
          New to BorrowBox?{' '}
          <button
            type="button"
            onClick={() => onNavigate('/signup')}
            className="font-semibold text-[#5478D5] hover:underline"
          >
            Create an account
          </button>
        </p>
      </div>

      {/* Forgot Password Modal */}
      {forgotOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#252A34]/40 p-4">
          <div className="relative w-full max-w-md rounded-2xl border border-[#E5E8F0] bg-white p-6 shadow-xl">
            <button
              type="button"
              onClick={() => setForgotOpen(false)}
              className="absolute top-4 right-4 rounded-lg p-1.5 text-[#646B7A] hover:bg-[#F6F7FB]"
            >
              <X className="h-4 w-4" />
            </button>
            <h2 className="font-display text-lg font-bold text-[#252A34]">Reset Password</h2>
            <p className="mt-1 text-xs text-[#646B7A]">
              Enter your registered email and a new password (min 8 characters with letters &amp;
              numbers) for this demo environment.
            </p>
            <form onSubmit={handleForgotSubmit} className="mt-4 space-y-3">
              <input
                type="email"
                required
                value={forgotEmail}
                onChange={(e) => setForgotEmail(e.target.value)}
                placeholder="Email address"
                className="w-full rounded-xl border border-[#E5E8F0] bg-[#F6F7FB] px-3.5 py-2.5 text-sm"
              />
              <input
                type="password"
                required
                value={forgotNewPass}
                onChange={(e) => setForgotNewPass(e.target.value)}
                placeholder="New password"
                className="w-full rounded-xl border border-[#E5E8F0] bg-[#F6F7FB] px-3.5 py-2.5 text-sm"
              />
              {forgotMsg && (
                <p className="rounded-lg bg-[#E9EDFF] px-3 py-2 text-xs text-[#252A34]">
                  {forgotMsg}
                </p>
              )}
              <button
                type="submit"
                className="w-full rounded-xl bg-[#5478D5] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#4365BE]"
              >
                Update Password
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Google OAuth Configuration Info Modal */}
      <GoogleConfigModal
        open={googleHelp.open}
        redirectUri={googleHelp.redirectUri}
        message={googleHelp.message}
        onClose={() => setGoogleHelp((prev) => ({ ...prev, open: false }))}
      />
    </div>
  );
}

interface SignupPageProps {
  onNavigate: (route: AppRoute) => void;
  onAuthSuccess: (user: User) => Promise<void>;
  onOpenLegal: (type: 'terms' | 'privacy') => void;
}

export function SignupPage({ onNavigate, onAuthSuccess, onOpenLegal }: SignupPageProps) {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [countryCode, setCountryCode] = useState('+91');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [googleHelp, setGoogleHelp] = useState<{
    open: boolean;
    redirectUri: string;
    message: string;
  }>({ open: false, redirectUri: '', message: '' });

  const hasLength = password.length >= 8;
  const hasLetterAndDigit = /[A-Za-z]/.test(password) && /\d/.test(password);

  const handleGoogleSignUp = async () => {
    setError(null);
    try {
      const status = await apiRequest<{ configured: boolean; redirectUri: string }>(
        '/api/auth/google/status',
      );
      if (!status.configured) {
        setGoogleHelp({
          open: true,
          redirectUri: status.redirectUri,
          message:
            'Google OAuth credentials (GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET) are not configured in this environment yet.',
        });
        return;
      }
      const { url } = await apiRequest<{ url: string }>('/api/auth/google/url');
      window.open(url, 'borrowbox_google_oauth', 'width=540,height=660');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not initiate Google sign-up.');
    }
  };

  const handleSignup = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (fullName.trim().length < 2) {
      setError('Full name must be at least 2 characters.');
      return;
    }
    if (!hasLength || !hasLetterAndDigit) {
      setError('Password must be at least 8 characters and include both letters and numbers.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    if (!termsAccepted) {
      setError('Please accept the Terms and Conditions.');
      return;
    }

    setLoading(true);
    try {
      const res = await apiRequest<AuthSuccessPayload>('/api/auth/signup', {
        method: 'POST',
        body: {
          fullName,
          email,
          countryCode,
          phone,
          password,
          confirmPassword,
          termsAccepted,
        },
      });
      if (res.token) setAuthToken(res.token);
      await onAuthSuccess(res.user);
      onNavigate('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to create account.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-140px)] bg-[#F6F7FB] px-4 py-12 sm:px-6">
      <div className="mx-auto max-w-md rounded-2xl border border-[#E5E8F0] bg-white p-8 shadow-xs">
        <div className="text-center">
          <span className="font-display text-2xl font-bold tracking-tight text-[#252A34]">
            Borrow<span className="text-[#5478D5]">Box</span>
          </span>
          <h1 className="font-display mt-3 text-2xl font-bold text-[#252A34]">
            Create your account
          </h1>
          <p className="mt-1 text-sm text-[#646B7A]">
            Start borrowing cameras, electronics, and gear on flexible daily rates.
          </p>
        </div>

        {error && (
          <div className="mt-4 flex items-start gap-2 rounded-xl bg-red-50 px-3.5 py-2.5 text-xs font-medium text-[#DC2626]">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSignup} className="mt-6 space-y-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-[#252A34]">Full Name</label>
            <input
              type="text"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Aarav Sharma"
              className="w-full rounded-xl border border-[#E5E8F0] bg-[#F6F7FB] px-3.5 py-2.5 text-sm text-[#252A34] focus:border-[#5478D5] focus:bg-white focus:outline-none"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-[#252A34]">Email Address</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="aarav@university.edu"
              className="w-full rounded-xl border border-[#E5E8F0] bg-[#F6F7FB] px-3.5 py-2.5 text-sm text-[#252A34] focus:border-[#5478D5] focus:bg-white focus:outline-none"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-[#252A34]">Phone Number</label>
            <div className="flex gap-2">
              <select
                value={countryCode}
                onChange={(e) => setCountryCode(e.target.value)}
                className="rounded-xl border border-[#E5E8F0] bg-[#F6F7FB] px-2.5 py-2.5 text-xs font-medium text-[#252A34]"
              >
                {COUNTRY_CODES.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.label}
                  </option>
                ))}
              </select>
              <input
                type="tel"
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="9876543210"
                className="flex-1 rounded-xl border border-[#E5E8F0] bg-[#F6F7FB] px-3.5 py-2.5 text-sm text-[#252A34] focus:border-[#5478D5] focus:bg-white focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-[#252A34]">Password</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Min 8 characters, letters & numbers"
                className="w-full rounded-xl border border-[#E5E8F0] bg-[#F6F7FB] py-2.5 pr-10 pl-3.5 text-sm text-[#252A34] focus:border-[#5478D5] focus:bg-white focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                className="absolute top-1/2 right-3 -translate-y-1/2 text-[#646B7A]"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <p className="mt-1 text-[11px] text-[#646B7A]">
              Strength:{' '}
              <span className={hasLength && hasLetterAndDigit ? 'text-[#299B68] font-medium' : ''}>
                {hasLength && hasLetterAndDigit
                  ? 'Strong (8+ chars, letters & digits)'
                  : 'Needs 8+ chars with letters & numbers'}
              </span>
            </p>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-[#252A34]">
              Confirm Password
            </label>
            <input
              type="password"
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Re-enter password"
              className="w-full rounded-xl border border-[#E5E8F0] bg-[#F6F7FB] px-3.5 py-2.5 text-sm text-[#252A34] focus:border-[#5478D5] focus:bg-white focus:outline-none"
            />
          </div>

          <label className="flex cursor-pointer items-start gap-2.5 text-xs text-[#646B7A]">
            <input
              type="checkbox"
              checked={termsAccepted}
              onChange={(e) => setTermsAccepted(e.target.checked)}
              className="mt-0.5 rounded accent-[#5478D5]"
            />
            <span>
              I agree to the{' '}
              <button
                type="button"
                onClick={() => onOpenLegal('terms')}
                className="font-semibold text-[#5478D5] hover:underline"
              >
                Terms &amp; Conditions
              </button>{' '}
              and{' '}
              <button
                type="button"
                onClick={() => onOpenLegal('privacy')}
                className="font-semibold text-[#5478D5] hover:underline"
              >
                Privacy Policy
              </button>
              .
            </span>
          </label>

          <button
            type="submit"
            disabled={loading}
            className="w-full min-h-[44px] rounded-xl bg-[#5478D5] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#4365BE] disabled:opacity-50"
          >
            {loading ? 'Creating Account...' : 'Create Account'}
          </button>
        </form>

        <div className="my-6 flex items-center gap-3">
          <div className="h-px flex-1 bg-[#E5E8F0]" />
          <span className="text-xs text-[#646B7A]">or</span>
          <div className="h-px flex-1 bg-[#E5E8F0]" />
        </div>

        <button
          type="button"
          onClick={handleGoogleSignUp}
          className="flex w-full min-h-[44px] items-center justify-center gap-2.5 rounded-xl border border-[#E5E8F0] bg-white px-4 py-2.5 text-sm font-semibold text-[#252A34] transition-colors hover:bg-[#F6F7FB]"
        >
          <GoogleLogo />
          <span>Continue with Google</span>
        </button>

        <p className="mt-6 text-center text-xs text-[#646B7A]">
          Already have an account?{' '}
          <button
            type="button"
            onClick={() => onNavigate('/login')}
            className="font-semibold text-[#5478D5] hover:underline"
          >
            Login here
          </button>
        </p>
      </div>

      <GoogleConfigModal
        open={googleHelp.open}
        redirectUri={googleHelp.redirectUri}
        message={googleHelp.message}
        onClose={() => setGoogleHelp((prev) => ({ ...prev, open: false }))}
      />
    </div>
  );
}

interface AdminLoginPageProps {
  onNavigate: (route: AppRoute) => void;
  onAuthSuccess: (user: User) => Promise<void>;
}

export function AdminLoginPage({ onNavigate, onAuthSuccess }: AdminLoginPageProps) {
  const [initialized, setInitialized] = useState<boolean | null>(null);
  const [fullName, setFullName] = useState('BorrowBox Admin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiRequest<{ initialized: boolean; envConfigured: boolean }>('/api/admin/status')
      .then((res) => setInitialized(res.initialized))
      .catch(() => setInitialized(true));
  }, []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const endpoint = initialized === false ? '/api/admin/bootstrap' : '/api/admin/login';
      const body =
        initialized === false ? { fullName, email, password } : { email, password };
      const res = await apiRequest<AuthSuccessPayload>(endpoint, {
        method: 'POST',
        body,
      });
      if (res.token) setAuthToken(res.token);
      await onAuthSuccess(res.user);
      onNavigate('/admin');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Administrator authentication failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F6F7FB] px-4 py-14 sm:px-6">
      <div className="mx-auto max-w-md rounded-2xl border border-[#E5E8F0] bg-white p-8 shadow-xs">
        <div className="flex items-center justify-between">
          <span className="font-display text-lg font-bold text-[#252A34]">
            Borrow<span className="text-[#5478D5]">Box</span>
          </span>
          <button
            type="button"
            onClick={() => onNavigate('/')}
            className="text-xs font-medium text-[#646B7A] hover:text-[#252A34]"
          >
            Back to Storefront
          </button>
        </div>

        <div className="mt-6 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#E9EDFF] text-[#5478D5]">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div>
            <h1 className="font-display text-xl font-bold text-[#252A34]">
              {initialized === false ? 'Initial Admin Setup' : 'Administrator Sign In'}
            </h1>
            <p className="text-xs text-[#646B7A]">
              {initialized === false
                ? 'Claim your one-time administrator account to manage BorrowBox.'
                : 'Restricted portal for inventory, order, and inspection management.'}
            </p>
          </div>
        </div>

        {error && (
          <div className="mt-4 flex items-start gap-2 rounded-xl bg-red-50 px-3.5 py-2.5 text-xs font-medium text-[#DC2626]">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {initialized === null ? (
          <div className="mt-6 h-40 animate-pulse rounded-xl bg-[#F6F7FB]" />
        ) : (
          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            {initialized === false && (
              <div>
                <label className="mb-1 block text-xs font-medium text-[#252A34]">
                  Administrator Name
                </label>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full rounded-xl border border-[#E5E8F0] bg-[#F6F7FB] px-3.5 py-2.5 text-sm text-[#252A34]"
                />
              </div>
            )}

            <div>
              <label className="mb-1 block text-xs font-medium text-[#252A34]">Admin Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@borrowbox.example.com"
                className="w-full rounded-xl border border-[#E5E8F0] bg-[#F6F7FB] px-3.5 py-2.5 text-sm text-[#252A34] focus:border-[#5478D5] focus:bg-white focus:outline-none"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-[#252A34]">
                Admin Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={initialized === false ? 'Create strong password (8+ chars)' : 'Password'}
                  className="w-full rounded-xl border border-[#E5E8F0] bg-[#F6F7FB] py-2.5 pr-10 pl-3.5 text-sm text-[#252A34] focus:border-[#5478D5] focus:bg-white focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((p) => !p)}
                  className="absolute top-1/2 right-3 -translate-y-1/2 text-[#646B7A]"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full min-h-[44px] rounded-xl bg-[#5478D5] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#4365BE] disabled:opacity-50"
            >
              {loading
                ? 'Authenticating...'
                : initialized === false
                  ? 'Create Admin Account & Sign In'
                  : 'Sign In to Admin Dashboard'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
