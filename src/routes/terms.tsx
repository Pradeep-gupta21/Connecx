import { createFileRoute } from "@tanstack/react-router";
import { PublicLayout } from "@/components/layout/PublicLayout";
import { LegalPage } from "@/components/common/LegalPage";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: "Terms & Conditions — Connecx" },
      {
        name: "description",
        content:
          "The rules and conditions that govern your use of the Connecx platform for creators and brands.",
      },
      { property: "og:title", content: "Terms & Conditions — Connecx" },
      { property: "og:description", content: "Read Connecx's full terms of service." },
    ],
    links: [{ rel: "canonical", href: "/terms" }],
  }),
  component: TermsPage,
});

function TermsPage() {
  return (
    <PublicLayout>
      <LegalPage eyebrow="Legal" title="Terms & Conditions" updated="6 July 2026">
        <p>
          These Terms & Conditions ("Terms") govern your use of Connecx ("Platform"). By creating an
          account or using the Platform, you agree to be bound by these Terms. If you do not agree,
          please do not use Connecx.
        </p>

        <div>
          <h2>1. User eligibility</h2>
          <ul>
            <li>You must be at least 18 years old to use Connecx.</li>
            <li>You must provide accurate, current, and complete information at signup.</li>
            <li>You are responsible for maintaining the confidentiality of your account.</li>
            <li>You may not create multiple accounts to bypass restrictions.</li>
          </ul>
        </div>

        <div>
          <h2>2. Creator responsibilities</h2>
          <ul>
            <li>Ensure all portfolio work and audience metrics you present are truthful.</li>
            <li>Deliver campaign work as agreed within stated timelines.</li>
            <li>Comply with all disclosure requirements for sponsored content (e.g. #ad).</li>
            <li>Respect the confidentiality of brand briefs and creative assets.</li>
          </ul>
        </div>

        <div>
          <h2>3. Brand (advertiser) responsibilities</h2>
          <ul>
            <li>Provide clear, lawful briefs with realistic deliverables and timelines.</li>
            <li>Fund campaigns fully before deliverables are requested.</li>
            <li>Review submitted work fairly and within the response windows.</li>
            <li>Do not request illegal, misleading, or discriminatory content.</li>
          </ul>
        </div>

        <div>
          <h2>4. Platform rules</h2>
          <ul>
            <li>Do not circumvent Connecx to pay or receive payment off-platform.</li>
            <li>Do not harass, threaten, or discriminate against other users.</li>
            <li>Do not upload malicious software, spam, or unauthorised content.</li>
            <li>Do not attempt to reverse-engineer, scrape, or overload the Platform.</li>
          </ul>
        </div>

        <div>
          <h2>5. Payments</h2>
          <p>
            All campaign payments are collected through our payment provider (Razorpay). Connecx
            is an influencer marketing platform that processes campaign payments from advertisers
            and manages creator payouts after successful campaign completion. Payouts to creators
            are made to the verified default payout account on file. Connecx is not a bank,
            licensed escrow service, or financial institution.
          </p>
        </div>

        <div>
          <h2>6. Fees</h2>
          <p>
            Connecx charges a platform fee on each successful campaign. The exact percentage is
            displayed at the time of funding and before a creator accepts a campaign. Payment
            gateway fees, applicable taxes (GST), and TDS deductions may apply per Indian law.
          </p>
        </div>

        <div>
          <h2>7. Cancellations</h2>
          <p>
            Campaigns can be cancelled subject to the Refund & Cancellation Policy. Once a creator
            has begun work in good faith, brands may be liable to pay for work completed up to the
            cancellation point.
          </p>
        </div>

        <div>
          <h2>8. Intellectual property</h2>
          <p>
            Creators retain ownership of underlying creative rights unless otherwise agreed in the
            campaign brief. Brands receive a licence to use approved deliverables per the scope
            specified. The Connecx name, logo, and platform code are the property of Connecx and may
            not be used without permission.
          </p>
        </div>

        <div>
          <h2>9. Prohibited activities</h2>
          <ul>
            <li>Fraudulent metrics, fake followers, or bot-driven engagement</li>
            <li>Content that violates any applicable law, including obscenity and hate speech</li>
            <li>Money laundering or misuse of payment infrastructure</li>
            <li>Infringing another party's intellectual property</li>
          </ul>
        </div>

        <div>
          <h2>10. Account suspension</h2>
          <p>
            We reserve the right to suspend or terminate accounts that violate these Terms, harm
            other users, or expose Connecx to legal risk. Where possible, we will notify you before
            suspension and give you the opportunity to respond.
          </p>
        </div>

        <div>
          <h2>11. Limitation of liability</h2>
          <p>
            To the maximum extent permitted by law, Connecx is not liable for indirect, incidental,
            or consequential damages arising from your use of the Platform. Our total liability in
            any dispute is limited to the fees paid to Connecx by you in the preceding three months.
          </p>
        </div>

        <div>
          <h2>12. Governing law</h2>
          <p>
            These Terms are governed by the laws of India. Any dispute arising from these Terms or
            the Platform will be subject to the exclusive jurisdiction of the courts of Bengaluru,
            Karnataka, India.
          </p>
        </div>

        <div>
          <h2>13. Contact information</h2>
          <p>
            Questions about these Terms? Email{" "}
            <a href="mailto:support@connecx.in">support@connecx.in</a>.
          </p>
        </div>
      </LegalPage>
    </PublicLayout>
  );
}
