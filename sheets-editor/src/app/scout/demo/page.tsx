import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { ScoutBoard } from '@/components/scout/ScoutBoard';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'NAYCA · Scout Demo',
};

export default async function ScoutDemoPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    redirect('/login');
  }

  return (
    <ScoutBoard
      sheetKey="demo"
      user={{
        email: session.user.email,
        name: session.user.name || 'Unknown',
        image: session.user.image || undefined,
        isEditor: false,
      }}
    />
  );
}
