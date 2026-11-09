import Head from 'next/head'
import { CreateDeliveryForm } from '../../modules/manual-request/components/CreateDeliveryForm'
import { PageHeader } from '../../modules/portal/components/PortalFrame'
import { DispatchBanner } from '../../modules/manual-request/components/DispatchBanner'
import { AvailabilityStrip } from '../../modules/availability/AvailabilityStrip'
import { usePartnerAvailabilityQuery } from '../../api/manualRequestApi'

// Sign in and sign out live in the frame (PortalFrame) now, so this page only renders
// once the restaurant is signed in.
export default function ManualRequestPage() {
  const { availability, refetch } = usePartnerAvailabilityQuery()

  return (
    <>
      <Head>
        <title>New Delivery · OpenCourier</title>
      </Head>
      <div className="space-y-6">
        <PageHeader title="New Delivery" description="Ask the co-op for a rider to take an order to your customer." />
        {/* Dispatch stopped for heat or a storm, or about to be (spec 0014). */}
        <DispatchBanner />
        {/* Busy mode and pause (spec 0029). */}
        <AvailabilityStrip availability={availability} onChanged={refetch} />
        <CreateDeliveryForm availability={availability} />
      </div>
    </>
  )
}
