// app/discord.ts
interface DiscordNoticeParams {
  title: string;
  description: string;
  color?: number;
  fields?: { name: string; value: string; inline?: boolean }[];
}

export const sendDiscordNotice = async ({
  title,
  description,
  color = 0x6366f1,
  fields = [],
}: DiscordNoticeParams) => {
  try {
    const res = await fetch('/api/discord', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, description, color, fields }),
    });

    if (!res.ok) {
      console.error('❌ [디스코드] 전송 실패 상태 코드:', res.status);
    } else {
      console.log('✅ [디스코드] 관제 알림 전송 성공!');
    }
  } catch (error) {
    console.error('❌ [디스코드] 네트워크 오류:', error);
  }
};
