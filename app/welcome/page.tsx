'use client';

import { useRouter } from 'next/navigation';
import Welcome from '@/components/Welcome';
import { usePhoton } from '@/components/PhotonProvider';
import { setOnboarded } from '@/lib/mm/store';

/**
 * The welcome, on a permanent address.
 *
 * It used to exist only as a branch inside the Today route, shown while
 * `onboarded` was false. Which meant that pressing the one button on it closed
 * the door permanently: there was no way back to the only screen that explains
 * what the product is, and anyone who clicked through it once could never find
 * it again. That is a bad way to treat the page carrying your entire argument.
 *
 * It now has its own URL, is linked from the profile, and can be read as many
 * times as anyone likes.
 */
export default function WelcomePage() {
  const { refresh } = usePhoton();
  const router = useRouter();

  return (
    <Welcome
      onStart={() => {
        setOnboarded(true);
        refresh();
        router.push('/');
      }}
    />
  );
}
