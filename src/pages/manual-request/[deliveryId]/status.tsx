import { ReadyControls } from '../../../modules/ready/ReadyControls'
import { ReportProductCard } from '../../../modules/product-report/ReportProductCard'
import { RiderComplaintSection } from '../../../modules/complaints/RiderComplaintSection'
import { useCallback, useState } from 'react'
import { OrderLegsSection } from '../../../modules/legs/OrderLegsSection'
import { legLabel } from '../../../modules/manual-request/utils/legs'
import { splitChargeNote, splitOutcomeLine } from '../../../modules/legs/splitOutcome'
import Head from 'next/head'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
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
import { useFormat } from '../../../i18n/useFormat'
import { orderCodeOf } from '../../../utils/orderCode'
import { restaurantErrorText } from '../../../utils/restaurantError'
import { PageHeader } from '../../../modules/portal/components/PortalFrame'
import { CancelDeliveryDialog } from '../../../modules/cancel/CancelDeliveryDialog'

const TERMINAL_STATUSES = new Set(['DROPPED_OFF', 'CANCELED', 'FAILED'])

// A backend action code ("MEET_AT_DOOR") with spaces. These codes are shown as they are: they are the
// API's own values, not words the portal chose (decision 47.9).
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

function courierLabel(d: PartnerDeliveryDto, t: TFunction): string {
  const c = d.courier
  if (!c) return t('orderPage.unassigned')
  const name = [c.firstName, c.lastName].filter(Boolean).join(' ').trim()
  return name || c.id || t('orderPage.assigned')
}

// An item's box size in the reader's language (the order form's words); an unknown code shows as it is.
const SIZE_KEYS: Record<string, string> = { SMALL: 'form.sizeSmall', MEDIUM: 'form.sizeMedium', LARGE: 'form.sizeLarge' }

function PartnerDeliveryDetails({
  data,
  onChanged,
  otherLegs = [],
  legsLoaded = true,
}: {
  data: PartnerDeliveryDto
  onChanged?: () => void
  // Spec 0046 (cross check 9): the order's other legs, so Food ready and "+ minutes" apply to all of them.
  otherLegs?: PartnerDeliveryDto[]
  // False on a leg's page until its order's legs were read once: a tap before then would move this leg
  // alone (agy's review of row 10). Always true for a single delivery.
  legsLoaded?: boolean
}) {
  const { t } = useTranslation()
  const format = useFormat()
  const tips = data.tips ?? 0
  const orderItems = data.orderItems ?? []

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <StatusBadge status={data.status} className="text-sm" />
        <p className="text-xs text-muted-foreground">{t('orderPage.createdAt', { time: format.dateTime(data.createdAt) })}</p>
      </div>

      <section className="space-y-2">
        <h2 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{t('orderPage.schedule')}</h2>
        {/* Spec 0023 (AC-8): the ready promise and its buttons, in place of "Pickup ready", which showed
            pickupReadyAt (the pickup moment once the rider has the food). */}
        {legsLoaded ? (
          <ReadyControls
            deliveryId={data.id}
            order={{ status: data.status, readyAt: data.readyAt, foodReadyAt: data.foodReadyAt }}
            onChanged={onChanged}
            otherLegs={otherLegs.map((leg) => ({
              id: leg.id,
              readyAt: leg.readyAt,
              legLabel: legLabel(leg.legNumber ?? 0, leg.legCount ?? 0, t),
            }))}
          />
        ) : (
          <p className="text-sm text-muted-foreground" data-testid="ready-waiting-for-legs">
            {t('orderPage.readyWaitsForLegs')}
          </p>
        )}
        <DetailList
          items={[
            { label: t('orderPage.pickupDeadline'), value: format.dateTime(data.pickupDeadlineAt) },
            { label: t('orderPage.dropoffReady'), value: format.dateTime(data.dropoffReadyAt) },
            { label: t('orderPage.dropoffEta'), value: format.dateTime(data.dropoffEta) },
            { label: t('orderPage.dropoffDeadline'), value: format.dateTime(data.dropoffDeadlineAt) },
          ]}
        />
      </section>

      {/* Spec 0032: once it is delivered, the restaurant can report a wrong or missing product. */}
      {data.status === 'DROPPED_OFF' ? <ReportProductCard deliveryId={data.id} orderItems={orderItems} /> : null}

      <Separator />

      <section className="space-y-2">
        <h2 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{t('orderPage.courier')}</h2>
        <DetailList
          items={[
            { label: t('orderPage.name'), value: courierLabel(data, t) },
            ...(data.courier?.phoneNumber
              ? [{ label: t('orderPage.phone'), value: data.courier.phoneNumber } as const]
              : []),
            ...(data.courier?.id ? [{ label: t('orderPage.courierId'), value: data.courier.id, mono: true } as const] : []),
            ...(data.courier?.vehicleType != null
              ? [{ label: t('orderPage.vehicle'), value: String(data.courier.vehicleType) || '—' } as const]
              : []),
          ]}
        />
      </section>

      {/* Spec 0052 (row 83): the restaurant's complaints about this order's rider, with their outcomes, and the
          form to file one once the order is delivered or cancelled. */}
      <RiderComplaintSection deliveryId={data.id} status={data.status} />

      <Separator />

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="space-y-2">
          <h2 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{t('orderPage.pickup')}</h2>
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
                  { label: t('orderPage.contactName'), value: data.pickup.pickupName },
                  { label: t('orderPage.phone'), value: data.pickup.pickupPhoneNumber },
                  { label: t('orderPage.notes'), value: data.pickup.pickupNotes ?? '—' },
                ]}
              />
            </>
          ) : (
            <p className="text-sm text-muted-foreground">{t('orderPage.noPickup')}</p>
          )}
        </section>

        <section className="space-y-2">
          <h2 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{t('orderPage.dropoff')}</h2>
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
                  { label: t('orderPage.recipient'), value: data.dropoff.dropoffName },
                  { label: t('orderPage.phone'), value: data.dropoff.dropoffPhoneNumber },
                  { label: t('orderPage.floor'), value: data.dropoff.dropoffFloor ?? '—' },
                  { label: t('orderPage.doorbell'), value: data.dropoff.dropoffDoorbell ?? '—' },
                  { label: t('orderPage.notes'), value: data.dropoff.dropoffNotes ?? '—' },
                  { label: t('orderPage.sellerNotes'), value: data.dropoff.dropoffSellerNotes ?? '—' },
                ]}
              />
            </>
          ) : (
            <p className="text-sm text-muted-foreground">{t('orderPage.noDropoff')}</p>
          )}
        </section>
      </div>

      <Separator />

      <section className="space-y-2">
        <h2 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{t('orderPage.orderAndPricing')}</h2>
        <DetailList
          items={[
            { label: t('orderPage.orderReference'), value: data.orderReference ?? '—' },
            { label: t('orderPage.declaredOrderValue'), value: format.money(data.orderTotalValue ?? null, data.currencyCode) },
            { label: t('orderPage.totalCost'), value: format.money(data.totalCost, data.currencyCode) },
            { label: t('orderPage.fee'), value: format.money(data.fee ?? null, data.currencyCode) },
            { label: t('orderPage.tips'), value: format.money(tips, data.currencyCode) },
            { label: t('orderPage.courierCompensation'), value: format.money(data.totalCompensation ?? null, data.currencyCode) },
            { label: t('orderPage.deliverableAction'), value: data.deliverableAction ? formatStatus(data.deliverableAction) : '—' },
            { label: t('orderPage.undeliverableAction'), value: data.undeliverableAction ? formatStatus(data.undeliverableAction) : '—' },
            { label: t('orderPage.undeliverableReason'), value: data.undeliverableReason ?? '—' },
            { label: t('orderPage.requiresId'), value: data.requiresId ? t('orderPage.yes') : t('orderPage.no') },
          ]}
        />
        {orderItems.length > 0 ? (
          <div className="mt-3 space-y-2">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{t('items.legend')}</p>
            <ul className="divide-y rounded-md border text-sm">
              {orderItems.map((item, i) => (
                <li key={`${item.name}-${i}`} className="flex flex-wrap justify-between gap-2 px-3 py-2">
                  <span className="font-medium">
                    {item.name}
                    {/* Spec 0028: the restaurant's mark, so it sees what the rider will see first. */}
                    {item.kind === 'DRINK' || item.kind === 'SIDE' ? (
                      <span className="ml-2 rounded-full bg-primary px-2 py-0.5 text-xs font-medium text-primary-foreground">
                        {item.kind === 'DRINK' ? t('items.drink') : t('items.side')}
                      </span>
                    ) : null}
                  </span>
                  <span className="text-muted-foreground">
                    ×{item.quantity}
                    {item.size ? ` · ${SIZE_KEYS[item.size] ? t(SIZE_KEYS[item.size]) : item.size}` : ''}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </section>

      <Separator />

      <section className="space-y-2">
        <h2 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{t('orderPage.identifiers')}</h2>
        <DetailList
          items={[
            { label: t('orderPage.quoteId'), value: data.quoteId ?? data.deliveryQuoteId ?? '—', mono: true },
            { label: t('orderPage.deliveryQuoteId'), value: data.deliveryQuoteId ?? '—', mono: true },
            { label: t('orderPage.idempotencyKey'), value: data.idempotencyKey ?? '—', mono: true },
            { label: t('orderPage.externalId'), value: data.externalId ?? '—', mono: true },
            { label: t('orderPage.externalStoreId'), value: data.externalStoreId ?? '—', mono: true },
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
            <h2 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{t('orderPage.customerNotes')}</h2>
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
  const { t } = useTranslation()
  const format = useFormat()
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <StatusBadge status={data.status} className="text-sm" />
        <p className="text-xs text-muted-foreground">
          {t('orderPage.createdAt', { time: format.dateTime(data.createdAt) })} ·{' '}
          {t('orderPage.updatedAt', { time: format.dateTime(data.updatedAt) })}
        </p>
      </div>

      <section className="space-y-2">
        <h2 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{t('orderPage.delivery')}</h2>
        <DetailList
          items={[
            { label: t('orderPage.courierId'), value: data.courierId ?? t('orderPage.unassigned') },
            { label: t('orderPage.partnerId'), value: data.partnerId ?? '—', mono: true },
            { label: t('orderPage.deliveryQuoteId'), value: data.deliveryQuoteId, mono: true },
            { label: t('orderPage.orderReference'), value: data.orderReference ?? '—' },
          ]}
        />
      </section>

      <Separator />

      <section className="space-y-2">
        <h2 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{t('orderPage.pickup')}</h2>
        <DetailList
          items={[
            { label: t('orderPage.locationId'), value: data.pickupLocationId, mono: true },
            { label: t('orderPage.name'), value: data.pickupName },
            { label: t('orderPage.business'), value: data.pickupBusinessName },
            { label: t('orderPage.phone'), value: data.pickupPhoneNumber },
            { label: t('orderPage.notes'), value: data.pickupNotes ?? '—' },
            { label: t('orderPage.ready'), value: format.dateTime(data.pickupReadyAt) },
            { label: t('orderPage.deadline'), value: format.dateTime(data.pickupDeadlineAt) },
          ]}
        />
      </section>

      <Separator />

      <section className="space-y-2">
        <h2 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{t('orderPage.dropoff')}</h2>
        <DetailList
          items={[
            { label: t('orderPage.locationId'), value: data.dropoffLocationId, mono: true },
            { label: t('orderPage.name'), value: data.dropoffName },
            { label: t('orderPage.business'), value: data.dropoffBusinessName ?? '—' },
            { label: t('orderPage.phone'), value: data.dropoffPhoneNumber },
            { label: t('orderPage.notes'), value: data.dropoffNotes ?? '—' },
            { label: t('orderPage.ready'), value: format.dateTime(data.dropoffReadyAt) },
            { label: t('orderPage.eta'), value: format.dateTime(data.dropoffEta) },
            { label: t('orderPage.deadline'), value: format.dateTime(data.dropoffDeadlineAt) },
          ]}
        />
      </section>

      <Separator />

      <section className="space-y-2">
        <h2 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{t('orderPage.pricingAndActions')}</h2>
        <DetailList
          items={[
            { label: t('orderPage.currency'), value: data.currencyCode },
            { label: t('orderPage.totalCost'), value: format.money(data.totalCost, data.currencyCode) },
            { label: t('orderPage.pay'), value: format.money(data.pay, data.currencyCode) },
            { label: t('orderPage.fee'), value: format.money(data.fee, data.currencyCode) },
            { label: t('orderPage.deliverableAction'), value: formatStatus(data.deliverableAction) },
            { label: t('orderPage.undeliverableAction'), value: data.undeliverableAction ? formatStatus(data.undeliverableAction) : '—' },
          ]}
        />
      </section>
    </div>
  )
}

export default function ManualRequestStatusPage() {
  const { t } = useTranslation()
  const router = useRouter()
  const deliveryId = typeof router.query.deliveryId === 'string' ? router.query.deliveryId : ''
  const partnerMode = getManualRequestApiMode() === 'partner'

  const { data, isLoading, error, refetch } = useGetManualRequestDeliveryQuery(deliveryId, {
    skip: !deliveryId,
  })
  // The cancel asks first, and asks who wanted it (spec 0015).
  const [cancelOpen, setCancelOpen] = useState(false)
  // Spec 0046: the order's other legs, read by OrderLegsSection, and a counter that asks it to read again.
  const [otherLegs, setOtherLegs] = useState<PartnerDeliveryDto[]>([])
  // Which delivery's legs `otherLegs` holds, so the ready buttons wait for this page's order (null: none yet).
  const [legsLoadedFor, setLegsLoadedFor] = useState<string | null>(null)
  const [legsVersion, setLegsVersion] = useState(0)
  const handleLegs = useCallback(
    (legs: PartnerDeliveryDto[]) => {
      setOtherLegs(legs.filter((leg) => leg.id !== deliveryId))
      setLegsLoadedFor(deliveryId)
    },
    [deliveryId],
  )
  const partnerData = partnerMode ? (data as PartnerDeliveryDto | undefined) : undefined
  // Spec 0047: split at pickup, or left because it didn't fit one box.
  const splitLine = partnerData ? splitOutcomeLine(partnerData, t) : null
  // Decision 11.10: what the split costs the restaurant, and why a leg the split made reads cost 0.
  const splitNoteKey = partnerData ? splitChargeNote(partnerData) : null
  const isLeg = Boolean(partnerData?.legCount)
  // The server's own sentence for a refusal, else a general line (restaurantErrorText). A 401 is handled
  // by the frame, which checks the session.
  const errorMessage = restaurantErrorText(error, t('orderPage.loadFailed'))

  const isTerminal = data ? TERMINAL_STATUSES.has(data.status) : false


  return (
    <>
      <Head>
        <title>{t('orderPage.documentTitle')}</title>
      </Head>
      {/* The frame (PortalFrame) supplies <main> and the 768px column; this is the page inside it. */}
      <div className="space-y-6">
        <PageHeader
          title={t('orderPage.title')}
          actions={
            <>
              {partnerMode ? (
                <Link href="/manual-request/deliveries" className="underline">
                  {t('orderPage.allDeliveries')}
                </Link>
              ) : null}
              {/* asChild: the Button's look on the Link itself, so it stays a real link (spec 0006, AC-14).
                  The order form mounts afresh there, so it opens empty. */}
              <Button asChild size="xl">
                <Link href="/manual-request">{t('orderPage.newOrder')}</Link>
              </Button>
            </>
          }
        />

        {/* After an order whose customer could not be saved (spec 0005). */}
        <CustomerSaveNotice code={router.query.customerSave} />

        <Card>
          <CardHeader>
            {/* Spec 0021 (AC-10): the code the rider shows when collecting, big, so staff match the bag at a
                glance. The full id stays below it. */}
            {deliveryId ? (
              <p className="text-sm text-muted-foreground">
                {t('orderPage.orderCode')}{' '}
                <span className="block font-mono text-4xl font-bold tracking-wide text-foreground" data-testid="order-code">
                  #{orderCodeOf(deliveryId)}
                </span>
              </p>
            ) : null}
            <CardTitle className="break-all font-mono text-base text-muted-foreground">{deliveryId || '—'}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {isLoading && !data ? <p className="text-sm text-muted-foreground">{t('orderPage.loading')}</p> : null}
            {error && !data ? <p className="text-sm text-destructive">{errorMessage}</p> : null}
            {/* The page refreshes every 30 s until the order ends (spec 0017, AC-4); a failed refresh keeps it. */}
            {error && data ? (
              <p role="status" className="text-sm text-muted-foreground">
                {t('orderPage.refreshFailed')}
              </p>
            ) : null}

            {/* Spec 0046 (AC-6): which leg this is, and the order's other legs. */}
            {partnerData?.legNumber && partnerData.legCount ? (
              <p className="text-base font-medium" data-testid="leg-label">
                {legLabel(partnerData.legNumber, partnerData.legCount, t)}
              </p>
            ) : null}
            {/* Spec 0047 (AC-8, AC-10): split by dispatch at pickup, or left because it didn't fit one box. */}
            {splitLine ? (
              <p className="text-sm font-medium" data-testid="split-outcome">
                {splitLine}
              </p>
            ) : null}
            {splitNoteKey ? (
              <p className="text-xs text-muted-foreground" data-testid="split-charge-note">
                {t(splitNoteKey)}
              </p>
            ) : null}
            {data && partnerMode ? (
              <PartnerDeliveryDetails
                data={data as PartnerDeliveryDto}
                onChanged={() => {
                  void refetch()
                  // Row 10 review: the other legs' ready times moved too; read them again, or the next tap
                  // sends their old time and is refused.
                  setLegsVersion((value) => value + 1)
                }}
                otherLegs={otherLegs.filter((leg) => !TERMINAL_STATUSES.has(leg.status))}
                legsLoaded={!isLeg || legsLoadedFor === deliveryId}
              />
            ) : null}
            {isLeg && deliveryId ? (
              <>
                <Separator />
                <OrderLegsSection
                  deliveryId={deliveryId}
                  version={legsVersion}
                  onChanged={() => void refetch()}
                  onLegs={handleLegs}
                />
              </>
            ) : null}
            {data && !partnerMode ? <AdminDeliveryDetails data={data as ManualRequestDeliveryDto} /> : null}

            <Separator />

            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  void refetch()
                  setLegsVersion((value) => value + 1)
                }}
                disabled={isLoading}
              >
                {t('orderPage.refresh')}
              </Button>
              <Button
                variant="destructive"
                onClick={() => setCancelOpen(true)}
                disabled={!data || isTerminal || !deliveryId}
              >
                {t('cancel.confirm')}
              </Button>
            </div>
            {isTerminal ? (
              <p className="text-xs text-muted-foreground">{t('orderPage.cannotCancel')}</p>
            ) : null}
            {cancelOpen ? (
              <CancelDeliveryDialog
                deliveryId={deliveryId}
                onClose={() => setCancelOpen(false)}
                onCancelled={() => {
                  setCancelOpen(false)
                  setLegsVersion((value) => value + 1)
                  void refetch()
                }}
              />
            ) : null}
          </CardContent>
        </Card>
      </div>
    </>
  )
}
