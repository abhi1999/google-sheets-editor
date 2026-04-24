import NextAuth, { type NextAuthOptions } from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';
import { isEditor } from '@/config';
import { authOptions } from "./options"; // path to your new file


const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
