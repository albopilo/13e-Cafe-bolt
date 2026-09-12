import { createContext, useContext, useEffect, useState, useRef, type ReactNode } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import type { Member, StaffProfile, UserRole } from '@/lib/types';

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  member: Member | null;
  staff: StaffProfile | null;
  isAdmin: boolean;
  isStaff: boolean;
  isMainKitchen: boolean;
  role: UserRole;
  loading: boolean;
  signUp: (email: string, password: string, metadata: { name: string; phone: string; birthdate: string; ktp?: string }) => Promise<{ error: string | null }>;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [member, setMember] = useState<Member | null>(null);
  const [staff, setStaff] = useState<StaffProfile | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const initialLoadDone = useRef(false);

  const loadProfile = async (userId: string) => {
    const [mRes, aRes, sRes] = await Promise.all([
      supabase.from('members').select('*').eq('user_id', userId).maybeSingle(),
      supabase.from('admins').select('user_id').eq('user_id', userId).maybeSingle(),
      supabase.from('staff').select('*').eq('user_id', userId).maybeSingle(),
    ]);
    setMember(mRes.data as Member | null);
    setIsAdmin(!!aRes.data);
    setStaff(sRes.data as StaffProfile | null);
  };

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      setSession(data.session);
      setUser(data.session?.user ?? null);
      if (data.session?.user) {
        await loadProfile(data.session.user.id);
      }
      setLoading(false);
      initialLoadDone.current = true;
    });

    const { data: listener } = supabase.auth.onAuthStateChange((event, newSession) => {
      setSession(newSession);
      setUser(newSession?.user ?? null);

      // TOKEN_REFRESHED and SIGNED_IN from tab focus should not trigger loading
      // Only actual sign-in (initial) and sign-out should
      if (!initialLoadDone.current) return;

      if (event === 'SIGNED_OUT') {
        setMember(null);
        setIsAdmin(false);
        setStaff(null);
        setLoading(false);
        return;
      }

      if (event === 'TOKEN_REFRESHED' || event === 'SIGNED_IN') {
        // Session refreshed silently — user is still the same, no need to reload profile
        // unless we don't have profile data yet
        if (newSession?.user && !member && !isAdmin && !staff) {
          loadProfile(newSession.user.id);
        }
        return;
      }

      if (newSession?.user) {
        (async () => {
          await loadProfile(newSession.user.id);
        })();
      } else {
        setMember(null);
        setIsAdmin(false);
        setStaff(null);
        setLoading(false);
      }
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  const signUp = async (email: string, password: string, metadata: { name: string; phone: string; birthdate: string; ktp?: string }) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: metadata },
    });
    return { error: error?.message ?? null };
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error?.message ?? null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setMember(null);
    setIsAdmin(false);
    setStaff(null);
  };

  const isStaff = !!staff && !isAdmin;
  const isMainKitchen = !!staff && staff.assigned_location === 'Main Kitchen' && !isAdmin;
  const role: UserRole = isAdmin ? 'admin' : isStaff ? 'staff' : 'member';

  return (
    <AuthContext.Provider value={{ session, user, member, staff, isAdmin, isStaff, isMainKitchen, role, loading, signUp, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
