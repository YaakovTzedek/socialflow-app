import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const alt = 'SocialFlow';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

/**
 * Social preview card. Latin only on purpose: the default font shipped with
 * ImageResponse does not cover Hebrew, Arabic or Japanese, and a card of empty
 * boxes is worse than a brand card that reads the same in every language.
 */
export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%', height: '100%', display: 'flex', flexDirection: 'column',
          justifyContent: 'center', padding: '0 90px', background: '#0f0a14', color: '#fff',
          fontFamily: 'sans-serif',
        }}
      >
        <div style={{ position: 'absolute', top: -220, right: -160, width: 700, height: 700, borderRadius: 700, background: 'radial-gradient(circle, rgba(225,48,108,.55), rgba(15,10,20,0) 70%)', display: 'flex' }} />
        <div style={{ position: 'absolute', bottom: -260, left: -180, width: 720, height: 720, borderRadius: 720, background: 'radial-gradient(circle, rgba(131,58,180,.5), rgba(15,10,20,0) 70%)', display: 'flex' }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 18, fontSize: 40, fontWeight: 800 }}>
          <div style={{ width: 54, height: 54, borderRadius: 16, display: 'flex', background: 'linear-gradient(135deg,#833AB4,#E1306C,#F77737)' }} />
          <div style={{ display: 'flex' }}>
            Social<span style={{ color: '#F77737' }}>Flow</span>
          </div>
        </div>
        <div style={{ marginTop: 34, fontSize: 92, fontWeight: 800, lineHeight: 1.05, display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex' }}>Turn comments</div>
          <div style={{ display: 'flex', color: '#F04B7E' }}>into leads</div>
        </div>
        <div style={{ marginTop: 30, fontSize: 32, color: '#C9BBD3', display: 'flex' }}>
          Instagram and Facebook comment automation
        </div>
      </div>
    ),
    size,
  );
}
