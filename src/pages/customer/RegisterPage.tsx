import { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { useNavigate, Link } from 'react-router-dom';
import { Coffee, Loader2, User, Mail, Phone, Calendar, Lock } from 'lucide-react';
import { normalizePhone } from '@/lib/categories';

export function RegisterPage() {
  const { signUp } = useAuth();
  const { addToast } = useToast();
  const navigate = useNavigate();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [birthdate, setBirthdate] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !email || !phone || !password) {
      addToast('Please fill in all required fields', 'error');
      return;
    }
    if (password.length < 6) {
      addToast('Password must be at least 6 characters', 'error');
      return;
    }
    setLoading(true);
    const { error } = await signUp(email, password, {
      name,
      phone: normalizePhone(phone),
      birthdate,
    });
    setLoading(false);
    if (error) {
      addToast(error, 'error');
    } else {
      addToast('Account created! You can now log in.', 'success');
      navigate('/login');
    }
  };

  return (
    <div className="min-h-screen bg-cream-100 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-6">
          <Coffee className="w-12 h-12 text-espresso-600 mx-auto mb-2" />
          <h1 className="font-display font-bold text-2xl text-espresso-600">Join 13e Café</h1>
          <p className="text-sm text-espresso-300 mt-1">Earn loyalty points with every order</p>
        </div>

        <form onSubmit={handleSubmit} className="card p-6 space-y-4">
          <div>
            <label className="text-sm font-medium text-espresso-500 mb-1 block">Full Name</label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-espresso-300" />
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                className="input-field pl-10"
                placeholder="Your name"
                required
              />
            </div>
          </div>
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
                required
              />
            </div>
          </div>
          <div>
            <label className="text-sm font-medium text-espresso-500 mb-1 block">Phone</label>
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-espresso-300" />
              <input
                type="tel"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                className="input-field pl-10"
                placeholder="08xx..."
                required
              />
            </div>
          </div>
          <div>
            <label className="text-sm font-medium text-espresso-500 mb-1 block">Birthdate (optional)</label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-espresso-300" />
              <input
                type="date"
                value={birthdate}
                onChange={e => setBirthdate(e.target.value)}
                className="input-field pl-10"
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
                placeholder="Min 6 characters"
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
            {loading ? 'Creating account...' : 'Create Account'}
          </button>
          <p className="text-center text-sm text-espresso-300">
            Already a member? <Link to="/login" className="text-sage-500 font-medium hover:underline">Login</Link>
          </p>
        </form>
      </div>
    </div>
  );
}
