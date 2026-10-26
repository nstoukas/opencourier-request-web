import Head from 'next/head'
import { CustomersPage } from '../../../modules/saved-customers/components/CustomersPage'

// The restaurant's saved customers (spec 0005). The page lives in the module, so it can be tested
// (no test file may sit under src/pages/: every file there is a route).
export default function CustomersRoute() {
  return (
    <>
      <Head>
        <title>Customers · OpenCourier</title>
      </Head>
      <CustomersPage />
    </>
  )
}
