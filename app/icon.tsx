import { ImageResponse } from 'next/og';

// ขนาดรูป (32x32)
export const size = {
  width: 32,
  height: 32,
};
export const contentType = 'image/png';

export default function Icon() {
  // สีธีมเดียวกับ Loading Component
  const blue = '#2563EB'; // blue-600
  const slate = '#F1F5F9'; // slate-100

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'transparent',
          position: 'relative', // ใช้ relative เพื่อซ้อน Layer
        }}
      >
        {/* Layer 1: พื้นหลังสีขาว (รองพื้น) */}
        <div
          style={{
            position: 'absolute',
            width: '26px', // เล็กกว่าวงกลมนิดนึงเพื่อไม่ให้กินขอบ
            height: '26px',
            borderRadius: '50%',
            background: 'white',
          }}
        />

        {/* Layer 2: วงแหวน Spinner (เอียงขวา) */}
        <div
          style={{
            position: 'absolute',
            width: '32px',
            height: '32px',
            borderRadius: '50%',
            border: `4px solid ${slate}`, // สีขอบเทาจางๆ
            borderTop: `4px solid ${blue}`, // สีขอบฟ้า (ส่วนที่หมุน)
            transform: 'rotate(45deg)',     // ✅ สั่งเอียงขวา 45 องศาตรงนี้ครับ
            boxSizing: 'border-box',
          }}
        />

        {/* Layer 3: ไอคอนกราฟหัวใจ (อยู่บนสุด) */}
        <div
            style={{
                position: 'absolute',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '100%',
                height: '100%',
            }}
        >
            <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke={blue}
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
            >
                <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
            </svg>
        </div>
      </div>
    ),
    {
      ...size,
    }
  );
}