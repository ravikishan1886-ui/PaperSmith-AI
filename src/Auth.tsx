import React, { useState } from 'react';
import { motion } from 'motion/react';
import { LayoutDashboard, Lock, Mail, User } from 'lucide-react';

interface AuthProps {
  onLogin: (email: string) => void;
}

export default function Auth({ onLogin }: AuthProps) {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (email && password) {
      if (!isLogin && !name) return;
      
      // Store in localStorage for simple simulation
      if (isLogin) {
        const storedUserstr = localStorage.getItem('users');
        const users = storedUserstr ? JSON.parse(storedUserstr) : [];
        if (users.find((u: any) => u.email === email && u.password === password)) {
           onLogin(email);
        } else {
           alert("Invalid email or password. Please sign up if you don't have an account.");
        }
      } else {
        const storedUserstr = localStorage.getItem('users');
        const users = storedUserstr ? JSON.parse(storedUserstr) : [];
        if (users.find((u: any) => u.email === email)) {
           alert("Email already registered!");
        } else {
           users.push({ email, password, name });
           localStorage.setItem('users', JSON.stringify(users));
           onLogin(email);
        }
      }
    }
  };

  return (
    <div className="min-h-screen bg-dark-bg flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md bg-dark-surface border border-dark-border rounded-2xl p-8"
      >
        <div className="flex flex-col items-center mb-8">
          <div className="flex items-center gap-2 text-white font-bold text-2xl tracking-tight mb-2">
            PaperSmith <span className="text-accent-green">AI</span>
          </div>
          <p className="text-sm text-slate-400">
            {isLogin ? "Sign in to your account" : "Create a new account"}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {!isLogin && (
            <div>
              <label className="text-[10px] uppercase tracking-widest text-slate-500 font-bold ml-1">Full Name</label>
              <div className="relative mt-1">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input 
                  type="text" 
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  placeholder="Ravi Kishan"
                  className="w-full bg-dark-panel border border-dark-border rounded-lg py-3 pl-10 pr-4 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-accent-green transition-colors"
                />
              </div>
            </div>
          )}

          <div>
            <label className="text-[10px] uppercase tracking-widest text-slate-500 font-bold ml-1">Email Address</label>
            <div className="relative mt-1">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input 
                type="email" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="teacher@school.edu"
                className="w-full bg-dark-panel border border-dark-border rounded-lg py-3 pl-10 pr-4 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-accent-green transition-colors"
              />
            </div>
          </div>

          <div>
            <label className="text-[10px] uppercase tracking-widest text-slate-500 font-bold ml-1">Password</label>
            <div className="relative mt-1">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input 
                type="password" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="••••••••"
                className="w-full bg-dark-panel border border-dark-border rounded-lg py-3 pl-10 pr-4 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-accent-green transition-colors"
              />
            </div>
          </div>

          <button 
            type="submit"
            className="w-full bg-accent-green text-black font-bold py-3.5 rounded-lg hover:brightness-110 transition-all mt-6"
          >
            {isLogin ? "SIGN IN" : "CREATE ACCOUNT"}
          </button>
        </form>

        <div className="mt-6 text-center">
          <button 
            onClick={() => setIsLogin(!isLogin)}
            className="text-sm text-slate-400 hover:text-white transition-colors"
          >
            {isLogin ? "Don't have an account? Sign up" : "Already have an account? Sign in"}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
