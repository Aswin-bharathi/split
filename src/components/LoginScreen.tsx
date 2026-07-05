import { LogIn } from 'lucide-react';
import { useState } from 'react';

type LoginScreenProps = {
  onLogin: (username: string, password: string) => Promise<void>;
  loading?: boolean;
  error?: string | null;
};

export function LoginScreen({ onLogin, loading = false, error }: LoginScreenProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const normalized = username.trim().toLowerCase().replace(/\s+/g, '');
    if (!normalized || !password) {
      setLocalError('Enter your username and password.');
      return;
    }
    setLocalError(null);
    setSubmitting(true);
    try {
      await onLogin(normalized, password);
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setSubmitting(false);
    }
  };

  const displayError = localError ?? error;

  return (
    <div className="grid min-h-screen place-items-center bg-[#3f3f3e] p-6 text-[#fff9bf]">
      <div className="w-full max-w-md rounded-xl border-2 border-[#b8b493] bg-[#48483f] p-8 shadow-2xl">
        <div className="mb-8 text-center">
          <h1 className="font-serif text-4xl font-bold italic text-[#f5ff8f]">SplitNest</h1>
          <p className="mt-2 text-[#d8d4b4]">Sign in to manage shared expenses</p>
        </div>

        <form className="space-y-5" onSubmit={handleSubmit}>
          <div>
            <label className="mb-2 block text-sm font-semibold uppercase tracking-wide text-[#b8b493]">
              Username
            </label>
            <input
              type="text"
              className="my-input w-full"
              placeholder="e.g. hariprasath or sivasakthi"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              autoComplete="username"
              autoCapitalize="off"
              spellCheck={false}
            />
            <p className="mt-2 text-xs text-[#b8b493]">
              Use your name without spaces, all lowercase (Hari Prasath → hariprasath).
            </p>
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold uppercase tracking-wide text-[#b8b493]">
              Password
            </label>
            <input
              type="password"
              className="my-input w-full"
              placeholder="Enter your password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
            />
          </div>

          {displayError && (
            <p className="rounded-lg border border-[#ff8667] bg-[#ff8667]/10 px-4 py-3 text-sm text-[#ff8667]">
              {displayError}
            </p>
          )}

          <button
            type="submit"
            className="my-btn flex w-full items-center justify-center gap-2 py-4 text-xl"
            disabled={loading || submitting || !username.trim() || !password}
          >
            <LogIn size={22} />
            {submitting ? 'Signing in...' : 'Sign in'}
          </button>
        </form>

        <p className="mt-6 text-center text-xs text-[#b8b493]">
          Your session stays active for 7 days. You will be asked to sign in again when it expires.
        </p>
      </div>
    </div>
  );
}
