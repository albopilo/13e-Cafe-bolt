import { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { useLang } from '@/context/LanguageContext';
import { useNavigate, Link } from 'react-router-dom';
import { Coffee, Loader as Loader2, User, Mail, Phone, Calendar, Lock, IdCard } from 'lucide-react';
import { normalizePhone } from '@/lib/categories';

function extractBirthdateFromKTP(ktp: string): string | null {
  if (ktp.length < 15) return null;
  const day = parseInt(ktp.substring(6, 8), 10);
  const month = parseInt(ktp.substring(8, 10), 10);
  const yearDigits = ktp.substring(10, 12);
  const currentYear = new Date().getFullYear();
  const century = Math.floor(currentYear / 100);
  let year = parseInt(yearDigits, 10);
  if (year + century * 100 > currentYear) {
    year = (century - 1) * 100 + year;
  } else {
    year = century * 100 + year;
  }
  let actualDay = day;
  if (day > 40) {
    actualDay = day - 40;
  }
  if (month < 1 || month > 12 || actualDay < 1 || actualDay > 31) return null;
  return `${year}-${String(month).padStart(2, '0')}-${String(actualDay).padStart(2, '0')}`;
}

export function RegisterPage() {
  const { signUp } = useAuth();
  const { addToast } = useToast();
  const { t } = useLang();
  const navigate = useNavigate();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [ktp, setKtp] = useState('');
  const [birthdate, setBirthdate] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleKtpChange = (value: string) => {
    const cleaned = value.replace(/[^0-9]/g, '').slice(0, 16);
    setKtp(cleaned);
    if (cleaned.length >= 15) {
      const extracted = extractBirthdateFromKTP(cleaned);
      if (extracted) setBirthdate(extracted);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !email || !phone || !password) {
      addToast(t('fillAllFields'), 'error');
      return;
    }
    if (password.length < 6) {
      addToast(t('passwordMinLength'), 'error');
      return;
    }
    setLoading(true);
    const { error } = await signUp(email, password, {
      name,
      phone: normalizePhone(phone),
      birthdate,
      ktp: ktp || undefined,
    });
    setLoading(false);
    if (error) {
      addToast(error, 'error');
    } else {
      addToast(t('accountCreated'), 'success');
      navigate('/login');
    }
  };

  return (
    <div className="min-h-screen bg-cream-100 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-6">
          <Coffee className="w-12 h-12 text-espresso-600 mx-auto mb-2" />
          <h1 className="font-display font-bold text-2xl text-espresso-600">{t('joinCafe')}</h1>
          <p className="text-sm text-espresso-300 mt-1">{t('earnLoyaltyPoints')}</p>
        </div>

        <form onSubmit={handleSubmit} className="card p-6 space-y-4">
          <div>
            <label className="text-sm font-medium text-espresso-500 mb-1 block">{t('fullName')}</label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-espresso-300" />
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                className="input-field pl-10"
                placeholder={t('yourName')}
                required
              />
            </div>
          </div>
          <div>
            <label className="text-sm font-medium text-espresso-500 mb-1 block">{t('email')}</label>
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
            <label className="text-sm font-medium text-espresso-500 mb-1 block">{t('phoneNumber')}</label>
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
            <label className="text-sm font-medium text-espresso-500 mb-1 block">{t('ktpOptional')}</label>
            <div className="relative">
              <IdCard className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-espresso-300" />
              <input
                type="text"
                value={ktp}
                onChange={e => handleKtpChange(e.target.value)}
                className="input-field pl-10"
                placeholder={t('ktpPlaceholder')}
                maxLength={16}
              />
            </div>
            {ktp.length >= 15 && (
              <p className="text-xs text-sage-500 mt-1">{t('birthdateAutoFilled')}</p>
            )}
          </div>
          <div>
            <label className="text-sm font-medium text-espresso-500 mb-1 block">{t('birthdateOptional')}</label>
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
            <label className="text-sm font-medium text-espresso-500 mb-1 block">{t('password')}</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-espresso-300" />
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="input-field pl-10"
                placeholder={t('passwordPlaceholder')}
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
            {loading ? t('creatingAccount') : t('createAccountBtn')}
          </button>
          <p className="text-center text-sm text-espresso-300">
            {t('alreadyMember')} <Link to="/login" className="text-sage-500 font-medium hover:underline">{t('login')}</Link>
          </p>
        </form>
      </div>
    </div>
  );
}
