import { useEffect } from 'react'
import { useRouter } from 'next/router'
import { Spinner } from '../admin-web-components'

// Signed out, the frame (PortalFrame) shows the sign in here and this page never renders.
// Signed in, there is nothing to show at "/", so it sends you on to the order page.
export default function HomePage() {
  const router = useRouter()

  useEffect(() => {
    router.replace('/manual-request')
  }, [router])

  return (
    <div className="flex justify-center py-16">
      <Spinner className="size-6 text-muted-foreground" />
    </div>
  )
}
