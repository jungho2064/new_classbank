import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  const webhookUrl =
    process.env.DISCORD_WEBHOOK_URL || process.env.NEXT_PUBLIC_DISCORD_WEBHOOK_URL;

  if (!webhookUrl) {
    return NextResponse.json(
      { error: 'DISCORD_WEBHOOK_URL 환경 변수가 설정되지 않았습니다.' },
      { status: 500 }
    );
  }

  try {
    const { title, description, color = 0x6366f1, fields = [] } = await req.json();

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
      return NextResponse.json({ error: 'Discord 전송 실패' }, { status: res.status });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('❌ [디스코드 API] 오류:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
