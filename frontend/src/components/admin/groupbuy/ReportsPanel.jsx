import React from 'react';
import { adminGroupBuyApi } from '../../../api/groupBuyApi';
import AnalyticsDashboard from '../../groupbuy/analytics/AnalyticsDashboard';

export default function ReportsPanel({ onOpenCampaign }) {
  return (
    <AnalyticsDashboard
      scope="platform"
      accent="rose"
      fetchAnalytics={adminGroupBuyApi.getReport}
      onOpenCampaign={onOpenCampaign}
    />
  );
}
