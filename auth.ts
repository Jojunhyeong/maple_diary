import NextAuth from 'next-auth';
import KakaoProvider from 'next-auth/providers/kakao';
import { supabaseAdmin } from '@/shared/lib/supabase';

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    KakaoProvider({
      clientId: process.env.KAKAO_CLIENT_ID!,
      clientSecret: process.env.KAKAO_CLIENT_SECRET!,
    }),
  ],
  callbacks: {
    async signIn({ user, account }) {
      if (account?.provider !== 'kakao') return false;

      const kakaoId = String(account.providerAccountId);
      const db = supabaseAdmin();

      // 기존 유저 확인
      const { data: existing } = await db
        .from('users')
        .select('id')
        .eq('kakao_id', kakaoId)
        .single();

      if (existing) {
        // 기존 유저 업데이트
        await db
          .from('users')
          .update({
            nickname: user.name,
            profile_image: user.image,
            updated_at: new Date().toISOString(),
          })
          .eq('kakao_id', kakaoId);
      } else {
        // 신규 유저 생성
        const { error } = await db.from('users').insert({
          kakao_id: kakaoId,
          nickname: user.name,
          profile_image: user.image,
        });

        if (error) {
          console.error('signIn insert error:', error);
          return false;
        }
      }

      return true;
    },

    async session({ session, token }) {
      if (token.kakaoId) {
        const db = supabaseAdmin();
        const { data } = await db
          .from('users')
          .select('id, kakao_id, nickname, character_name, character_class, character_level, character_image')
          .eq('kakao_id', String(token.kakaoId))
          .single();

        if (data) {
          session.user.id = data.id;
          session.user.kakaoId = data.kakao_id;
          session.user.characterName = data.character_name;
          session.user.characterClass = data.character_class;
          session.user.characterLevel = data.character_level;
          session.user.characterImage = data.character_image;
        }
      }
      return session;
    },

    async jwt({ token, account }) {
      if (account?.provider === 'kakao') {
        token.kakaoId = account.providerAccountId;
      }
      return token;
    },
  },
  pages: {
    signIn: '/login',
  },
});

// NextAuth 타입 확장
declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      kakaoId: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
      characterName?: string | null;
      characterClass?: string | null;
      characterLevel?: number | null;
      characterImage?: string | null;
    };
  }
}
