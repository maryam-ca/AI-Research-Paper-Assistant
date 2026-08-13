import { LifeBuoy, BookOpen, Github, Mail } from 'lucide-react';

const LINKS = [
  { icon: BookOpen, label: 'Documentation', href: 'https://github.com/anomalyco/opencode#readme', external: true },
  { icon: Github, label: 'Source repository', href: 'https://github.com/', external: true },
  { icon: Mail, label: 'Contact support', href: 'mailto:support@scholarflow.app', external: true },
];

const FAQ = [
  {
    q: 'How do I add a paper?',
    a: 'Use the Library page to upload a PDF or paste an arXiv / DOI link to fetch metadata.',
  },
  {
    q: 'Where is my data stored?',
    a: 'Papers and embeddings live in Postgres. Local uploads fall back to the .blobs/ folder when no Blob token is set.',
  },
  {
    q: 'Which models are used?',
    a: 'Summaries use gemini-2.5-flash and embeddings use models/gemini-embedding-001.',
  },
];

export default function SupportPage() {
  return (
    <div className="mx-auto max-w-2xl p-6">
      <h1 className="font-display text-2xl font-bold">Support</h1>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
        Helpful links and answers to common questions.
      </p>

      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        {LINKS.map(({ icon: Icon, label, href, external }) => (
          <a key={label} href={href} target={external ? '_blank' : undefined} rel="noreferrer"
             className="card flex flex-col items-center gap-2 p-5 text-center hover:border-primary">
            <Icon className="text-primary" size={22} />
            <span className="text-sm font-medium">{label}</span>
          </a>
        ))}
      </div>

      <section className="card mt-6 p-5">
        <h3 className="flex items-center gap-2 font-semibold">
          <LifeBuoy size={16} className="text-primary" /> Frequently asked
        </h3>
        <dl className="mt-3 space-y-4">
          {FAQ.map((f) => (
            <div key={f.q}>
              <dt className="text-sm font-semibold">{f.q}</dt>
              <dd className="text-sm text-slate-500 dark:text-slate-400">{f.a}</dd>
            </div>
          ))}
        </dl>
      </section>
    </div>
  );
}
