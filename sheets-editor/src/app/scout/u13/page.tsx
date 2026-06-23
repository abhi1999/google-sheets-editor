import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { isEditor } from '@/config';
import { ScoutBoard } from '@/components/scout/ScoutBoard';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'NAYCA · ScoutBoard U13',
};

export default async function ScoutU13Page() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    redirect('/login');
  }

  const sheetKey = 'tryout-u13';
  const userIsEditor = await isEditor(session.user.email, sheetKey);

  return (
    <ScoutBoard
      sheetKey={sheetKey}
      user={{
        email: session.user.email,
        name: session.user.name || 'Unknown',
        image: session.user.image || undefined,
        isEditor: userIsEditor,
      }}
    />
  );
}
