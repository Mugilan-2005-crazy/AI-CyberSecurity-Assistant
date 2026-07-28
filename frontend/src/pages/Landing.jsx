/**
 * pages/Landing.jsx
 * ------------------------------------------------------------
 * Professional SaaS cybersecurity landing page.
 * Sections: Hero, Features, Modules, AI Assistant, Dashboard Preview,
 * Technology Trust, Why Us, Testimonials, FAQ, CTA, Footer.
 * Uses glassmorphism cards, Framer Motion animations, and existing theme.
 */
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import {
  ShieldCheckIcon, LinkIcon, KeyIcon, EnvelopeIcon, DocumentIcon,
  QrCodeIcon, ChatBubbleLeftRightIcon, SparklesIcon, BoltIcon,
  LockClosedIcon, ChartBarIcon, CloudIcon, ServerIcon, CpuChipIcon,
  CheckBadgeIcon, ArrowRightIcon, ChevronDownIcon,
  CodeBracketIcon, GlobeAltIcon, BugAntIcon, EyeIcon,
  FingerPrintIcon, ShieldExclamationIcon,
} from '@heroicons/react/24/outline';
import Card from '../components/ui/Card.jsx';
import Badge from '../components/ui/Badge.jsx';

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5 } },
};

const stagger = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.08 } },
};

const SectionTitle = ({ eyebrow, title, subtitle }) => (
  <div className="text-center max-w-2xl mx-auto mb-12">
    {eyebrow && <Badge tone="info" className="mb-3">{eyebrow}</Badge>}
    <h2 className="text-3xl sm:text-4xl font-bold">{title}</h2>
    {subtitle && <p className="text-slate-400 mt-3">{subtitle}</p>}
  </div>
);

const FEATURES = [
  { icon: LinkIcon, title: 'URL Scanner', desc: 'Detect phishing, brand impersonation, suspicious TLDs, and insecure transports in seconds.' },
  { icon: KeyIcon, title: 'Password Analyzer', desc: 'Estimate Shannon entropy, crack time, and breach exposure with actionable improvement tips.' },
  { icon: EnvelopeIcon, title: 'Email Phishing Detector', desc: 'Flag suspicious senders, urgency tactics, and malicious links or attachments with AI explanation.' },
  { icon: DocumentIcon, title: 'File Malware Scanner', desc: 'SHA-256 hash and screen uploads against VirusTotal malware intelligence.' },
  { icon: QrCodeIcon, title: 'QR Code Safety Checker', desc: 'Decode and inspect QR targets via live camera before you scan them in the wild.' },
  { icon: ChatBubbleLeftRightIcon, title: 'AI Security Chatbot', desc: 'Multimodal AI chat with Gemini + Ollama — ask questions, upload files, get security reports.' },
  { icon: ChartBarIcon, title: 'Security Reports', desc: 'Generate professional PDF reports with risk scores, threat analysis, and remediation steps.' },
];

const MODULES = [
  { icon: EyeIcon, name: 'URL Scanner', tag: 'Phishing / SSL' },
  { icon: FingerPrintIcon, name: 'Password Analyzer', tag: 'Entropy / Breach' },
  { icon: ShieldExclamationIcon, name: 'Email Phishing', tag: 'Social Eng.' },
  { icon: BugAntIcon, name: 'File Scanner', tag: 'Malware' },
  { icon: QrCodeIcon, name: 'QR Checker', tag: 'Decode / Safety' },
  { icon: ChatBubbleLeftRightIcon, name: 'AI Chatbot', tag: 'Gemini / Ollama' },
  { icon: DocumentIcon, name: 'PDF Reports', tag: 'Export' },
];

const TECH = [
  { icon: SparklesIcon, name: 'Google Gemini AI', desc: 'Cloud-based conversational AI for threat analysis and guidance.' },
  { icon: CpuChipIcon, name: 'Ollama Local AI', desc: 'On-premise Llama 3.1 for private, offline security queries.' },
  { icon: ServerIcon, name: 'Node.js + Express', desc: 'REST API with MVC, JWT auth, rate limiting, and validation.' },
  { icon: CloudIcon, name: 'MongoDB Atlas', desc: 'Document store for scans, chat logs, user profiles, and reports.' },
  { icon: CodeBracketIcon, name: 'React 18 + Vite', desc: 'Modern frontend with Tailwind CSS, Framer Motion, and i18n.' },
  { icon: LockClosedIcon, name: 'JWT Auth + bcrypt', desc: 'Secure access + refresh tokens with httpOnly cookies.' },
];

const WHY = [
  'Privacy-first: passwords are hashed with bcrypt, secrets never stored in plaintext.',
  'Real-time risk scoring (0–100) across every security module.',
  'Actionable, plain-language recommendations from AI assistant.',
  'Exportable PDF & CSV reports for compliance and audits.',
  'Responsive dashboard optimized for desktop, tablet, and mobile.',
  'Graceful degradation if a third-party service is offline.',
];

const TESTIMONIALS = [
  { name: 'Priya R.', role: 'Security Analyst', quote: 'The URL and email scanners caught impersonation attempts our old tool missed. Huge time saver.' },
  { name: 'Marcus T.', role: 'IT Administrator', quote: 'The live dashboard gives our team one place to track threat posture. The AI chatbot is a game changer.' },
  { name: 'Elena K.', role: 'Small Business Owner', quote: 'I am not technical, but the AI chat explains risks in a way I actually understand. Highly recommend.' },
];

const FAQ = [
  { q: 'Is my data stored securely?', a: 'Yes. Passwords are hashed with bcrypt (12 rounds) and secrets are never persisted in plaintext. Scan metadata is stored for your history only.' },
  { q: 'Do I need to install anything?', a: 'No. Cyber Security Assistant runs entirely in your browser — just sign up and start scanning immediately.' },
  { q: 'What AI models are used?', a: 'We support Google Gemini (cloud) and Ollama with Llama 3.1 (local). The AI router selects the best provider based on query complexity.' },
  { q: 'Can I export my scan history?', a: 'Yes. You can export your activity as PDF or CSV from the Reports page at any time.' },
  { q: 'Is it free to try?', a: 'Absolutely. Create an account and run scans immediately. No credit card required.' },
];

const NAV = [
  { href: '#features', label: 'Features' },
  { href: '#modules', label: 'Modules' },
  { href: '#ai', label: 'AI Assistant' },
  { href: '#tech', label: 'Tech Stack' },
  { href: '#faq', label: 'FAQ' },
];

export default function Landing() {
  return (
    <div className="min-h-screen bg-surface-light dark:bg-surface-dark text-slate-800 dark:text-slate-100">
      {/* ─── Top Navigation ─────────────────────────── */}
      <header className="sticky top-0 z-40 backdrop-blur-xl bg-white/70 dark:bg-surface-card/70 border-b border-slate-200 dark:border-slate-800">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <a href="#top" className="flex items-center gap-2 font-bold text-lg">
            <ShieldCheckIcon className="h-7 w-7 text-cyber-400" />
            CyberSec
          </a>
          <nav className="hidden md:flex items-center gap-6 text-sm text-slate-500 dark:text-slate-300">
            {NAV.map((n) => (
              <a key={n.href} href={n.href} className="hover:text-primary transition-colors">{n.label}</a>
            ))}
          </nav>
          <div className="flex items-center gap-2">
            <Link to="/login" className="btn px-3 py-1.5 text-sm">Login</Link>
            <Link to="/register" className="btn-primary px-3 py-1.5 text-sm">Register</Link>
          </div>
        </div>
      </header>

      {/* ─── Hero Section ───────────────────────────── */}
      <section id="top" className="relative overflow-hidden">
        {/* Background gradient effects */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-cyber-500/10 pointer-events-none" />
        <div className="absolute top-20 left-10 w-72 h-72 bg-cyber-500/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-10 right-10 w-96 h-96 bg-primary/10 rounded-full blur-3xl pointer-events-none" />

        <motion.div
          className="relative max-w-6xl mx-auto px-4 py-20 sm:py-32 text-center"
          initial="hidden" whileInView="show" viewport={{ once: true }}
          variants={fadeUp}
        >
          {/* AI Shield icon animation */}
          <motion.div
            className="mx-auto mb-6 w-20 h-20 rounded-2xl bg-gradient-to-br from-cyber-400 to-primary flex items-center justify-center"
            animate={{ y: [0, -8, 0], rotate: [0, 5, 0] }}
            transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
          >
            <ShieldCheckIcon className="h-10 w-10 text-white" />
          </motion.div>

          <Badge tone="success" className="mb-5">AI-Powered Cyber Security Assistant</Badge>
          <h1 className="text-4xl sm:text-6xl font-bold leading-tight">
            Stay ahead of threats with your{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyber-400 to-primary">AI Security Assistant</span>
          </h1>
          <p className="mt-5 text-lg text-slate-500 dark:text-slate-300 max-w-2xl mx-auto">
            Scan URLs, passwords, emails, files, and QR codes — then get plain-language guidance
            from an AI assistant powered by <strong>Google Gemini</strong> and <strong>Ollama</strong>.
            Built for everyday cybersecurity, no expertise required.
          </p>

          {/* CTA Buttons */}
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link to="/register" className="btn-cyber px-6 py-3 text-base inline-flex items-center gap-2">
              Get Started <ArrowRightIcon className="h-4 w-4" />
            </Link>
            <Link to="/login" className="relative px-6 py-3 text-base rounded-xl font-medium
              border border-cyber-500/50 text-cyber-400 
              hover:bg-cyber-500/10 transition-all duration-300
              inline-flex items-center gap-2">
              <SparklesIcon className="h-4 w-4" />
              Try AI Assistant
            </Link>
          </div>

          {/* Floating stats bar */}
          <motion.div
            className="mt-12 flex flex-wrap justify-center gap-8 text-sm"
            initial="hidden" whileInView="show" viewport={{ once: true }}
            variants={stagger}
          >
            {[
              { label: 'Security Modules', value: '7' },
              { label: 'AI Models', value: '2' },
              { label: 'Export Formats', value: 'PDF / CSV' },
              { label: 'Languages', value: '4' },
            ].map((s) => (
              <motion.div key={s.label} variants={fadeUp} className="text-center">
                <p className="text-2xl font-bold text-cyber-400">{s.value}</p>
                <p className="text-slate-400 text-xs">{s.label}</p>
              </motion.div>
            ))}
          </motion.div>
        </motion.div>
      </section>

      {/* ─── Features ──────────────────────────────── */}
      <section id="features" className="max-w-6xl mx-auto px-4 py-16">
        <SectionTitle
          eyebrow="Capabilities"
          title="Everything you need to stay safe"
          subtitle="Seven focused security modules, one unified dashboard with AI-powered insights."
        />
        <motion.div
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5"
          initial="hidden" whileInView="show" viewport={{ once: true }}
          variants={stagger}
        >
          {FEATURES.map((f, i) => (
            <motion.div key={f.title} variants={fadeUp}>
              <Card className="h-full hover:border-cyber-400/50 transition-all duration-300 hover:shadow-lg hover:shadow-cyber-500/5 group backdrop-blur-sm bg-white/50 dark:bg-surface-card/50">
                <div className="p-3 rounded-xl bg-gradient-to-br from-cyber-500/20 to-primary/20 text-cyber-400 w-fit mb-4 group-hover:scale-110 transition-transform duration-300">
                  <f.icon className="h-6 w-6" />
                </div>
                <h3 className="text-lg font-semibold">{f.title}</h3>
                <p className="text-sm text-slate-400 mt-2">{f.desc}</p>
              </Card>
            </motion.div>
          ))}
        </motion.div>
      </section>

      {/* ─── Security Modules Overview ──────────────── */}
      <section id="modules" className="max-w-6xl mx-auto px-4 py-16">
        <SectionTitle
          eyebrow="Modules"
          title="Security modules overview"
          subtitle="Each module returns a 0–100 risk score and a clear, actionable verdict."
        />
        <motion.div
          className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-4"
          initial="hidden" whileInView="show" viewport={{ once: true }}
          variants={stagger}
        >
          {MODULES.map((m) => (
            <motion.div key={m.name} variants={fadeUp}>
              <Card className="text-center hover:border-cyber-400/50 transition-all duration-300 hover:-translate-y-1 backdrop-blur-sm bg-white/50 dark:bg-surface-card/50">
                <div className="mx-auto p-3 rounded-xl bg-gradient-to-br from-cyber-500/20 to-primary/20 text-cyber-400 w-fit mb-3">
                  <m.icon className="h-6 w-6" />
                </div>
                <p className="font-medium text-sm">{m.name}</p>
                <p className="text-xs text-slate-400 mt-1">{m.tag}</p>
              </Card>
            </motion.div>
          ))}
        </motion.div>
      </section>

      {/* ─── AI Assistant Highlight ─────────────────── */}
      <section id="ai" className="max-w-6xl mx-auto px-4 py-16">
        <div className="grid lg:grid-cols-2 gap-8 items-center">
          <motion.div initial="hidden" whileInView="show" viewport={{ once: true }} variants={fadeUp}>
            <Badge tone="info" className="mb-3">
              <SparklesIcon className="h-4 w-4 inline mr-1" />
              AI Assistant
            </Badge>
            <h2 className="text-3xl font-bold">Ask anything about cybersecurity</h2>
            <p className="text-slate-400 mt-3">
              Not sure what a warning means? Chat with the assistant to get explanations, best
              practices, and step-by-step remediation — no jargon required.
            </p>
            <ul className="mt-5 space-y-2 text-sm text-slate-500 dark:text-slate-300">
              {[
                'Plain-language threat explanations from Gemini AI',
                'On-premise analysis with Ollama local AI',
                'Multimodal file analysis (PDF, images, videos)',
                'Voice input and text-to-speech output',
              ].map((t) => (
                <li key={t} className="flex items-center gap-2">
                  <CheckBadgeIcon className="h-5 w-5 text-cyber-400 shrink-0" /> {t}
                </li>
              ))}
            </ul>
            <Link to="/register" className="btn-cyber mt-6 inline-flex items-center gap-2">
              Try the assistant <ArrowRightIcon className="h-4 w-4" />
            </Link>
          </motion.div>

          <motion.div
            initial="hidden" whileInView="show" viewport={{ once: true }}
            variants={fadeUp}
            className="relative backdrop-blur-xl bg-white/30 dark:bg-surface-card/30 rounded-2xl p-5 space-y-3 border border-slate-200 dark:border-slate-700"
          >
            <div className="flex items-center gap-2 text-cyber-400">
              <ChatBubbleLeftRightIcon className="h-5 w-5" />
              <span className="font-medium">AI Security Assistant</span>
              <span className="ml-auto text-xs text-slate-400">Gemini · Ollama</span>
            </div>
            <div className="bg-slate-100 dark:bg-slate-800 rounded-xl p-3 text-sm">
              How can I spot a phishing email?
            </div>
            <div className="bg-gradient-to-r from-primary/10 to-cyber-500/10 text-primary rounded-xl p-3 text-sm">
              Watch for urgency, mismatched sender domains, and links that don't match the text.
              Never enter credentials via unsolicited messages.
            </div>
            <div className="bg-slate-100 dark:bg-slate-800 rounded-xl p-3 text-sm">
              What makes a strong password?
            </div>
            <div className="bg-gradient-to-r from-primary/10 to-cyber-500/10 text-primary rounded-xl p-3 text-sm">
              Use 16+ characters, a mix of types, and a unique password per site — a password manager helps.
            </div>
          </motion.div>
        </div>
      </section>

      {/* ─── Dashboard Preview ──────────────────────── */}
      <section className="max-w-6xl mx-auto px-4 py-16">
        <SectionTitle
          eyebrow="Live Insights"
          title="Your security, at a glance"
          subtitle="Track total scans, risk levels, and recent activity in one place."
        />
        <motion.div initial="hidden" whileInView="show" viewport={{ once: true }} variants={fadeUp}>
          <Card className="overflow-hidden backdrop-blur-sm bg-white/50 dark:bg-surface-card/50 border border-slate-200 dark:border-slate-700">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-5">
              {[
                { icon: ShieldCheckIcon, label: 'Total Scans', value: '2,847' },
                { icon: BoltIcon, label: 'Safe', value: '2,104' },
                { icon: LockClosedIcon, label: 'Flagged', value: '743' },
                { icon: ChatBubbleLeftRightIcon, label: 'AI Chats', value: '1,892' },
              ].map((s) => (
                <div key={s.label} className="text-center">
                  <s.icon className="h-6 w-6 mx-auto text-cyber-400" />
                  <p className="text-2xl font-bold mt-2">{s.value}</p>
                  <p className="text-xs text-slate-400">{s.label}</p>
                </div>
              ))}
            </div>
            <div className="border-t border-slate-200 dark:border-slate-700 p-5 grid sm:grid-cols-3 gap-3">
              {[
                { label: 'URL Scans', value: 78 },
                { label: 'Password Checks', value: 42 },
                { label: 'File Scans', value: 91 },
              ].map((h, i) => (
                <div key={i} className="space-y-2">
                  <div className="flex justify-between text-xs text-slate-400">
                    <span>{h.label}</span>
                    <span>{h.value}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                    <motion.div
                      className="h-full rounded-full bg-gradient-to-r from-cyber-400 to-primary"
                      initial={{ width: 0 }}
                      whileInView={{ width: `${h.value}%` }}
                      viewport={{ once: true }}
                      transition={{ duration: 1, delay: i * 0.2 }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </motion.div>
      </section>

      {/* ─── Technology Trust ───────────────────────── */}
      <section id="tech" className="max-w-6xl mx-auto px-4 py-16">
        <SectionTitle
          eyebrow="Technology Trust"
          title="Built with modern, reliable technology"
          subtitle="A production-ready stack engineered for performance, privacy, and safety."
        />
        <motion.div
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5"
          initial="hidden" whileInView="show" viewport={{ once: true }}
          variants={stagger}
        >
          {TECH.map((t, i) => (
            <motion.div key={t.name} variants={fadeUp}>
              <Card className="flex items-start gap-3 h-full hover:border-cyber-400/50 transition-all duration-300 backdrop-blur-sm bg-white/50 dark:bg-surface-card/50">
                <div className="p-2.5 rounded-xl bg-gradient-to-br from-cyber-500/20 to-primary/20 text-cyber-400">
                  <t.icon className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-medium">{t.name}</p>
                  <p className="text-xs text-slate-400 mt-1">{t.desc}</p>
                </div>
              </Card>
            </motion.div>
          ))}
        </motion.div>

        {/* Trust badges row */}
        <motion.div
          className="mt-10 flex flex-wrap justify-center gap-6 opacity-60"
          initial="hidden" whileInView="show" viewport={{ once: true }}
          variants={stagger}
        >
          {['Gemini AI', 'Ollama', 'MongoDB', 'React', 'Node.js', 'Tailwind CSS'].map((name) => (
            <motion.div key={name} variants={fadeUp} className="text-sm font-semibold text-slate-400 tracking-wide">
              {name}
            </motion.div>
          ))}
        </motion.div>
      </section>

      {/* ─── Why Choose ─────────────────────────────── */}
      <section className="max-w-6xl mx-auto px-4 py-16">
        <SectionTitle eyebrow="Why CyberSec" title="Why choose Cyber Security Assistant" />
        <motion.div
          className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4"
          initial="hidden" whileInView="show" viewport={{ once: true }}
          variants={stagger}
        >
          {WHY.map((w, i) => (
            <motion.div key={w} variants={fadeUp}>
              <Card className="flex items-center gap-3 h-full backdrop-blur-sm bg-white/50 dark:bg-surface-card/50">
                <CheckBadgeIcon className="h-5 w-5 text-cyber-400 shrink-0" />
                <p className="text-sm">{w}</p>
              </Card>
            </motion.div>
          ))}
        </motion.div>
      </section>

      {/* ─── Testimonials ───────────────────────────── */}
      <section className="max-w-6xl mx-auto px-4 py-16">
        <SectionTitle eyebrow="Loved by users" title="What people are saying" />
        <motion.div
          className="grid md:grid-cols-3 gap-5"
          initial="hidden" whileInView="show" viewport={{ once: true }}
          variants={stagger}
        >
          {TESTIMONIALS.map((t, i) => (
            <motion.div key={t.name} variants={fadeUp}>
              <Card className="h-full backdrop-blur-sm bg-white/50 dark:bg-surface-card/50">
                <p className="text-slate-500 dark:text-slate-300 italic">"{t.quote}"</p>
                <div className="mt-4 flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-gradient-to-br from-cyber-400 to-primary flex items-center justify-center text-white font-bold">
                    {t.name.charAt(0)}
                  </div>
                  <div>
                    <p className="text-sm font-medium">{t.name}</p>
                    <p className="text-xs text-slate-400">{t.role}</p>
                  </div>
                </div>
              </Card>
            </motion.div>
          ))}
        </motion.div>
      </section>

      {/* ─── FAQ ────────────────────────────────────── */}
      <section id="faq" className="max-w-3xl mx-auto px-4 py-16">
        <SectionTitle eyebrow="FAQ" title="Frequently asked questions" />
        <div className="space-y-3">
          {FAQ.map((item) => (
            <details
              key={item.q}
              className="group rounded-xl border border-slate-200 dark:border-slate-700 bg-white/50 dark:bg-surface-card/50 backdrop-blur-sm p-4"
            >
              <summary className="cursor-pointer font-medium flex items-center justify-between">
                {item.q}
                <ChevronDownIcon className="h-5 w-5 text-slate-400 group-open:rotate-180 transition-transform shrink-0 ml-2" />
              </summary>
              <p className="text-sm text-slate-400 mt-2">{item.a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* ─── CTA ────────────────────────────────────── */}
      <section className="max-w-6xl mx-auto px-4 pb-20">
        <Card className="text-center bg-gradient-to-br from-cyber-500/10 via-primary/10 to-cyber-500/10 border-none backdrop-blur-sm">
          <h2 className="text-3xl font-bold">Start protecting yourself today</h2>
          <p className="text-slate-400 mt-2">Create a free account and run your first security scan in under a minute.</p>
          <div className="mt-6 flex flex-col sm:flex-row justify-center gap-3">
            <Link to="/register" className="btn-cyber px-6 py-3">Get Started Free</Link>
            <Link to="/login" className="btn px-6 py-3 border border-slate-300 dark:border-slate-600">Sign In</Link>
          </div>
        </Card>
      </section>

      {/* ─── Footer ─────────────────────────────────── */}
      <footer className="border-t border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-surface-card/50 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto px-4 py-12 grid md:grid-cols-4 gap-8 text-sm">
          {/* Brand */}
          <div className="md:col-span-1">
            <div className="flex items-center gap-2 font-bold text-lg mb-3">
              <ShieldCheckIcon className="h-6 w-6 text-cyber-400" />
              CyberSec Assistant
            </div>
            <p className="text-slate-400 leading-relaxed">
              AI-powered cybersecurity assistant. Scan, learn, and stay safe.
            </p>
            <div className="flex items-center gap-3 mt-4">
              <a
                href="https://github.com/Mugilan-2005-crazy/AI-CyberSecurity-Assistant"
                target="_blank"
                rel="noopener noreferrer"
                className="text-slate-400 hover:text-cyber-400 transition-colors"
                aria-label="GitHub"
              >
                <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.3 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61-.546-1.385-1.335-1.755-1.335-1.755-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 21.795 24 17.295 24 12 24 5.37 18.63 0 12 0z"/></svg>
              </a>
              <a
                href="https://github.com/Mugilan-2005-crazy"
                target="_blank"
                rel="noopener noreferrer"
                className="text-slate-400 hover:text-cyber-400 transition-colors text-xs"
              >
                @Mugilan-2005-crazy
              </a>
            </div>
          </div>

          {/* Product Links */}
          <div>
            <p className="font-semibold mb-3">Product</p>
            <ul className="space-y-2 text-slate-400">
              <li><a href="#features" className="hover:text-primary transition-colors">Features</a></li>
              <li><a href="#modules" className="hover:text-primary transition-colors">Modules</a></li>
              <li><a href="#ai" className="hover:text-primary transition-colors">AI Assistant</a></li>
              <li><a href="#tech" className="hover:text-primary transition-colors">Tech Stack</a></li>
              <li><a href="#faq" className="hover:text-primary transition-colors">FAQ</a></li>
            </ul>
          </div>

          {/* Tech Stack */}
          <div>
            <p className="font-semibold mb-3">Powered By</p>
            <ul className="space-y-2 text-slate-400">
              <li>Google Gemini AI</li>
              <li>Ollama (Llama 3.1)</li>
              <li>MongoDB Atlas</li>
              <li>React + Vite</li>
              <li>Node.js + Express</li>
            </ul>
          </div>

          {/* Contact */}
          <div>
            <p className="font-semibold mb-3">Contact & Support</p>
            <ul className="space-y-2 text-slate-400">
              <li>
                <a href="mailto:hello@cybersec.io" className="hover:text-primary transition-colors">
                  hello@cybersec.io
                </a>
              </li>
              <li>
                <a href="mailto:security@cybersec.io" className="hover:text-primary transition-colors">
                  security@cybersec.io
                </a>
              </li>
              <li className="mt-3">
                <a
                  href="https://github.com/Mugilan-2005-crazy/AI-CyberSecurity-Assistant/issues"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 hover:text-primary transition-colors"
                >
                  <BugAntIcon className="h-4 w-4" />
                  Report Issue
                </a>
              </li>
              <li>
                <Link to="/login" className="hover:text-primary transition-colors">
                  Sign In
                </Link>
                {' · '}
                <Link to="/register" className="hover:text-primary transition-colors">
                  Register
                </Link>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="border-t border-slate-200 dark:border-slate-800 py-4 text-center text-xs text-slate-400">
          <p>
            © {new Date().getFullYear()} Cyber Security Assistant.
            Built with ❤️ for cybersecurity awareness and education.
            {' '}
            <a
              href="https://github.com/Mugilan-2005-crazy"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-primary transition-colors"
            >
              Mugilan
            </a>
            {' · '}
            B.Tech Information Technology
          </p>
        </div>
      </footer>
    </div>
  );
}