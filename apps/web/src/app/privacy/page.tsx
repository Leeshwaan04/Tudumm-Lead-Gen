import Link from "next/link";

export const metadata = { title: "Privacy Policy — Tudumm" };

const updated = "June 4, 2026";

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-[#09090b] text-slate-300">
      <div className="mx-auto max-w-3xl px-6 py-16">
        <Link href="/" className="text-sm text-violet-400 hover:text-violet-300">← Back to home</Link>
        <h1 className="mt-6 text-3xl font-bold text-white">Privacy Policy</h1>
        <p className="mt-2 text-sm text-slate-500">Last updated: {updated}</p>

        <div className="mt-8 space-y-6 text-sm leading-relaxed">
          <section>
            <h2 className="text-lg font-semibold text-white">1. Who we are</h2>
            <p>Tudumm provides web data extraction, lead enrichment, and outreach automation. This policy explains what data we process and your rights.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white">2. Data we collect</h2>
            <ul className="mt-2 list-disc pl-6 space-y-1">
              <li><strong>Account data</strong> — name, email, hashed password, workspace details.</li>
              <li><strong>Usage data</strong> — runs, workflows, logs, and metrics needed to operate the Service.</li>
              <li><strong>Content you create</strong> — leads, datasets, sequences, and integration credentials you provide (stored encrypted where sensitive).</li>
              <li><strong>Cookies</strong> — a session cookie for authentication.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white">3. How we use it</h2>
            <p>To provide and secure the Service, send transactional email (e.g. verification, password reset, outreach you configure), prevent abuse, and improve reliability. We do not sell your personal data.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white">4. Data you collect via the Service</h2>
            <p>When you scrape or enrich data, <strong>you</strong> are the controller of that data and are responsible for having a lawful basis to process it and for honoring data-subject requests. Tudumm processes it on your behalf as a processor.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white">5. Sub-processors</h2>
            <p>We rely on infrastructure and API providers to run the Service (hosting, database, object storage, email delivery, AI enrichment, and email/data-lookup APIs). These process data only to provide their function.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white">6. Retention</h2>
            <p>We retain account and content data while your account is active. You can delete datasets, leads, and your account; deletion removes associated data within a reasonable period, subject to legal retention requirements.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white">7. Your rights</h2>
            <p>Depending on your location (e.g. GDPR/CCPA), you may have rights to access, correct, export, or delete your personal data, and to object to or restrict processing. Contact us to exercise these rights.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white">8. Security</h2>
            <p>We use encryption in transit, hashed passwords, encrypted storage for sensitive credentials, and tenant isolation. No system is perfectly secure; report concerns to the contact below.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white">9. Contact</h2>
            <p>Privacy questions or requests: <a href="mailto:privacy@tudumm.in" className="text-violet-400 hover:text-violet-300">privacy@tudumm.in</a></p>
          </section>

          <p className="pt-4 text-xs text-slate-600">This document is a general template and not legal advice. Have it reviewed by qualified counsel before relying on it.</p>
        </div>
      </div>
    </div>
  );
}
