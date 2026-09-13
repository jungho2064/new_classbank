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
  // 💡 실행 시점에 주소를 동적으로 읽어옵니다.
  const webhookUrl = process.env.NEXT_PUBLIC_DISCORD_WEBHOOK_URL;

  if (!webhookUrl) {
    console.error('❌ [디스코드] NEXT_PUBLIC_DISCORD_WEBHOOK_URL 환경 변수가 비어 있습니다.');
    return;
  }

  try {
    const res = await fetch(webhookUrl, {
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

    if (!res.ok) {
      console.error('❌ [디스코드] 전송 실패 상태 코드:', res.status);
    } else {
      console.log('✅ [디스코드] 관제 알림 전송 성공!');
    }
  } catch (error) {
    console.error('❌ [디스코드] 네트워크 오류:', error);
  }
};