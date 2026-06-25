import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mail, Lock, User, ArrowRight, Plane, AlertCircle } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../ui/Button';

export function AuthScreen() {
  const { login, register, continueAsGuest } = useAuth();
  const [mode, setMode] = useState('login'); // login | register
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (mode === 'login') {
        await login(email, password);
      } else {
        await register(email, password, name);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4">
      {/* Logo */}
      <motion.div
        initial={{ opacity: 0, y: -30 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center mb-10"
      >
        <motion.div
          animate={{ y: [-5, 5, -5] }}
          transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
          className="text-5xl mb-3"
        >
          ✈️
        </motion.div>
        <h1 className="text-4xl font-bold text-white">
          Flo<span className="text-[#00b4d8]">doro</span>
        </h1>
        <p className="text-[#64748b] text-sm mt-1 tracking-widest uppercase">
          Çalış · Uç · Mola Ver
        </p>
      </motion.div>

      {/* Card */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="w-full max-w-sm glass border border-white/10 rounded-2xl p-7"
      >
        {/* Tab Switch */}
        <div className="flex gap-1 p-1 bg-white/5 rounded-xl mb-6">
          {['login', 'register'].map((m) => (
            <button
              key={m}
              onClick={() => { setMode(m); setError(''); }}
              className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
                mode === m
                  ? 'bg-[#00b4d8] text-white shadow'
                  : 'text-[#64748b] hover:text-white'
              }`}
            >
              {m === 'login' ? 'Giriş Yap' : 'Kayıt Ol'}
            </button>
          ))}
        </div>

        <form onSubmit={submit} className="space-y-3">
          <AnimatePresence>
            {mode === 'register' && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
              >
                <InputField
                  icon={<User size={14} />}
                  type="text"
                  placeholder="Ad Soyad"
                  value={name}
                  onChange={setName}
                />
              </motion.div>
            )}
          </AnimatePresence>

          <InputField
            icon={<Mail size={14} />}
            type="email"
            placeholder="E-posta"
            value={email}
            onChange={setEmail}
            required
          />
          <InputField
            icon={<Lock size={14} />}
            type="password"
            placeholder="Şifre"
            value={password}
            onChange={setPassword}
            required
          />

          {error && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center gap-2 text-red-400 text-xs bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2"
            >
              <AlertCircle size={12} />
              {error}
            </motion.div>
          )}

          <Button
            type="submit"
            variant="primary"
            size="lg"
            className="w-full"
            disabled={loading}
          >
            {loading ? (
              <span className="loading-dots"><span>.</span><span>.</span><span>.</span></span>
            ) : (
              <>
                {mode === 'login' ? 'Giriş Yap' : 'Hesap Oluştur'}
                <ArrowRight size={15} />
              </>
            )}
          </Button>
        </form>

        <div className="relative my-5">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-white/8" />
          </div>
          <div className="relative flex justify-center">
            <span className="bg-transparent px-3 text-xs text-[#475569]">veya</span>
          </div>
        </div>

        <button
          onClick={continueAsGuest}
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm text-[#64748b] hover:text-white border border-white/8 hover:border-white/20 transition-all glass"
        >
          <Plane size={14} />
          Misafir Olarak Devam Et
        </button>

        <p className="text-center text-xs text-[#374151] mt-4">
          Misafir modunda istatistikler kaydedilmez
        </p>
      </motion.div>
    </div>
  );
}

function InputField({ icon, type, placeholder, value, onChange, required }) {
  return (
    <div className="relative">
      <div className="absolute left-3 top-1/2 -translate-y-1/2 text-[#64748b]">{icon}</div>
      <input
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        className="w-full pl-9 pr-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder-[#475569] focus:outline-none focus:border-[#00b4d8]/50 transition-colors"
      />
    </div>
  );
}
