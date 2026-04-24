import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { isEditor, getSheetsConfig } from '@/config';
import { DashboardClient } from '@/components/table/DashboardClient';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    redirect('/login');
  }

  const userIsEditor = isEditor(session.user.email);
  const config = getSheetsConfig();

  return (
    <DashboardClient
      user={{
        email: session.user.email,
        name: session.user.name || 'Unknown',
        image: session.user.image || undefined,
        isEditor: userIsEditor,
      }}
      editableColumns={userIsEditor ? config.editableColumns : []}
    />
  );
}
