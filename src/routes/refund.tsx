import { createFileRoute } from "@tanstack/react-router";
import { PublicLayout } from "@/components/layout/PublicLayout";
import { LegalPage } from "@/components/common/LegalPage";

export const Route = createFileRoute("/refund")({
  head: () => ({
    meta: [
      { title: "Refund & Cancellation Policy — Connecx" },
      {
        name: "description",
        content:
          "Connecx's refund and cancellation policy for campaigns, including creator and brand cancellations.",
      },
      { property: "og:title", content: "Refund & Cancellation Policy — Connecx" },
      { property: "og:description", content: "Connecx's refund and cancellation policy." },
    ],
    links: [{ rel: "canonical", href: "/refund" }],
  }),
  component: RefundPage,
});

function RefundPage() {
  return (
    <PublicLayout>
      <LegalPage eyebrow="Legal" title="Refund & Cancellation Policy" updated="6 July 2026">
        <p>
          This policy explains how cancellations and refunds work on Connecx. It applies to all
          campaigns and payments processed through the Platform.
        </p>

        <div>
          <h2>1. Campaign cancellation rules</h2>
          <ul>
            <li>
              A brand may cancel a campaign at any time before a creator has been formally accepted
              — no fees are charged and funds are fully refunded.
            </li>
            <li>
              Once a creator is accepted, cancellation requires mutual agreement or a valid reason
              (see below).
            </li>
            <li>
              A creator may withdraw from a campaign before starting work, with written notice
              through the Platform.
            </li>
          </ul>
        </div>

        <div>
          <h2>2. Refund eligibility</h2>
          <p>You are eligible for a refund in the following cases:</p>
          <ul>
            <li>The campaign was cancelled before any deliverable was started.</li>
            <li>The creator failed to deliver by the agreed deadline without valid reason.</li>
            <li>The delivered work materially differs from the accepted brief.</li>
            <li>The campaign is cancelled by mutual agreement of both parties.</li>
          </ul>
        </div>

        <div>
          <h2>3. Non-refundable situations</h2>
          <ul>
            <li>Deliverables that have already been accepted and approved by the brand.</li>
            <li>Cancellations initiated by the brand after work has begun in good faith.</li>
            <li>Platform fees on completed campaigns.</li>
            <li>Payment gateway charges (per gateway policy).</li>
            <li>Change of mind after deliverables are published or shared publicly.</li>
          </ul>
        </div>

        <div>
          <h2>4. Refund processing timeline</h2>
          <p>
            Approved refunds are initiated within 3 business days of approval. Depending on your
            payment method and bank, funds usually reflect within 5–10 business days after
            initiation. You will receive an email confirmation with the refund reference.
          </p>
        </div>

        <div>
          <h2>5. Payment disputes</h2>
          <p>
            If you disagree with a payment, deliverable, or refund decision, please raise a
            dispute from your dashboard. Our support team will review the case, request evidence
            from both parties, and issue a decision within 7 business days. Decisions by Connecx
            support in disputed cases are final for internal purposes but do not restrict your
            legal rights.
          </p>
        </div>

        <div>
          <h2>6. Creator cancellations</h2>
          <p>
            Creators who repeatedly cancel accepted campaigns without valid reason may be subject
            to account restrictions, reduced discoverability, or suspension. If a creator cancels
            after starting work, any portion of the funds already earned may be released for work
            genuinely completed, at Connecx's reasonable assessment.
          </p>
        </div>

        <div>
          <h2>7. Brand cancellations</h2>
          <p>
            Brands who cancel accepted campaigns after a creator has commenced work may be liable
            to pay for the completed portion. Repeated last-minute cancellations may result in
            account restrictions or removal from the Platform.
          </p>
        </div>

        <div>
          <h2>8. Force majeure</h2>
          <p>
            Neither party is liable for delays or failure to perform due to circumstances beyond
            reasonable control — including natural disasters, government action, war, pandemics,
            or major internet or infrastructure outages. In such cases, we will work in good faith
            to find a fair resolution for both parties.
          </p>
        </div>

        <div>
          <h2>9. Contact support</h2>
          <p>
            For refund or cancellation requests, email{" "}
            <a href="mailto:support@connecx.in">support@connecx.in</a> with your campaign ID and a
            brief description of the issue. Our team will respond within 24–48 hours.
          </p>
        </div>
      </LegalPage>
    </PublicLayout>
  );
}
