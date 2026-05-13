import Head from 'next/head'
import Link from 'next/link'
import { useRouter } from 'next/router'
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Separator,
} from '../../../admin-web-components'
import {
  useCancelManualRequestDeliveryMutation,
  useGetManualRequestDeliveryQuery,
} from '../../../api/manualRequestApi'
import type {
  ManualRequestDeliveryDto,
  PartnerDeliveryDto,
  PartnerDeliveryDropoffDto,
  PartnerDeliveryPickupDto,
} from '../../../modules/manual-request/types'
import { getManualRequestApiMode } from '../../../utils/manualRequestAuth'

const TERMINAL_STATUSES = new Set(['DROPPED_OFF', 'CANCELED', 'FAILED'])

function statusVariant(status: string): 'default' | 'secondary' | 'destructive' | 'outline' {
  if (status === 'DROPPED_OFF') return 'default'
  if (status === 'CANCELED' || status === 'FAILED') return 'destructive'
  return 'secondary'
}

function formatStatus(status: string) {
  return status.replace(/_/g, ' ')
}

function formatCurrency(amount: number | null | undefined, currency: string) {
  if (amount == null) return '—'
  return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(amount / 100)
}

function formatDate(iso: string | null | undefined) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
}

function formatLocationAddress(loc: PartnerDeliveryPickupDto | PartnerDeliveryDropoffDto | null | undefined): string {
  if (!loc) return '—'
  const trimmed = loc.formattedAddress?.trim()
  if (trimmed) return trimmed
  const streetLine =
    loc.addressLine1?.trim() ||
    [loc.houseNumber, loc.street].filter(Boolean).join(' ').trim()
  const cityLine = [loc.city, loc.state, loc.zipCode].filter(Boolean).join(', ')
  const parts = [streetLine || null, cityLine || null, loc.countryCode ?? null].filter(Boolean)
  return parts.length ? parts.join(' · ') : '—'
}

function courierLabel(d: PartnerDeliveryDto): string {
  const c = d.courier
  if (!c) return 'Unassigned'
  const name = [c.firstName, c.lastName].filter(Boolean).join(' ').trim()
  return name || c.id || 'Assigned'
}

function DetailGrid({ rows }: { rows: { label: string; value: React.ReactNode }[] }) {
  return (
    <dl className="grid gap-y-2 text-sm sm:grid-cols-[11rem_minmax(0,1fr)] sm:gap-x-4 [&>dt]:text-muted-foreground [&>dd]:font-normal">
      {rows.map(({ label, value }) => (
        <FragmentRow key={label} label={label} value={value} />
      ))}
    </dl>
  )
}

function FragmentRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <>
      <dt>{label}</dt>
      <dd className={value == null || value === '' ? 'text-muted-foreground' : ''}>{value ?? '—'}</dd>
    </>
  )
}

function PartnerDeliveryDetails({ data }: { data: PartnerDeliveryDto }) {
  const tips = data.tips ?? 0
  const orderItems = data.orderItems ?? []

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <Badge variant={statusVariant(data.status)} className="text-sm">
          {formatStatus(data.status)}
        </Badge>
        <p className="text-xs text-muted-foreground">Created {formatDate(data.createdAt)}</p>
      </div>

      <section className="space-y-2">
        <h2 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Schedule</h2>
        <DetailGrid
          rows={[
            { label: 'Pickup ready', value: formatDate(data.pickupReadyAt) },
            { label: 'Pickup deadline', value: formatDate(data.pickupDeadlineAt) },
            { label: 'Dropoff ready', value: formatDate(data.dropoffReadyAt) },
            { label: 'Dropoff ETA', value: formatDate(data.dropoffEta) },
            { label: 'Dropoff deadline', value: formatDate(data.dropoffDeadlineAt) },
          ]}
        />
      </section>

      <Separator />

      <section className="space-y-2">
        <h2 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Courier</h2>
        <DetailGrid
          rows={[
            { label: 'Name', value: courierLabel(data) },
            ...(data.courier?.phoneNumber
              ? [{ label: 'Phone', value: data.courier.phoneNumber } as const]
              : []),
            ...(data.courier?.id ? [{ label: 'Courier ID', value: data.courier.id } as const] : []),
            ...(data.courier?.vehicleType != null
              ? [{ label: 'Vehicle', value: String(data.courier.vehicleType) || '—' } as const]
              : []),
          ]}
        />
      </section>

      <Separator />

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="space-y-2">
          <h2 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Pickup</h2>
          {data.pickup ? (
            <>
              <p className="text-sm font-medium">{data.pickup.pickupBusinessName}</p>
              <p className="text-sm text-muted-foreground">{formatLocationAddress(data.pickup)}</p>
              {[data.pickup.latitude, data.pickup.longitude].every((x) => x != null) ? (
                <p className="text-xs font-mono text-muted-foreground">
                  {data.pickup.latitude!.toFixed(6)}, {data.pickup.longitude!.toFixed(6)}
                </p>
              ) : null}
              <Separator className="my-3" />
              <DetailGrid
                rows={[
                  { label: 'Contact name', value: data.pickup.pickupName },
                  { label: 'Phone', value: data.pickup.pickupPhoneNumber },
                  { label: 'Notes', value: data.pickup.pickupNotes ?? '—' },
                ]}
              />
            </>
          ) : (
            <p className="text-sm text-muted-foreground">No pickup details</p>
          )}
        </section>

        <section className="space-y-2">
          <h2 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Dropoff</h2>
          {data.dropoff ? (
            <>
              <p className="text-sm font-medium">{data.dropoff.dropoffBusinessName ?? data.dropoff.dropoffName}</p>
              <p className="text-sm text-muted-foreground">{formatLocationAddress(data.dropoff)}</p>
              {[data.dropoff.latitude, data.dropoff.longitude].every((x) => x != null) ? (
                <p className="text-xs font-mono text-muted-foreground">
                  {data.dropoff.latitude!.toFixed(6)}, {data.dropoff.longitude!.toFixed(6)}
                </p>
              ) : null}
              <Separator className="my-3" />
              <DetailGrid
                rows={[
                  { label: 'Recipient', value: data.dropoff.dropoffName },
                  { label: 'Phone', value: data.dropoff.dropoffPhoneNumber },
                  { label: 'Notes', value: data.dropoff.dropoffNotes ?? '—' },
                  { label: 'Seller notes', value: data.dropoff.dropoffSellerNotes ?? '—' },
                ]}
              />
            </>
          ) : (
            <p className="text-sm text-muted-foreground">No dropoff details</p>
          )}
        </section>
      </div>

      <Separator />

      <section className="space-y-2">
        <h2 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Order & pricing</h2>
        <DetailGrid
          rows={[
            { label: 'Order reference', value: data.orderReference ?? '—' },
            { label: 'Declared order value', value: formatCurrency(data.orderTotalValue ?? null, data.currencyCode) },
            { label: 'Total cost', value: formatCurrency(data.totalCost, data.currencyCode) },
            { label: 'Fee', value: formatCurrency(data.fee ?? null, data.currencyCode) },
            { label: 'Tips', value: formatCurrency(tips, data.currencyCode) },
            { label: 'Courier compensation', value: formatCurrency(data.totalCompensation ?? null, data.currencyCode) },
            { label: 'Deliverable action', value: data.deliverableAction ? formatStatus(data.deliverableAction) : '—' },
            { label: 'Undeliverable action', value: data.undeliverableAction ? formatStatus(data.undeliverableAction) : '—' },
            { label: 'Undeliverable reason', value: data.undeliverableReason ?? '—' },
            { label: 'Requires ID', value: data.requiresId ? 'Yes' : 'No' },
          ]}
        />
        {orderItems.length > 0 ? (
          <div className="mt-3 space-y-2">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Items</p>
            <ul className="divide-y rounded-md border text-sm">
              {orderItems.map((item, i) => (
                <li key={`${item.name}-${i}`} className="flex flex-wrap justify-between gap-2 px-3 py-2">
                  <span className="font-medium">{item.name}</span>
                  <span className="text-muted-foreground">
                    ×{item.quantity}
                    {item.size ? ` · ${item.size}` : ''}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </section>

      <Separator />

      <section className="space-y-2">
        <h2 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Identifiers</h2>
        <DetailGrid
          rows={[
            { label: 'Quote ID', value: data.quoteId ?? data.deliveryQuoteId ?? '—' },
            { label: 'Delivery quote ID', value: data.deliveryQuoteId ?? '—' },
            { label: 'Idempotency key', value: data.idempotencyKey ?? '—' },
            { label: 'External ID', value: data.externalId ?? '—' },
            { label: 'External store ID', value: data.externalStoreId ?? '—' },
          ]}
        />
        {data.externalUserInfo != null ? (
          <pre className="mt-2 max-h-40 overflow-auto rounded-md border bg-muted/40 p-3 text-xs">
            {JSON.stringify(data.externalUserInfo, null, 2)}
          </pre>
        ) : null}
      </section>

      {data.customerNotes && data.customerNotes.length > 0 ? (
        <>
          <Separator />
          <section className="space-y-2">
            <h2 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Customer notes</h2>
            <pre className="max-h-40 overflow-auto rounded-md border bg-muted/40 p-3 text-xs">
              {JSON.stringify(data.customerNotes, null, 2)}
            </pre>
          </section>
        </>
      ) : null}
    </div>
  )
}

function AdminDeliveryDetails({ data }: { data: ManualRequestDeliveryDto }) {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <Badge variant={statusVariant(data.status)} className="text-sm">
          {formatStatus(data.status)}
        </Badge>
        <p className="text-xs text-muted-foreground">
          Created {formatDate(data.createdAt)} · Updated {formatDate(data.updatedAt)}
        </p>
      </div>

      <section className="space-y-2">
        <h2 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Delivery</h2>
        <DetailGrid
          rows={[
            { label: 'Courier ID', value: data.courierId ?? 'Unassigned' },
            { label: 'Partner ID', value: data.partnerId ?? '—' },
            { label: 'Delivery quote ID', value: data.deliveryQuoteId },
            { label: 'Order reference', value: data.orderReference ?? '—' },
          ]}
        />
      </section>

      <Separator />

      <section className="space-y-2">
        <h2 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Pickup</h2>
        <DetailGrid
          rows={[
            { label: 'Location ID', value: data.pickupLocationId },
            { label: 'Name', value: data.pickupName },
            { label: 'Business', value: data.pickupBusinessName },
            { label: 'Phone', value: data.pickupPhoneNumber },
            { label: 'Notes', value: data.pickupNotes ?? '—' },
            { label: 'Ready', value: formatDate(data.pickupReadyAt) },
            { label: 'Deadline', value: formatDate(data.pickupDeadlineAt) },
          ]}
        />
      </section>

      <Separator />

      <section className="space-y-2">
        <h2 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Dropoff</h2>
        <DetailGrid
          rows={[
            { label: 'Location ID', value: data.dropoffLocationId },
            { label: 'Name', value: data.dropoffName },
            { label: 'Business', value: data.dropoffBusinessName ?? '—' },
            { label: 'Phone', value: data.dropoffPhoneNumber },
            { label: 'Notes', value: data.dropoffNotes ?? '—' },
            { label: 'Ready', value: formatDate(data.dropoffReadyAt) },
            { label: 'ETA', value: formatDate(data.dropoffEta) },
            { label: 'Deadline', value: formatDate(data.dropoffDeadlineAt) },
          ]}
        />
      </section>

      <Separator />

      <section className="space-y-2">
        <h2 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Pricing & actions</h2>
        <DetailGrid
          rows={[
            { label: 'Currency', value: data.currencyCode },
            { label: 'Total cost', value: formatCurrency(data.totalCost, data.currencyCode) },
            { label: 'Pay', value: formatCurrency(data.pay, data.currencyCode) },
            { label: 'Fee', value: formatCurrency(data.fee, data.currencyCode) },
            { label: 'Deliverable action', value: formatStatus(data.deliverableAction) },
            { label: 'Undeliverable action', value: data.undeliverableAction ? formatStatus(data.undeliverableAction) : '—' },
          ]}
        />
      </section>
    </div>
  )
}

export default function ManualRequestStatusPage() {
  const router = useRouter()
  const deliveryId = typeof router.query.deliveryId === 'string' ? router.query.deliveryId : ''
  const partnerMode = getManualRequestApiMode() === 'partner'

  const { data, isLoading, error, refetch } = useGetManualRequestDeliveryQuery(deliveryId, {
    skip: !deliveryId,
  })
  const [cancelDelivery, { isLoading: isCanceling }] = useCancelManualRequestDeliveryMutation()
  const statusCode = (error as any)?.statusCode ?? (error as any)?.status
  const errorMessage =
    statusCode === 401
      ? 'Unauthorized (401). Missing or invalid JWT token. Configure accessToken and refresh.'
      : 'Failed to load delivery status. Check token and backend.'

  const isTerminal = data ? TERMINAL_STATUSES.has(data.status) : false

  const handleCancel = async () => {
    if (!deliveryId) return
    await cancelDelivery(deliveryId)
    await refetch()
  }

  return (
    <>
      <Head>
        <title>Delivery Status</title>
      </Head>
      <main className="container space-y-4 py-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-xl font-semibold">Delivery status</h1>
          <div className="flex flex-wrap gap-3 text-sm">
            {partnerMode ? (
              <Link href="/manual-request/deliveries" className="underline">
                All deliveries
              </Link>
            ) : null}
            <Link href="/manual-request" className="underline">
              Back to request form
            </Link>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="break-all font-mono text-base text-muted-foreground">{deliveryId || '—'}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {isLoading ? <p className="text-sm text-muted-foreground">Loading delivery status...</p> : null}
            {error ? <p className="text-sm text-destructive">{errorMessage}</p> : null}

            {data && partnerMode ? <PartnerDeliveryDetails data={data as PartnerDeliveryDto} /> : null}
            {data && !partnerMode ? <AdminDeliveryDetails data={data as ManualRequestDeliveryDto} /> : null}

            <Separator />

            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => refetch()} disabled={isLoading}>
                Refresh
              </Button>
              <Button
                variant="destructive"
                onClick={handleCancel}
                disabled={isCanceling || !data || isTerminal}
              >
                {isCanceling ? 'Canceling...' : 'Cancel delivery'}
              </Button>
            </div>
            {isTerminal ? (
              <p className="text-xs text-muted-foreground">This delivery can no longer be cancelled.</p>
            ) : null}
          </CardContent>
        </Card>
      </main>
    </>
  )
}
