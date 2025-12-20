// components/auto-refresh.tsx
"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"

export default function AutoRefresh() {
  const router = useRouter()

  useEffect(() => {
    // สั่งให้ Refresh ข้อมูลทุกๆ 5 วินาที
    const interval = setInterval(() => {
      router.refresh()
    }, 5000)

    return () => clearInterval(interval)
  }, [router])

  return null // ตัวนี้ทำงานเบื้องหลัง ไม่ต้องแสดงผลอะไร
}