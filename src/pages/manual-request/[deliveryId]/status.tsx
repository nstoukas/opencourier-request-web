import Head from 'next/head'
import Link from 'next/link'
import { useRouter } from 'next/router'
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  DetailList,
  Separator,
  StatusBadge,
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
import { CustomerSaveNotice } from '../../../modules/saved-customers/components/CustomerSaveNotice'
import { formatDateTime, formatMoney } from '../../../utils/format'
import { PageHeader } from '../../../modules/portal/components/PortalFrame'

const TERMINAL_STATUSES = new Set(['DROPPED_OFF', 'CANCELED', 'FAILED'])

function formatStatus(status: string) {
  return status.replace(/_/g, ' ')
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

function PartnerDeliveryDetails({ data }: { data: PartnerDeliveryDto }) {
  const tips = data.tips ?? 0
  const orderItems = data.orderItems ?? []

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <StatusBadge status={data.status} className="text-sm" />
        <p className="text-xs text-muted-foreground">Created {formatDateTime(data.createdAt)}</p>
      </div>

      <section className="space-y-2">
        <h2 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Schedule</h2>
        <DetailList
          items={[
            { label: 'Pickup ready', value: formatDateTime(data.pickupReadyAt) },
            { label: 'Pickup deadline', value: formatDateTime(data.pickupDeadlineAt) },
            { label: 'Dropoff ready', value: formatDateTime(data.dropoffReadyAt) },
            { label: 'Dropoff ETA', value: formatDateTime(data.dropoffEta) },
            { label: 'Dropoff deadline', value: formatDateTime(data.dropoffDeadlineAt) },
          ]}
        />
      </section>

      <Separator />

      <section className="space-y-2">
        <h2 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Courier</h2>
        <DetailList
          items={[
            { label: 'Name', value: courierLabel(data) },
            ...(data.courier?.phoneNumber
              ? [{ label: 'Phone', value: data.courier.phoneNumber } as const]
              : []),
            ...(data.courier?.id ? [{ label: 'Courier ID', value: data.courier.id, mono: true } as const] : []),
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
              <DetailList
                items={[
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
              <DetailList
                items={[
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
        <DetailList
          items={[
            { label: 'Order reference', value: data.orderReference ?? '—' },
            { label: 'Declared order value', value: formatMoney(data.orderTotalValue ?? null, data.currencyCode) },
            { label: 'Total cost', value: formatMoney(data.totalCost, data.currencyCode) },
            { label: 'Fee', value: formatMoney(data.fee ?? null, data.currencyCode) },
            { label: 'Tips', value: formatMoney(tips, data.currencyCode) },
            { label: 'Courier compensation', value: formatMoney(data.totalCompensation ?? null, data.currencyCode) },
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
        <DetailList
          items={[
            { label: 'Quote ID', value: data.quoteId ?? data.deliveryQuoteId ?? '—', mono: true },
            { label: 'Delivery quote ID', value: data.deliveryQuoteId ?? '—', mono: true },
            { label: 'Idempotency key', value: data.idempotencyKey ?? '—', mono: true },
            { label: 'External ID', value: data.externalId ?? '—', mono: true },
            { label: 'External store ID', value: data.externalStoreId ?? '—', mono: true },
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
        <StatusBadge status={data.status} className="text-sm" />
        <p className="text-xs text-muted-foreground">
          Created {formatDateTime(data.createdAt)} · Updated {formatDateTime(data.updatedAt)}
        </p>
      </div>

      <section className="space-y-2">
        <h2 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Delivery</h2>
        <DetailList
          items={[
            { label: 'Courier ID', value: data.courierId ?? 'Unassigned' },
            { label: 'Partner ID', value: data.partnerId ?? '—', mono: true },
            { label: 'Delivery quote ID', value: data.deliveryQuoteId, mono: true },
            { label: 'Order reference', value: data.orderReference ?? '—' },
          ]}
        />
      </section>

      <Separator />

      <section className="space-y-2">
        <h2 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Pickup</h2>
        <DetailList
          items={[
            { label: 'Location ID', value: data.pickupLocationId, mono: true },
            { label: 'Name', value: data.pickupName },
            { label: 'Business', value: data.pickupBusinessName },
            { label: 'Phone', value: data.pickupPhoneNumber },
            { label: 'Notes', value: data.pickupNotes ?? '—' },
            { label: 'Ready', value: formatDateTime(data.pickupReadyAt) },
            { label: 'Deadline', value: formatDateTime(data.pickupDeadlineAt) },
          ]}
        />
      </section>

      <Separator />

      <section className="space-y-2">
        <h2 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Dropoff</h2>
        <DetailList
          items={[
            { label: 'Location ID', value: data.dropoffLocationId, mono: true },
            { label: 'Name', value: data.dropoffName },
            { label: 'Business', value: data.dropoffBusinessName ?? '—' },
            { label: 'Phone', value: data.dropoffPhoneNumber },
            { label: 'Notes', value: data.dropoffNotes ?? '—' },
            { label: 'Ready', value: formatDateTime(data.dropoffReadyAt) },
            { label: 'ETA', value: formatDateTime(data.dropoffEta) },
            { label: 'Deadline', value: formatDateTime(data.dropoffDeadlineAt) },
          ]}
        />
      </section>

      <Separator />

      <section className="space-y-2">
        <h2 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Pricing & actions</h2>
        <DetailList
          items={[
            { label: 'Currency', value: data.currencyCode },
            { label: 'Total cost', value: formatMoney(data.totalCost, data.currencyCode) },
            { label: 'Pay', value: formatMoney(data.pay, data.currencyCode) },
            { label: 'Fee', value: formatMoney(data.fee, data.currencyCode) },
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
        <title>Delivery Status · OpenCourier</title>
      </Head>
      {/* The frame (PortalFrame) supplies <main> and the 768px column; this is the page inside it. */}
      <div className="space-y-6">
        <PageHeader
          title="Delivery Status"
          actions={
            <>
              {partnerMode ? (
                <Link href="/manual-request/deliveries" className="underline">
                  All deliveries
                </Link>
              ) : null}
              {/* asChild: the Button's look on the Link itself, so it stays a real link (spec 0006, AC-14).
                  The order form mounts afresh there, so it opens empty. */}
              <Button asChild size="xl">
                <Link href="/manual-request">New order</Link>
              </Button>
            </>
          }
        />

        {/* After an order whose customer could not be saved (spec 0005). */}
        <CustomerSaveNotice code={router.query.customerSave} />

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
      </div>
    </>
  )
}
