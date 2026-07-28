/**
 * pages/ForgotPassword.jsx
 * Modern 3-step recovery flow:
 *  Step 1 — Enter email, send OTP
 *  Step 2 — Verify OTP with masked email display
 *  Step 3 — Reset password with show/hide toggle
 * Includes "Try another way" alternative recovery option.
 */
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-toastify';
import { useTranslation } from 'react-i18next';
import { ShieldCheckIcon, ArrowLeftIcon, CheckBadgeIcon } from '@heroicons/react/24/outline';
import api from '../services/api.js';
import PasswordInput from '../components/ui/PasswordInput.jsx';

const fadeIn = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -20 },
};

export default function ForgotPassword() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [step, setStep] = useState(1); // 1=email, 2=otp, 3=reset, 4=done
  const [email, setEmail] = useState('');
  const [maskedEmail, setMaskedEmail] = useState('');
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [resetToken, setResetToken] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const maskEmailStr = (e) => {
    const [name, domain] = e.split('@');
    return name[0] + '*****@' + domain;
  };

  // Step 1: Send OTP
  const handleSendOTP = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await api.post('/auth/forgot-password/send-otp', { email });
      setMaskedEmail(res.maskedEmail || maskEmailStr(email));
      toast.success('OTP sent to your email');
      setStep(2);
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to send OTP';
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  // Step 2: Verify OTP
  const handleVerifyOTP = async (e) => {
    e.preventDefault();
    const otpStr = otp.join('');
    if (otpStr.length !== 6) {
      setError('Please enter the full 6-digit OTP');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await api.post('/auth/forgot-password/verify-otp', { email, otp: otpStr });
      setResetToken(res.resetToken);
      toast.success('OTP verified! Set your new password');
      setStep(3);
    } catch (err) {
      const msg = err.response?.data?.message || 'Invalid OTP';
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  // Step 3: Reset password
  const handleReset = async (e) => {
    e.preventDefault();
    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await api.post('/auth/forgot-password/reset', { resetToken, password });
      toast.success('Password updated successfully');
      setStep(4);
      setTimeout(() => navigate('/login'), 1500);
    } catch (err) {
      const msg = err.response?.data?.message || 'Reset failed';
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleOtpChange = (index, value) => {
    if (!/^\d*$/.test(value)) return;
    const next = [...otp];
    next[index] = value.slice(0, 1);
    setOtp(next);
    // Auto-advance to next input
    if (value && index < 5) {
      const nextInput = document.getElementById(`otp-${index + 1}`);
      if (nextInput) nextInput.focus();
    }
  };

  const handleOtpKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      const prevInput = document.getElementById(`otp-${index - 1}`);
      if (prevInput) prevInput.focus();
    }
  };

  const handleTryAnotherWay = () => {
    toast.info('Alternative recovery options coming soon');
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-gradient-to-br from-slate-900 to-slate-800">
      <div className="w-full max-w-md">
        <AnimatePresence mode="wait">
          {step === 1 && (
            <motion.div key="step1" {...fadeIn} className="card">
              <div className="flex flex-col items-center mb-6">
                <ShieldCheckIcon className="h-12 w-12 text-cyber-400 animate-float" />
                <h1 className="text-xl font-bold mt-2">{t('auth.forgotPasswordTitle')}</h1>
                <p className="text-sm text-slate-400 mt-1">Enter your registered email to receive a verification code</p>
              </div>
              <form onSubmit={handleSendOTP} className="space-y-4">
                <div>
                  <label className="text-sm text-slate-300">Email Address</label>
                  <input
                    type="email" required className="input w-full"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    autoComplete="email"
                  />
                </div>
                {error && <p className="text-danger text-xs text-center">{error}</p>}
                <button className="btn-primary w-full" disabled={loading}>
                  {loading ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="h-4 w-4 border-2 border-slate-900 border-t-transparent rounded-full animate-spin" />
                      Sending...
                    </span>
                  ) : (
                    'Send Verification Code'
                  )}
                </button>
              </form>
              <Link to="/login" className="flex items-center justify-center gap-1 text-sm text-slate-400 hover:text-primary mt-4">
                <ArrowLeftIcon className="h-4 w-4" /> Back to Login
              </Link>
            </motion.div>
          )}

          {step === 2 && (
            <motion.div key="step2" {...fadeIn} className="card">
              <div className="flex flex-col items-center mb-6">
                <CheckBadgeIcon className="h-12 w-12 text-cyber-400 animate-float" />
                <h1 className="text-xl font-bold mt-2">Verify OTP</h1>
                <p className="text-sm text-slate-400 mt-1 text-center">
                  We sent a 6-digit code to<br />
                  <span className="text-cyber-400 font-mono font-semibold">{maskedEmail}</span>
                </p>
              </div>
              <form onSubmit={handleVerifyOTP} className="space-y-6">
                <div>
                  <label className="text-sm text-slate-300 block text-center mb-3">Enter verification code</label>
                  <div className="flex justify-center gap-2">
                    {otp.map((digit, i) => (
                      <input
                        key={i}
                        id={`otp-${i}`}
                        type="text"
                        inputMode="numeric"
                        maxLength={1}
                        className="w-12 h-14 text-center text-xl font-bold bg-slate-800 border border-slate-600 rounded-lg focus:border-cyber-400 focus:ring-1 focus:ring-cyber-400 outline-none text-white transition-all"
                        value={digit}
                        onChange={(e) => handleOtpChange(i, e.target.value)}
                        onKeyDown={(e) => handleOtpKeyDown(i, e)}
                        autoFocus={i === 0}
                      />
                    ))}
                  </div>
                </div>
                {error && <p className="text-danger text-xs text-center">{error}</p>}
                <button className="btn-primary w-full" disabled={loading || otp.join('').length < 6}>
                  {loading ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="h-4 w-4 border-2 border-slate-900 border-t-transparent rounded-full animate-spin" />
                      Verifying...
                    </span>
                  ) : (
                    'Verify Code'
                  )}
                </button>
                <button
                  type="button"
                  onClick={handleTryAnotherWay}
                  className="w-full text-sm text-cyber-400 hover:text-cyber-300 transition-colors"
                >
                  Try another way
                </button>
              </form>
              <button
                onClick={() => { setStep(1); setError(''); }}
                className="flex items-center justify-center gap-1 text-sm text-slate-400 hover:text-primary mt-4 w-full"
              >
                <ArrowLeftIcon className="h-4 w-4" /> Change email
              </button>
            </motion.div>
          )}

          {step === 3 && (
            <motion.div key="step3" {...fadeIn} className="card">
              <div className="flex flex-col items-center mb-6">
                <ShieldCheckIcon className="h-12 w-12 text-cyber-400 animate-float" />
                <h1 className="text-xl font-bold mt-2">Reset Password</h1>
                <p className="text-sm text-slate-400 mt-1">Choose a strong new password</p>
              </div>
              <form onSubmit={handleReset} className="space-y-4">
                <PasswordInput
                  label="New Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Min. 8 characters"
                  minLength={8}
                  required
                  autoComplete="new-password"
                />
                {error && <p className="text-danger text-xs text-center">{error}</p>}
                <button className="btn-primary w-full" disabled={loading || password.length < 8}>
                  {loading ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="h-4 w-4 border-2 border-slate-900 border-t-transparent rounded-full animate-spin" />
                      Updating...
                    </span>
                  ) : (
                    'Reset Password'
                  )}
                </button>
              </form>
              <button
                onClick={() => { setStep(2); setError(''); }}
                className="flex items-center justify-center gap-1 text-sm text-slate-400 hover:text-primary mt-4 w-full"
              >
                <ArrowLeftIcon className="h-4 w-4" /> Back to OTP
              </button>
            </motion.div>
          )}

          {step === 4 && (
            <motion.div key="step4" {...fadeIn} className="card text-center">
              <div className="flex flex-col items-center mb-6">
                <CheckBadgeIcon className="h-16 w-16 text-green-400" />
                <h1 className="text-xl font-bold mt-2">Password Updated</h1>
                <p className="text-slate-400 mt-1">Your password has been reset successfully. Redirecting to login...</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}