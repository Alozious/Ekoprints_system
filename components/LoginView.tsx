
import React, { useState } from 'react';
import Logo from './Logo';

interface LoginViewProps {
  onLogin: (email: string, password: string) => Promise<string | void>;
}

const LoginView: React.FC<LoginViewProps> = ({ onLogin }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    const errorMessage = await onLogin(email, password);
    if (errorMessage) {
      setError(errorMessage);
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col justify-center items-center p-4">
      <div className="max-w-md w-full bg-white rounded-[2rem] shadow-[0_32px_64px_-12px_rgba(0,0,0,0.1)] p-12 border border-gray-100">
        <div className="mb-12 flex flex-col items-center">
            <Logo className="h-28" />
            <div className="h-1 w-12 bg-blue-600 rounded-full mt-6 mb-2"></div>
            <p className="text-center text-gray-400 font-bold tracking-[0.15em] uppercase text-[10px]">Secure Access Portal</p>
        </div>
        
        <form onSubmit={handleLogin} className="space-y-6">
          <div className="space-y-2">
            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] ml-1">Account Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="block w-full rounded-2xl bg-gray-900 border-none text-white font-bold py-4 px-6 shadow-xl focus:ring-2 focus:ring-blue-500 transition-all outline-none placeholder-gray-500"
              placeholder="name@ekoprints.com"
              required
              autoComplete="email"
            />
          </div>
          <div className="space-y-2">
            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] ml-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="block w-full rounded-2xl bg-gray-900 border-none text-white font-bold py-4 px-6 shadow-xl focus:ring-2 focus:ring-blue-500 transition-all outline-none placeholder-gray-500"
              placeholder="••••••••"
              required
              autoComplete="current-password"
            />
          </div>
          
          {error && (
            <div className="bg-red-50 text-red-600 text-[11px] font-bold p-4 rounded-2xl border border-red-100 text-center animate-shake">
                {error}
            </div>
          )}

          <div className="pt-4">
            <button
              type="submit"
              disabled={loading}
              className="w-full py-5 px-6 rounded-2xl shadow-[0_20px_40px_-10px_rgba(37,99,235,0.4)] text-xs font-black text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-4 focus:ring-blue-500/20 disabled:bg-blue-400 transition-all active:scale-95 uppercase tracking-[0.2em]"
            >
              {loading ? 'Authenticating...' : 'Sign In'}
            </button>
          </div>
          
          <p className="text-center text-gray-300 text-[10px] font-bold uppercase tracking-widest pt-4">
            Eko Prints &copy; {new Date().getFullYear()}
          </p>
        </form>
      </div>
    </div>
  );
};

export default LoginView;
