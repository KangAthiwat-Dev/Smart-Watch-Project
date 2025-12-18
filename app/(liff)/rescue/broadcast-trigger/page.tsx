'use client'
import { useEffect, useState, Suspense } from 'react'
import liff from '@line/liff'
import { useSearchParams } from 'next/navigation'

const LIFF_ID = process.env.NEXT_PUBLIC_LIFF_ID_TRIGGER!; 

function TriggerContent() {
  const [status, setStatus] = useState('กำลังระบุตำแหน่ง...')
  
  const searchParams = useSearchParams()
  const recordId = searchParams.get('id')     
  const alertType = searchParams.get('type')  

  useEffect(() => {
    const main = async () => {
      try {
        await liff.init({ liffId: LIFF_ID })
        
        if (!liff.isLoggedIn()) {
          liff.login()
          return
        }

        const profile = await liff.getProfile()
        const userId = profile.userId 

        setStatus('กำลังระบุตำแหน่ง GPS...')
        
        navigator.geolocation.getCurrentPosition(
          async (position) => {
            const { latitude, longitude } = position.coords
            setStatus('กำลังส่งสัญญาณขอความช่วยเหลือ...')
            await sendHelpSignal(userId, latitude, longitude, recordId, alertType)
          },
          async (error) => {
            console.warn('GPS Error:', error)
            setStatus('ไม่พบตำแหน่ง... กำลังส่งสัญญาณแบบไม่มีพิกัด')
            await sendHelpSignal(userId, null, null, recordId, alertType)
          },
          { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
        )

      } catch (error) {
        console.error('LIFF Error:', error)
        setStatus('เกิดข้อผิดพลาดในการเชื่อมต่อ LINE')
      }
    }

    main()
  }, [recordId, alertType])

  const sendHelpSignal = async (
    userId: string, 
    lat: number | null, 
    lng: number | null,
    rId: string | null,
    type: string | null
  ) => {
    
    // ✅ อัปเดตข้อความตาม Type ใหม่ (HEART, TEMP)
    let messageText = "เหตุฉุกเฉินเพิ่มเติม"
    
    if (type === 'FALL') messageText = "ยืนยันเหตุการล้ม (ต้องการความช่วยเหลือ)"
    else if (type === 'ZONE') messageText = "ออกนอกพื้นที่ปลอดภัย (ต้องการความช่วยเหลือ)"
    else if (type === 'HEART') messageText = "ชีพจรผิดปกติวิกฤต (ต้องการความช่วยเหลือ)"
    else if (type === 'TEMP') messageText = "อุณหภูมิร่างกายสูงวิกฤต (ต้องการความช่วยเหลือ)"
    else if (type === 'HEALTH') messageText = "สัญญาณชีพผิดปกติ (ต้องการความช่วยเหลือ)" // เผื่อเคสเก่า

    try {
      const res = await fetch('/api/rescue/broadcast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
            userId: userId,
            latitude: lat,
            longitude: lng,
            recordId: rId ? parseInt(rId) : null,
            alertType: type, 
            message: messageText 
        }) 
      })

      if (res.ok) {
        setStatus('ส่งสัญญาณสำเร็จ! เจ้าหน้าที่กำลังตรวจสอบ')
        setTimeout(() => {
            liff.closeWindow()
        }, 2000)
      } else {
        setStatus('เกิดข้อผิดพลาดในการส่งข้อมูล')
      }

    } catch (err) {
      console.error(err)
      setStatus('เชื่อมต่อ Server ไม่ได้')
    }
  }

  return (
    <div className="flex flex-col items-center justify-center h-screen bg-orange-50 p-4">
      <div className="w-16 h-16 border-4 border-orange-200 border-t-orange-500 rounded-full animate-spin mb-4"></div>
      
      <div className="text-xl font-bold text-orange-600 animate-pulse text-center">
        {status}
      </div>
      
      {alertType && (
         <p className="text-orange-800 font-bold mt-2 bg-orange-100 px-3 py-1 rounded-full text-xs">
            ประเภท: {alertType}
         </p>
      )}

      <p className="text-gray-500 mt-4 text-sm text-center">
        ระบบจะดึงพิกัดและส่งแจ้งเตือนไปยังผู้ดูแลทันที
      </p>
    </div>
  )
}

export default function BroadcastTriggerPage() {
  return (
    <Suspense fallback={<div className="p-10 text-center">Loading...</div>}>
      <TriggerContent />
    </Suspense>
  )
}