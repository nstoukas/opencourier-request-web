import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button, Card, CardContent, CardHeader, CardTitle } from '../../admin-web-components'
import { useWaitRecordQuery } from '../../api/manualRequestApi'

const PERIODS = [7, 30, 90]

// Spec 0030 (AC-8): the restaurant's own record. Figures about the restaurant, naming no rider.
export function WaitRecordCard() {
  const { t } = useTranslation()
  const orNotEnough = (value: number | null, render: (value: number) => string) =>
    value === null ? t('waitRecord.notEnough') : render(value)
  const [days, setDays] = useState(30)
  const { data, error } = useWaitRecordQuery(days)

  return (
    <Card data-testid="wait-record">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">{t('waitRecord.title')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <div className="flex gap-2">
          {PERIODS.map((period) => (
            <Button
              key={period}
              type="button"
              size="sm"
              variant={period === days ? 'default' : 'outline'}
              onClick={() => setDays(period)}
            >
              {t('waitRecord.days', { count: period })}
            </Button>
          ))}
        </div>
        {error ? <p className="text-destructive">{t('waitRecord.loadFailed')}</p> : null}
        {/* Only the answer for this period, so the old figures never sit under the new button. */}
        {data && data.days === days ? (
          <dl className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <div>
              <dt className="text-muted-foreground">{t('waitRecord.waitedPastReady')}</dt>
              <dd className="font-medium">
                {orNotEnough(data.averageWaitMinutes, (value) => t('waitRecord.averageMinutes', { count: value }))}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">{t('waitRecord.ranLate')}</dt>
              <dd className="font-medium">{orNotEnough(data.lateShare, (value) => `${Math.round(value * 100)}%`)}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">{t('waitRecord.realPrep')}</dt>
              <dd className="font-medium">
                {orNotEnough(data.medianPrepMinutes, (value) => t('common.minutes', { count: value }))}
              </dd>
            </div>
          </dl>
        ) : null}
      </CardContent>
    </Card>
  )
}
