import { createFileRoute } from "@tanstack/react-router";
import { PublicLayout } from "@/components/layout/PublicLayout";
import { LegalPage } from "@/components/common/LegalPage";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy Policy — Ventro" },
      {
        name: "description",
        content:
          "How Ventro collects, uses, and protects your personal information. Read our full privacy policy.",
      },
      { property: "og:title", content: "Privacy Policy — Ventro" },
      { property: "og:description", content: "Ventro's privacy policy and data handling practices." },
    ],
    links: [{ rel: "canonical", href: "/privacy" }],
  }),
  component: PrivacyPage,
});

function PrivacyPage() {
  return (
    <PublicLayout>
      <LegalPage eyebrow="Legal" title="Privacy Policy" updated="6 July 2026">
        <p>
          At Ventro ("we", "us", "our"), we respect your privacy and are committed to protecting
          your personal data. This policy explains what information we collect, how we use it, and
          the choices you have. It applies to all users of the Ventro platform, including
          creators, advertisers, and visitors.
        </p>

        <div>
          <h2>1. Information we collect</h2>
          <p>We collect information you provide directly and information generated through your use of the platform.</p>

          <h3>Account information</h3>
          <ul>
            <li>Name, email address, phone number, and password</li>
            <li>Role (creator or advertiser), profile bio, avatar, and portfolio</li>
            <li>Social media handles and audience metrics you choose to connect</li>
            <li>Business details for advertisers (company name, GST, address)</li>
          </ul>

          <h3>Payment information</h3>
          <ul>
            <li>Billing address and invoicing details</li>
            <li>Bank account or UPI details for payouts (stored with hashing and masking)</li>
            <li>Transaction records processed through our payment provider (Razorpay)</li>
          </ul>
          <p>
            We do not store your full card number, CVV, or net-banking credentials — these are
            handled directly by our PCI-DSS compliant payment provider.
          </p>

          <h3>Usage information</h3>
          <ul>
            <li>Device type, browser, operating system, and IP address</li>
            <li>Pages viewed, features used, and timestamps</li>
            <li>Messages and files exchanged with other users on the platform</li>
          </ul>
        </div>

        <div>
          <h2>2. Cookies</h2>
          <p>
            We use cookies and similar technologies to keep you signed in, remember your
            preferences, secure the platform, and understand how features are used. You can control
            cookies through your browser settings. Disabling essential cookies may break parts of
            the platform.
          </p>
        </div>

        <div>
          <h2>3. Analytics</h2>
          <p>
            We use privacy-respecting analytics tools to understand aggregate product usage. These
            tools may collect anonymised information such as page views, session duration, and
            device type. We do not sell this data to third parties.
          </p>
        </div>

        <div>
          <h2>4. Third-party services</h2>
          <p>We share limited data with trusted service providers to operate the platform:</p>
          <ul>
            <li>Payment processing — Razorpay</li>
            <li>Cloud hosting and database — Supabase / Cloudflare</li>
            <li>Email and notifications — transactional email providers</li>
          </ul>
          <p>
            These providers are contractually required to protect your data and use it only for the
            services they perform for us.
          </p>
        </div>

        <div>
          <h2>5. Data storage and retention</h2>
          <p>
            Your data is stored on secure servers with encryption in transit (TLS) and at rest. We
            retain your account data for as long as your account is active, and for a reasonable
            period afterwards to comply with legal and financial obligations.
          </p>
        </div>

        <div>
          <h2>6. Your rights</h2>
          <ul>
            <li>Access — request a copy of the personal data we hold about you</li>
            <li>Correction — update inaccurate or incomplete information</li>
            <li>Deletion — request deletion of your account and data</li>
            <li>Portability — request an export of your data in a portable format</li>
            <li>Withdraw consent — where processing is based on consent</li>
          </ul>
          <p>To exercise any of these rights, email us at support@ventro.in.</p>
        </div>

        <div>
          <h2>7. Data security</h2>
          <p>
            We use industry-standard measures to protect your data — including encryption, access
            controls, audit logging, and regular security reviews. No system is 100% secure, so we
            encourage you to use a strong password and enable two-factor authentication where
            available.
          </p>
        </div>

        <div>
          <h2>8. Children's privacy</h2>
          <p>
            Ventro is not intended for users under the age of 18. We do not knowingly collect
            personal data from children. If you believe a child has provided us with personal data,
            please contact us and we will delete it promptly.
          </p>
        </div>

        <div>
          <h2>9. Changes to this policy</h2>
          <p>
            We may update this policy from time to time. If we make material changes, we will
            notify you by email or through a prominent notice on the platform.
          </p>
        </div>

        <div>
          <h2>10. Contact us</h2>
          <p>
            Questions about this policy? Email{" "}
            <a href="mailto:support@ventro.in">support@ventro.in</a> or write to us at Ventro,
            Bengaluru, Karnataka, India.
          </p>
        </div>
      </LegalPage>
    </PublicLayout>
  );
}
