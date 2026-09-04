import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'What we know about you',
  description: 'What Photon records, where it stays, and what it refuses to collect.',
};

/**
 * Written as a plain account rather than a policy. Most of what a privacy
 * policy exists to answer simply does not arise here: there is no server, so
 * there is no "who else sees this".
 */
export default function PrivacyPage() {
  return (
    <div className="mx-auto flex max-w-[680px] flex-col gap-7 pb-6">
      <header>
        <h1 className="display text-[28px]">
          What we know <span className="marked">about you</span>
        </h1>
        <p className="mt-2.5 text-[14.5px] leading-relaxed text-ink-soft">
          This app could learn an unusual amount about how you spend your attention. So the rule
          underneath everything else is that it only ever knows it in one place — the device you are
          reading this on.
        </p>
      </header>

      <Block title="There is no account, and nowhere to send anything">
        No sign-in. No database. No tracking of any kind. Everything is saved inside this browser and
        read back from there. Nothing is ever sent anywhere, because there is nowhere to send it. If
        you know how to open your browser&rsquo;s network tab, you will see the page load and then
        nothing at all.
      </Block>

      <Block title="We count things, we do not read them">
        We count how many keys you pressed. We never see which ones. We count taps, not what you
        tapped. We measure how far and how fast you scrolled, never what was on the screen. No
        keylogging, no reading your messages, no looking at the words on your page — and when you
        download your data you can check all of that yourself, because it is only numbers.
      </Block>

      <Block title="What actually gets saved">
        One small entry for every minute you were using the screen: how long, how many keys, how many
        taps, how far you scrolled, how fast, how many times you jumped away, and how bright your
        screen was. Plus anything you added by hand, what you planned, and your settings. Ninety days
        of it, then the oldest is thrown away automatically.
      </Block>

      <Block title="What we deliberately do not touch">
        Not the websites you visit. Not the apps you use. Not your location, contacts, camera,
        microphone or clipboard. Nothing that could identify your device. The app asks for no
        permissions at all, with one exception you can refuse: if your device has a light sensor, we
        will use it to tell how bright the room is. If it does not, you tell us instead.
      </Block>

      <Block title="Nothing is shared unless you share it">
        A share card only ever shows what you achieved and how it compares with your own past — never
        your timeline, an app name, or how long you were on your phone. Every line on it can be
        switched off, and the card is drawn here on your device. Nothing is uploaded to make it.
      </Block>

      <Block title="Leaving whenever you like">
        Download gives you everything, minute by minute — not a tidy summary. Delete wipes it from
        this device, which is the only place it has ever been. Neither is buried: both are on your
        profile, one tap away. An app that knows this much about you has no business making either of
        them hard.
      </Block>

      <p className="text-[12.5px] text-ink-faint">
        <Link href="/method" className="text-ink-faint underline underline-offset-2 hover:text-ink">
          How we work all this out
        </Link>
      </p>
    </div>
  );
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="text-[17px] font-bold tracking-tightest">{title}</h2>
      <p className="mt-2 text-[13.5px] leading-relaxed text-ink-faint">{children}</p>
    </section>
  );
}
