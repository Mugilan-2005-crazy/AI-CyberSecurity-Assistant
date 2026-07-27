/**
 * pages/Landing.jsx
 * ------------------------------------------------------------
 * Public enterprise landing page for the Cyber Security Assistant.
 * No authentication required. Composes 10 sections (hero, features,
 * modules, AI assistant, dashboard preview, tech, why-us, testimonials,
 * FAQ, footer) with smooth scrolling and subtle framer-motion
 * animations, reusing the shared theme tokens, Card, and Badge.
 */
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import {
  ShieldCheckIcon, LinkIcon, KeyIcon, EnvelopeIcon, DocumentIcon,
  QrCodeIcon, ChatBubbleLeftRightIcon, SparklesIcon, BoltIcon,
  LockClosedIcon, ChartBarIcon, CloudIcon, ServerIcon, CpuChipIcon,
  CheckBadgeIcon, ArrowRightIcon, ChevronDownIcon,
} from '@heroicons/react/24/outline';
import Card from '../components/ui/Card.jsx';
import Badge from '../components/ui/Badge.jsx';

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5 } },
};

const SectionTitle = ({ eyebrow, title, subtitle }) => (
  <div className="text-center max-w-2xl mx-auto mb-12">
    {eyebrow && <Badge tone="info" className="mb-3">{eyebrow}</Badge>}
    <h2 className="text-3xl sm:text-4xl font-bold">{title}</h2>
    {subtitle && <p className="text-slate-400 mt-3">{subtitle}</p>}
  </div>
);

const FEATURES = [
  { icon: LinkIcon, title: 'URL Threat Scanner', desc: 'Detect phishing, brand impersonation, and insecure transports in seconds.' },
  { icon: KeyIcon, title: 'Password Strength', desc: 'Estimate entropy, crack time, and breach exposure with actionable advice.' },
  { icon: EnvelopeIcon, title: 'Email Phishing', desc: 'Flag suspicious senders, urgency tactics, and malicious links or attachments.' },
  { icon: DocumentIcon, title: 'File Malware Scan', desc: 'Hash and screen uploads against known malware intelligence.' },
  { icon: QrCodeIcon, title: 'QR Code Checker', desc: 'Decode and inspect QR targets before you scan them in the wild.' },
  { icon: ChatBubbleLeftRightIcon, title: 'AI Security Chat', desc: 'Ask plain-language questions and get guidance from the assistant.' },
];

const MODULES = [
  { icon: LinkIcon, name: 'URL Scanner', tag: 'Phishing / SSL' },
  { icon: KeyIcon, name: 'Password Analyzer', tag: 'Entropy / Breach' },
  { icon: EnvelopeIcon, name: 'Email Phishing', tag: 'Social Eng.' },
  { icon: DocumentIcon, name: 'File Scanner', tag: 'Malware' },
  { icon: QrCodeIcon, name: 'QR Checker', tag: 'Decode' },
  { icon: ChatBubbleLeftRightIcon, name: 'AI Chatbot', tag: 'Guidance' },
];

const TECH = [
  { icon: ServerIcon, name: 'Node.js + Express', desc: 'REST API with auth, rate limiting, and validation.' },
  { icon: CpuChipIcon, name: 'MongoDB', desc: 'Document store for scans, history, and chat logs.' },
  { icon: SparklesIcon, name: 'Gemini AI', desc: 'Conversational security assistance.' },
  { icon: CloudIcon, name: 'VirusTotal', desc: 'File reputation and malware intelligence.' },
  { icon: ChartBarIcon, name: 'Chart.js', desc: 'Live dashboards and analytics.' },
  { icon: LockClosedIcon, name: 'JWT Auth', desc: 'Secure access + refresh tokens.' },
];

const WHY = [
  'Privacy-first: secrets are never stored in plaintext.',
  'Real-time risk scoring across every module.',
  'Actionable, plain-language recommendations.',
  'Exportable PDF & CSV reports for audits.',
  'Responsive dashboard for desktop and mobile.',
  'Graceful degradation if a service is offline.',
];

const TESTIMONIALS = [
  { name: 'Priya R.', role: 'Security Analyst', quote: 'The URL and email scanners caught impersonation attempts our old tool missed. Huge time saver.' },
  { name: 'Marcus T.', role: 'IT Admin', quote: 'Love the live dashboard. Our team finally has one place to track threat posture.' },
  { name: 'Elena K.', role: 'Small Business Owner', quote: 'I am not technical, but the AI chat explains risks in a way I actually understand.' },
];

const FAQ = [
  { q: 'Is my data stored securely?', a: 'Yes. Passwords are hashed with bcrypt and secrets are never persisted in plaintext. Scan metadata is stored for your history only.' },
  { q: 'Do I need to install anything?', a: 'No. Cyber Security Assistant runs in your browser — just sign up and start scanning.' },
  { q: 'What does the AI assistant do?', a: 'It answers cybersecurity questions, explains threats, and suggests practical steps in plain language.' },
  { q: 'Can I export my scan history?', a: 'Yes. You can export your activity as PDF or CSV from the Reports page.' },
  { q: 'Is it free to try?', a: 'You can create an account and run scans immediately. No credit card required.' },
];

const NAV = [
  { href: '#features', label: 'Features' },
  { href: '#modules', label: 'Modules' },
  { href: '#ai', label: 'AI Assistant' },
  { href: '#tech', label: 'Tech' },
  { href: '#faq', label: 'FAQ' },
];

export default function Landing() {
  return (
    <div className="min-h-screen bg-surface-light dark:bg-surface-dark text-slate-800 dark:text-slate-100">
      {/* Top navigation */}
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

      {/* Hero */}
      <section id="top" className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-cyber-500/10 pointer-events-none" />
        <motion.div
          className="relative max-w-6xl mx-auto px-4 py-20 sm:py-28 text-center"
          initial="hidden" whileInView="show" viewport={{ once: true }}
          variants={fadeUp}
        >
          <Badge tone="success" className="mb-5">AI-Powered Cyber Security</Badge>
          <h1 className="text-4xl sm:text-6xl font-bold leading-tight">
            Stay ahead of threats with your <span className="text-cyber-400">AI Security Assistant</span>
          </h1>
          <p className="mt-5 text-lg text-slate-500 dark:text-slate-300 max-w-2xl mx-auto">
            Scan URLs, passwords, emails, files, and QR codes — then get plain-language guidance
            from an AI assistant built for everyday security.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link to="/register" className="btn-cyber px-6 py-3 text-base">Get Started</Link>
            <Link to="/login" className="btn px-6 py-3 text-base border border-slate-300 dark:border-slate-600">Login</Link>
            <a href="#features" className="px-6 py-3 text-base text-primary hover:underline inline-flex items-center gap-1">
              Learn More <ChevronDownIcon className="h-4 w-4 animate-bounce" />
            </a>
          </div>
        </motion.div>
      </section>

      {/* Features */}
      <section id="features" className="max-w-6xl mx-auto px-4 py-16">
        <SectionTitle eyebrow="Capabilities" title="Everything you need to stay safe" subtitle="Six focused modules, one unified dashboard." />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {FEATURES.map((f, i) => (
            <motion.div key={f.title} initial="hidden" whileInView="show" viewport={{ once: true }} variants={fadeUp} transition={{ delay: i * 0.05 }}>
              <Card className="h-full hover:border-primary/50 transition-colors">
                <div className="p-3 rounded-xl bg-primary/10 text-primary w-fit mb-4">
                  <f.icon className="h-6 w-6" />
                </div>
                <h3 className="text-lg font-semibold">{f.title}</h3>
                <p className="text-sm text-slate-400 mt-2">{f.desc}</p>
              </Card>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Security Modules Overview */}
      <section id="modules" className="max-w-6xl mx-auto px-4 py-16">
        <SectionTitle eyebrow="Modules" title="Security modules overview" subtitle="Each module returns a 0–100 risk score and a clear verdict." />
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          {MODULES.map((m) => (
            <Card key={m.name} className="text-center hover:border-cyber-400/50 transition-colors">
              <div className="mx-auto p-3 rounded-xl bg-cyber-500/10 text-cyber-400 w-fit mb-3">
                <m.icon className="h-6 w-6" />
              </div>
              <p className="font-medium text-sm">{m.name}</p>
              <p className="text-xs text-slate-400 mt-1">{m.tag}</p>
            </Card>
          ))}
        </div>
      </section>

      {/* AI Assistant Highlight */}
      <section id="ai" className="max-w-6xl mx-auto px-4 py-16">
        <div className="grid lg:grid-cols-2 gap-8 items-center">
          <motion.div initial="hidden" whileInView="show" viewport={{ once: true }} variants={fadeUp}>
            <Badge tone="info" className="mb-3">AI Assistant</Badge>
            <h2 className="text-3xl font-bold">Ask anything about cybersecurity</h2>
            <p className="text-slate-400 mt-3">
              Not sure what a warning means? Chat with the assistant to get explanations, best
              practices, and step-by-step remediation — no jargon required.
            </p>
            <ul className="mt-5 space-y-2 text-sm text-slate-500 dark:text-slate-300">
              {['Plain-language threat explanations', 'Password & browsing guidance', 'How our tools work'].map((t) => (
                <li key={t} className="flex items-center gap-2">
                  <CheckBadgeIcon className="h-5 w-5 text-cyber-400" /> {t}
                </li>
              ))}
            </ul>
            <Link to="/register" className="btn-cyber mt-6 inline-flex items-center gap-2">Try the assistant <ArrowRightIcon className="h-4 w-4" /></Link>
          </motion.div>
          <motion.div initial="hidden" whileInView="show" viewport={{ once: true }} variants={fadeUp} className="glass rounded-2xl p-5 space-y-3">
            <div className="flex items-center gap-2 text-cyber-400">
              <ChatBubbleLeftRightIcon className="h-5 w-5" /> <span className="font-medium">AI Security Assistant</span>
            </div>
            <div className="bg-slate-100 dark:bg-slate-800 rounded-xl p-3 text-sm">
              How can I spot a phishing email?
            </div>
            <div className="bg-primary/10 text-primary rounded-xl p-3 text-sm">
              Watch for urgency, mismatched sender domains, and links that don't match the text.
              Never enter credentials via unsolicited messages.
            </div>
            <div className="bg-slate-100 dark:bg-slate-800 rounded-xl p-3 text-sm">
              What makes a strong password?
            </div>
            <div className="bg-primary/10 text-primary rounded-xl p-3 text-sm">
              Use 16+ characters, a mix of types, and a unique password per site — a manager helps.
            </div>
          </motion.div>
        </div>
      </section>

      {/* Dashboard Preview */}
      <section className="max-w-6xl mx-auto px-4 py-16">
        <SectionTitle eyebrow="Live Insights" title="Your security, at a glance" subtitle="Track total scans, risk levels, and recent activity in one place." />
        <motion.div initial="hidden" whileInView="show" viewport={{ once: true }} variants={fadeUp}>
          <Card className="overflow-hidden">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-5">
              {[
                { icon: ShieldCheckIcon, label: 'Total Scans', value: '128' },
                { icon: BoltIcon, label: 'Safe', value: '104' },
                { icon: LockClosedIcon, label: 'Flagged', value: '24' },
                { icon: ChatBubbleLeftRightIcon, label: 'AI Chats', value: '37' },
              ].map((s) => (
                <div key={s.label} className="text-center">
                  <s.icon className="h-6 w-6 mx-auto text-primary" />
                  <p className="text-2xl font-bold mt-2">{s.value}</p>
                  <p className="text-xs text-slate-400">{s.label}</p>
                </div>
              ))}
            </div>
            <div className="border-t border-slate-100 dark:border-slate-800 p-5 grid sm:grid-cols-3 gap-3">
              {[78, 42, 91].map((h, i) => (
                <div key={i} className="h-24 rounded-xl bg-gradient-to-t from-primary/20 to-cyber-500/20 flex items-end p-2">
                  <div className="w-full bg-primary/60 rounded" style={{ height: `${h}%` }} />
                </div>
              ))}
            </div>
          </Card>
        </motion.div>
      </section>

      {/* Technologies Used */}
      <section id="tech" className="max-w-6xl mx-auto px-4 py-16">
        <SectionTitle eyebrow="Built with" title="Modern, reliable technology" subtitle="A production-ready stack engineered for performance and safety." />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {TECH.map((t, i) => (
            <motion.div key={t.name} initial="hidden" whileInView="show" viewport={{ once: true }} variants={fadeUp} transition={{ delay: i * 0.05 }}>
              <Card className="flex items-start gap-3 h-full">
                <div className="p-2.5 rounded-xl bg-cyber-500/10 text-cyber-400">
                  <t.icon className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-medium">{t.name}</p>
                  <p className="text-xs text-slate-400 mt-1">{t.desc}</p>
                </div>
              </Card>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Why Choose */}
      <section className="max-w-6xl mx-auto px-4 py-16">
        <SectionTitle eyebrow="Why CyberSec" title="Why choose Cyber Security Assistant" />
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {WHY.map((w, i) => (
            <motion.div key={w} initial="hidden" whileInView="show" viewport={{ once: true }} variants={fadeUp} transition={{ delay: i * 0.04 }}>
              <Card className="flex items-center gap-3 h-full">
                <CheckBadgeIcon className="h-5 w-5 text-cyber-400 shrink-0" />
                <p className="text-sm">{w}</p>
              </Card>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Testimonials */}
      <section className="max-w-6xl mx-auto px-4 py-16">
        <SectionTitle eyebrow="Loved by users" title="What people are saying" />
        <div className="grid md:grid-cols-3 gap-5">
          {TESTIMONIALS.map((t, i) => (
            <motion.div key={t.name} initial="hidden" whileInView="show" viewport={{ once: true }} variants={fadeUp} transition={{ delay: i * 0.05 }}>
              <Card className="h-full">
                <p className="text-slate-500 dark:text-slate-300 italic">“{t.quote}”</p>
                <div className="mt-4 flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-gradient-to-br from-primary to-cyber-500 flex items-center justify-center text-white font-bold">
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
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="max-w-3xl mx-auto px-4 py-16">
        <SectionTitle eyebrow="FAQ" title="Frequently asked questions" />
        <div className="space-y-3">
          {FAQ.map((item) => (
            <details key={item.q} className="group rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-surface-card p-4">
              <summary className="cursor-pointer font-medium flex items-center justify-between">
                {item.q}
                <ChevronDownIcon className="h-5 w-5 text-slate-400 group-open:rotate-180 transition-transform" />
              </summary>
              <p className="text-sm text-slate-400 mt-2">{item.a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-6xl mx-auto px-4 pb-20">
        <Card className="text-center bg-gradient-to-br from-primary/10 to-cyber-500/10 border-none">
          <h2 className="text-3xl font-bold">Start protecting yourself today</h2>
          <p className="text-slate-400 mt-2">Create a free account and run your first scan in under a minute.</p>
          <div className="mt-6 flex flex-col sm:flex-row justify-center gap-3">
            <Link to="/register" className="btn-cyber px-6 py-3">Get Started</Link>
            <Link to="/login" className="btn px-6 py-3 border border-slate-300 dark:border-slate-600">Login</Link>
          </div>
        </Card>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-200 dark:border-slate-800">
        <div className="max-w-6xl mx-auto px-4 py-10 grid md:grid-cols-3 gap-8 text-sm">
          <div>
            <div className="flex items-center gap-2 font-bold text-lg mb-2">
              <ShieldCheckIcon className="h-6 w-6 text-cyber-400" /> CyberSec
            </div>
            <p className="text-slate-400">Your AI-powered cyber security assistant. Scan, learn, and stay safe.</p>
          </div>
          <div>
            <p className="font-semibold mb-2">Product</p>
            <ul className="space-y-1 text-slate-400">
              <li><a href="#features" className="hover:text-primary">Features</a></li>
              <li><a href="#modules" className="hover:text-primary">Modules</a></li>
              <li><a href="#ai" className="hover:text-primary">AI Assistant</a></li>
              <li><a href="#faq" className="hover:text-primary">FAQ</a></li>
            </ul>
          </div>
          <div>
            <p className="font-semibold mb-2">Contact</p>
            <p className="text-slate-400">Questions or feedback? Reach us at</p>
            <a href="mailto:hello@cybersec.io" className="text-primary hover:underline">hello@cybersec.io</a>
            <p className="text-slate-400 mt-2">Report a vulnerability: <a href="mailto:security@cybersec.io" className="text-primary hover:underline">security@cybersec.io</a></p>
          </div>
        </div>
        <div className="border-t border-slate-200 dark:border-slate-800 py-4 text-center text-xs text-slate-400">
          © {new Date().getFullYear()} Cyber Security Assistant. All rights reserved.
        </div>
      </footer>
    </div>
  );
}
