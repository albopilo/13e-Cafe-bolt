import { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { Coffee, Loader as Loader2, Mail, Lock } from 'lucide-react';

export function LoginPage() {
  const { signIn } = useAuth();
  const { addToast } = useToast();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const redirectTo = searchParams.get('redirect') || '/';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      addToast('Please enter email and password', 'error');
      return;
    }
    setLoading(true);
    const { error } = await signIn(email, password);
    setLoading(false);
    if (error) {
      addToast(error, 'error');
    } else {
      addToast('Welcome back!', 'success');
      navigate(redirectTo);
    }
  };

  return (
    <div className="min-h-screen bg-cream-100 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-6">
          <Coffee className="w-12 h-12 text-espresso-600 mx-auto mb-2" />
          <h1 className="font-display font-bold text-2xl text-espresso-600">Welcome Back</h1>
          <p className="text-sm text-espresso-300 mt-1">Login to your 13e Café account</p>
        </div>

        <form onSubmit={handleSubmit} className="card p-6 space-y-4">
          <div>
            <label className="text-sm font-medium text-espresso-500 mb-1 block">Email</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-espresso-300" />
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="input-field pl-10"
                placeholder="you@email.com"
                autoComplete="email"
                required
              />
            </div>
          </div>
          <div>
            <label className="text-sm font-medium text-espresso-500 mb-1 block">Password</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-espresso-300" />
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="input-field pl-10"
                placeholder="Your password"
                autoComplete="current-password"
                required
              />
            </div>
          </div>
          <button
            type="submit"
            disabled={loading}
            className="btn-primary w-full flex items-center justify-center gap-2"
          >
            {loading && <Loader2 className="w-5 h-5 animate-spin" />}
            {loading ? 'Logging in...' : 'Login'}
          </button>
          <div className="flex justify-between text-sm">
            <Link to="/register" className="text-sage-500 font-medium hover:underline">Create account</Link>
            <Link to="/" className="text-espresso-300 hover:underline">Browse menu</Link>
          </div>
        </form>
      </div>
    </div>
  );
}
