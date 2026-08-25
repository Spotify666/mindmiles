import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Privacy',
  description: 'What Mind Miles records, where it is kept, and what it refuses to collect.',
};

/**
 * Written as a plain account rather than a policy, because the interesting
 * facts here are architectural: there is no server, so most of the questions a
 * privacy policy exists to answer do not arise.
 */
export default function PrivacyPage() {
  return (
    <div className="mx-auto flex max-w-[680px] flex-col gap-7 pb-6">
      <header>
        <h1 className="text-[26px] font-[620] tracking-tightest">
          What Mind Miles knows about you
        </h1>
        <p className="mt-2.5 text-[14.5px] leading-relaxed text-chalk-70">
          This product could know an unusual amount about how you spend your attention. The design
          decision underneath everything else is that it should know it in exactly one place — the
          device you are reading this on.
        </p>
      </header>

      <Block title="There is no account and no server">
        Mind Miles has no sign-in, no database and no analytics. Every measurement is written to this
        browser&rsquo;s localStorage and read back from there. Nothing is transmitted, because there is no
        endpoint to transmit it to. If you open the network tab while using it, you will see the page
        load and then nothing.
      </Block>

      <Block title="Counts, never contents">
        Keystrokes are counted; the key is never read. Clicks are counted; what you clicked is never
        recorded. Scroll distance and speed are measured; what was on the screen is never inspected.
        There is no keylogging, no message reading, no content capture and no page-text access
        anywhere in this codebase — and the export gives you the complete raw record, so you can
        confirm that rather than take it on trust.
      </Block>

      <Block title="What is stored">
        One entry per minute you were active, holding: engaged milliseconds, a keystroke count, a
        click count, scroll pixels, peak scroll speed, context switches, and the brightness in
        effect. Plus any sessions you logged by hand, your intentions, and your settings. Ninety days
        of it, then the oldest is dropped automatically.
      </Block>

      <Block title="What it deliberately does not collect">
        Not the sites you visit. Not the applications you use. Not your location, contacts, camera,
        microphone or clipboard. Not a device fingerprint. Mind Miles asks for no permissions at all,
        with one optional exception: if your browser exposes an ambient light sensor it will use it
        to measure room light, and if it does not, you tell the app your brightness instead.
      </Block>

      <Block title="Sharing is off unless you turn it on">
        A share card contains achievements and comparisons against your own baseline — never a
        timeline, an app name, a session, or your total screen time. Each line is individually
        switchable, and the card is drawn on your device. Nothing is uploaded to produce it.
      </Block>

      <Block title="Leaving">
        Export gives you everything as JSON — the raw minute records, not a summary. Delete removes
        it from this device, which is the only place it has ever been. Neither is buried: both are on
        your profile, one tap away. A product holding this much detail about a person has no business
        making either of them difficult.
      </Block>

      <p className="text-[12.5px] text-chalk-30">
        <Link href="/method" className="text-chalk-45 underline underline-offset-2 hover:text-chalk">
          How every number is measured
        </Link>
      </p>
    </div>
  );
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="text-[17px] font-[620] tracking-tightest">{title}</h2>
      <p className="mt-2 text-[13.5px] leading-relaxed text-chalk-45">{children}</p>
    </section>
  );
}
