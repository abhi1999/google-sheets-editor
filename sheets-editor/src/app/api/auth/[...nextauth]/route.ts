import NextAuth, { type NextAuthOptions } from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';
import { isEditor } from '@/config';

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      authorization: {
        params: {
          // Request full profile access
          scope: 'openid email profile',
        },
      },
    }),
  ],

  callbacks: {
    async session({ session, token }) {
      // Attach extra fields to the session
      if (session.user && token.email) {
        (session.user as any).isEditor = isEditor(token.email);
        (session.user as any).id = token.sub;
      }
      return session;
    },

    async jwt({ token, account, profile }) {
      if (account) {
        token.accessToken = account.access_token;
      }
      return token;
    },
  },

  pages: {
    signIn: '/login',
    error: '/login',
  },

  session: {
    strategy: 'jwt',
    maxAge: 8 * 60 * 60, // 8 hours
  },

  secret: process.env.NEXTAUTH_SECRET,
};

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
