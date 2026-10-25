import Head from 'next/head'
import { CreateDeliveryForm } from '../../modules/manual-request/components/CreateDeliveryForm'
import { PageHeader } from '../../modules/portal/components/PortalFrame'

// Sign in and sign out live in the frame (PortalFrame) now, so this page only renders
// once the restaurant is signed in.
export default function ManualRequestPage() {
  return (
    <>
      <Head>
        <title>New Delivery · OpenCourier</title>
      </Head>
      <div className="space-y-6">
        <PageHeader title="New Delivery" description="Ask the co-op for a rider to take an order to your customer." />
        <CreateDeliveryForm />
      </div>
    </>
  )
}
