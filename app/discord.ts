// app/discord.ts
const DISCORD_WEBHOOK_URL = process.env.NEXT_PUBLIC_DISCORD_WEBHOOK_URL || '';

interface DiscordNoticeParams {
  title: string;
  description: string;
  color?: number; // 0x6366F1(파랑), 0x10B981(초록), 0xF59E0B(주황), 0xEF4444(빨강)
  fields?: { name: string; value: string; inline?: boolean }[];
}

export const sendDiscordNotice = async ({
  title,
  description,
  color = 0x6366f1,
  fields = [],
}: DiscordNoticeParams) => {
  if (!DISCORD_WEBHOOK_URL) return;

  try {
    await fetch(DISCORD_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: '우주중앙은행 관제봇',
        avatar_url: 'https://cdn-icons-png.flaticon.com/512/3135/3135715.png',
        embeds: [
          {
            title,
            description,
            color,
            fields,
            footer: { text: '우주 디지털 학급은행 시스템' },
            timestamp: new Date().toISOString(),
          },
        ],
      }),
    });
  } catch (error) {
    console.error('디스코드 전송 실패:', error);
  }
};