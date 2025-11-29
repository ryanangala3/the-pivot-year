import React, { useState } from 'react';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, signInAnonymously } from 'firebase/auth';
import { auth } from '../firebase';
import { Loader, Mail, Lock, User, ArrowRight } from 'lucide-react';

export default function AuthScreen() {
  const [mode, setMode] = useState('welcome'); // welcome, login, signup
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleAuth = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (mode === 'login') {
        await signInWithEmailAndPassword(auth, email, password);
      } else if (mode === 'signup') {
        await createUserWithEmailAndPassword(auth, email, password);
      }
    } catch (err) {
      console.error(err);
      let msg = "Authentication failed.";
      if (err.code === 'auth/invalid-email') msg = "Invalid email address.";
      if (err.code === 'auth/user-not-found') msg = "No account found with this email.";
      if (err.code === 'auth/wrong-password') msg = "Incorrect password.";
      if (err.code === 'auth/email-already-in-use') msg = "Email already in use.";
      if (err.code === 'auth/weak-password') msg = "Password should be at least 6 characters.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleGuest = async () => {
    setLoading(true);
    try {
      await signInAnonymously(auth);
    } catch (err) {
      setError("Could not sign in as guest.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-stone-50 flex items-center justify-center p-6 font-serif text-stone-800">
      <div className="max-w-md w-full bg-white p-8 md:p-12 rounded-lg shadow-sm border border-stone-200">
        
        <div className="text-center mb-10">
          <h1 className="text-3xl font-bold mb-2 tracking-tight">The Pivot Year</h1>
          <p className="text-stone-500 italic">Companion Journal</p>
        </div>

        {mode === 'welcome' && (
          <div className="space-y-4">
            <button 
              onClick={() => setMode('login')}
              className="w-full py-3 px-4 bg-stone-800 text-white rounded-md font-bold hover:bg-stone-900 transition-colors flex items-center justify-center gap-2"
            >
              Sign In
            </button>
            <button 
              onClick={() => setMode('signup')}
              className="w-full py-3 px-4 bg-white border border-stone-300 text-stone-700 rounded-md font-bold hover:bg-stone-50 transition-colors"
            >
              Create Account
            </button>
            <div className="relative py-2">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-stone-200" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-white px-2 text-stone-400">Or</span>
              </div>
            </div>
            <button 
              onClick={handleGuest}
              className="w-full py-3 px-4 text-stone-500 hover:text-stone-800 text-sm font-medium transition-colors"
            >
              Continue as Guest
            </button>
          </div>
        )}

        {(mode === 'login' || mode === 'signup') && (
          <form onSubmit={handleAuth} className="space-y-4">
            {error && (
              <div className="p-3 bg-red-50 text-red-600 text-sm rounded-md border border-red-100">
                {error}
              </div>
            )}
            
            <div>
              <label className="block text-xs font-bold uppercase text-stone-500 mb-1">Email</label>
              <div className="relative">
                <Mail size={16} className="absolute left-3 top-3 text-stone-400" />
                <input 
                  type="email" 
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-stone-200 rounded-md focus:outline-none focus:border-stone-500 transition-colors"
                  placeholder="you@example.com"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase text-stone-500 mb-1">Password</label>
              <div className="relative">
                <Lock size={16} className="absolute left-3 top-3 text-stone-400" />
                <input 
                  type="password" 
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-stone-200 rounded-md focus:outline-none focus:border-stone-500 transition-colors"
                  placeholder="••••••••"
                />
              </div>
            </div>

            <button 
              type="submit"
              disabled={loading}
              className="w-full py-3 px-4 bg-stone-800 text-white rounded-md font-bold hover:bg-stone-900 transition-colors flex items-center justify-center gap-2 mt-6"
            >
              {loading ? <Loader size={18} className="animate-spin" /> : <ArrowRight size={18} />}
              {mode === 'login' ? 'Sign In' : 'Create Account'}
            </button>

            <button 
              type="button"
              onClick={() => { setMode('welcome'); setError(''); }}
              className="w-full text-center text-xs text-stone-400 hover:text-stone-600 mt-4"
            >
              Back to Options
            </button>
          </form>
        )}

      </div>
    </div>
  );
}
