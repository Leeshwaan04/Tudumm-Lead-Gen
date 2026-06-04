import Link from "next/link";

export const metadata = { title: "Terms of Service — Tudumm" };

const updated = "June 4, 2026";

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-[#09090b] text-slate-300">
      <div className="mx-auto max-w-3xl px-6 py-16">
        <Link href="/" className="text-sm text-violet-400 hover:text-violet-300">← Back to home</Link>
        <h1 className="mt-6 text-3xl font-bold text-white">Terms of Service</h1>
        <p className="mt-2 text-sm text-slate-500">Last updated: {updated}</p>

        <div className="mt-8 space-y-6 text-sm leading-relaxed">
          <section>
            <h2 className="text-lg font-semibold text-white">1. Acceptance</h2>
            <p>By creating an account or using Tudumm (&ldquo;the Service&rdquo;), you agree to these Terms. If you use the Service on behalf of an organization, you represent that you are authorized to bind it.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white">2. The Service</h2>
            <p>Tudumm provides tools for web data extraction, lead enrichment, and outreach automation. You are responsible for how you configure and use these tools, including the targets you scrape and the messages you send.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white">3. Acceptable use</h2>
            <p>You agree not to use the Service to:</p>
            <ul className="mt-2 list-disc pl-6 space-y-1">
              <li>Violate the terms of service, robots policies, or rate limits of any website or platform you target;</li>
              <li>Collect, store, or process personal data in violation of applicable law (including GDPR, CCPA);</li>
              <li>Send unsolicited bulk messages (spam) or messages that violate anti-spam laws (e.g. CAN-SPAM, GDPR/PECR);</li>
              <li>Access data you are not authorized to access, or circumvent security or authentication controls unlawfully;</li>
              <li>Resell or redistribute the Service without authorization.</li>
            </ul>
            <p className="mt-2">You are solely responsible for ensuring your use of scraped data and outreach complies with all laws and third-party terms applicable to you.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white">4. Accounts</h2>
            <p>You must provide accurate information and keep your credentials secure. You are responsible for all activity under your account. We may suspend or terminate accounts that violate these Terms or create risk for the Service or other users.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white">5. Third-party services & credentials</h2>
            <p>The Service may integrate with third-party providers (e.g. proxy networks, email and enrichment APIs) and may use credentials you supply (such as social session cookies). You are responsible for your use of those integrations and for any credentials you provide.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white">6. Disclaimer & limitation of liability</h2>
            <p>The Service is provided &ldquo;as is&rdquo; without warranties of any kind. To the maximum extent permitted by law, Tudumm is not liable for any indirect, incidental, or consequential damages, or for data accuracy, availability, or the consequences of your use of extracted data or outreach.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white">7. Changes</h2>
            <p>We may update these Terms. Material changes will be reflected by the &ldquo;Last updated&rdquo; date. Continued use after changes constitutes acceptance.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white">8. Contact</h2>
            <p>Questions: <a href="mailto:support@tudumm.in" className="text-violet-400 hover:text-violet-300">support@tudumm.in</a></p>
          </section>

          <p className="pt-4 text-xs text-slate-600">This document is a general template and not legal advice. Have it reviewed by qualified counsel before relying on it.</p>
        </div>
      </div>
    </div>
  );
}
