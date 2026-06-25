import { motion } from 'framer-motion';

export function Button({ children, onClick, variant = 'primary', size = 'md', disabled, className = '' }) {
  const base = 'inline-flex items-center justify-center gap-2 font-medium rounded-xl transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-transparent disabled:opacity-40 disabled:cursor-not-allowed';

  const variants = {
    primary: 'bg-[#00b4d8] hover:bg-[#0096b7] text-white focus:ring-[#00b4d8] glow-blue',
    secondary: 'glass border border-white/10 hover:border-[#00b4d8]/40 text-[#e0e6f0] hover:text-white',
    ghost: 'hover:bg-white/5 text-[#94a3b8] hover:text-[#e0e6f0]',
    danger: 'bg-red-500/20 border border-red-500/30 hover:bg-red-500/30 text-red-400',
    gold: 'bg-[#f4a261] hover:bg-[#e8935a] text-[#0a0e1a] font-semibold',
  };

  const sizes = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-5 py-2.5 text-sm',
    lg: 'px-7 py-3.5 text-base',
    xl: 'px-10 py-4 text-lg',
  };

  return (
    <motion.button
      whileHover={{ scale: disabled ? 1 : 1.02 }}
      whileTap={{ scale: disabled ? 1 : 0.97 }}
      onClick={onClick}
      disabled={disabled}
      className={`${base} ${variants[variant]} ${sizes[size]} ${className}`}
    >
      {children}
    </motion.button>
  );
}
