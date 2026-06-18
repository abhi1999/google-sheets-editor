import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'ScoutBoard · Cricket Tryouts',
  description: 'Cricket player evaluation and selection tool',
};

export default function ScoutLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      <link
        href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@400;600;700;800&family=Barlow:wght@400;500;600&display=swap"
        rel="stylesheet"
      />
      {children}
    </>
  );
}
