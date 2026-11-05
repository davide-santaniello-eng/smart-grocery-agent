import React, { useState } from 'react';
import { ShoppingCart, Lock, Mail, ArrowRight, ShieldCheck, AlertCircle } from 'lucide-react';
import { signInWithEmail, signUpWithEmail } from '../services/supabase';

interface Props {
  onLoginSuccess: () => void;
}

export function LoginScreen({ onLoginSuccess }: Props) {
  const [isRegisterMode, setIsRegisterMode] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setInfoMessage(null);

    if (!email.trim() || !password.trim()) {
      setErrorMessage('Inserisci sia l\'email che la password.');
      return;
    }

    if (password.length < 6) {
      setErrorMessage('La password deve contenere almeno 6 caratteri.');
      return;
    }

    setLoading(true);
    try {
      if (isRegisterMode) {
        const { error, user } = await signUpWithEmail(email.trim(), password);
        if (error) {
          setErrorMessage(error.message);
        } else if (user) {
          setInfoMessage('Account registrato con successo! Se è richiesta la conferma email, controlla la tua casella di posta.');
          setIsRegisterMode(false);
        }
      } else {
        const { error, session } = await signInWithEmail(email.trim(), password);
        if (error) {
          setErrorMessage('Credenziali non valide o utente non trovato.');
        } else if (session) {
          onLoginSuccess();
        }
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Si è verificato un errore imprevisto.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8 px-4">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-600 text-white shadow-md shadow-emerald-600/20">
          <ShoppingCart className="h-7 w-7" />
        </div>
        <h2 className="mt-4 text-2xl font-black tracking-tight text-slate-900">
          Smart Grocery Agent
        </h2>
        <p className="mt-1 text-xs text-slate-500 font-medium">
          Area Riservata Famiglia • Accesso Protetto
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 sm:p-8 shadow-sm">
          {errorMessage && (
            <div className="mb-5 flex items-start gap-2.5 rounded-2xl bg-red-50 p-3.5 text-xs text-red-700 border border-red-200">
              <AlertCircle className="h-4 w-4 shrink-0 text-red-500 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {infoMessage && (
            <div className="mb-5 flex items-start gap-2.5 rounded-2xl bg-emerald-50 p-3.5 text-xs text-emerald-800 border border-emerald-200">
              <ShieldCheck className="h-4 w-4 shrink-0 text-emerald-600 mt-0.5" />
              <span>{infoMessage}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700">Email Famiglia</label>
              <div className="mt-1.5 relative">
                <Mail className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
                <input
                  type="email"
                  required
                  autoComplete="email"
                  placeholder="nome@famiglia.it"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 pl-10 pr-3.5 py-2.5 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700">Password</label>
              <div className="mt-1.5 relative">
                <Lock className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
                <input
                  type="password"
                  required
                  autoComplete="current-password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 pl-10 pr-3.5 py-2.5 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 py-3 text-sm font-bold text-white shadow-md shadow-emerald-600/20 transition hover:bg-emerald-700 active:scale-[0.99] disabled:opacity-50"
            >
              {loading ? (
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
              ) : (
                <>
                  <span>{isRegisterMode ? 'Registra Account Famiglia' : 'Accedi all\'App'}</span>
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </form>

          <div className="mt-6 border-t border-slate-100 pt-4 text-center">
            <button
              type="button"
              onClick={() => {
                setIsRegisterMode(!isRegisterMode);
                setErrorMessage(null);
                setInfoMessage(null);
              }}
              className="text-xs font-semibold text-emerald-700 hover:text-emerald-800 transition"
            >
              {isRegisterMode
                ? 'Hai già un account? Clicca qui per accedere'
                : 'Prima volta? Clicca qui per creare il primo account'}
            </button>
          </div>
        </div>

        {/* Security badge footer */}
        <div className="mt-6 flex items-center justify-center gap-2 text-center text-xs text-slate-400">
          <ShieldCheck className="h-4 w-4 text-slate-400" />
          <span>Autenticazione crittografata con Supabase Auth & PostgreSQL RLS</span>
        </div>
      </div>
    </div>
  );
}
