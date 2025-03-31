"use client";

import {
  MetricCard,
  ConversionFunnel,
  SplitMetric,
  RefreshButton,
} from "./DashboardCards";
import {SurveyStepsFunnel} from "./SurveyStepsFunnel";
import {useAnalytics, TimeRange} from "@/hooks/useAnalytics";
import {Tabs, TabsList, TabsTrigger} from "@/components/ui/tabs";
import {Button} from "@/components/ui/button";
import {RefreshCw} from "lucide-react";
import {Card, CardContent, CardHeader, CardTitle} from "@/components/ui/card";
import {Skeleton} from "@/components/ui/skeleton";
import {useState} from "react";

const timeRangeLabels: Record<TimeRange, string> = {
  "24h": "Last 24 Hours",
  "7d": "Last 7 Days",
  "30d": "Last 30 Days",
  all: "All Time",
};

export function AnalyticsDashboard() {
  const {data, loading, error, timeRange, changeTimeRange, refreshData} =
    useAnalytics();
  const [refreshingStates, setRefreshingStates] = useState<
    Record<string, boolean>
  >({
    visitors: false,
    surveyStarted: false,
    surveyCompleted: false,
    signups: false,
    surveyFunnel: false,
    surveyTypes: false,
    signupMethods: false,
    recommendations: false,
    surveySteps: false,
    all: false,
  });

  const refreshMetric = async (metricKey: string) => {
    // Set the specific metric loading state
    setRefreshingStates((prev) => ({...prev, [metricKey]: true}));

    // Refresh all data
    await refreshData();

    // Reset loading state after a short delay for visual feedback
    setTimeout(() => {
      setRefreshingStates((prev) => ({...prev, [metricKey]: false}));
    }, 500);
  };

  const refreshAllMetrics = async () => {
    setRefreshingStates((prev) => ({...prev, all: true}));
    await refreshData();
    setTimeout(() => {
      setRefreshingStates((prev) => ({...prev, all: false}));
    }, 500);
  };

  if (error) {
    return (
      <Card className="border-red-300">
        <CardHeader>
          <CardTitle className="text-red-500">
            Error Loading Analytics
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p>{error.message}</p>
          <button
            className="mt-4 px-4 py-2 bg-primary text-primary-foreground rounded-md"
            onClick={() => refreshAllMetrics()}
          >
            Retry
          </button>
        </CardContent>
      </Card>
    );
  }

  // Only show the full skeleton if initial loading or all metrics are refreshing
  if ((loading && !data) || refreshingStates.all) {
    return <DashboardSkeleton />;
  }

  // Create a default stats object with empty values for type safety
  const defaultStats = {
    totalEvents: 0,
    signupClicks: 0,
    dialogCloses: 0,
    conversionRate: "0%",
    surveyFunnel: {
      visits: 0,
      started: 0,
      completed: 0,
      startRate: "0%",
      completionRate: "0%",
      overallConversionRate: "0%",
    },
    surveyTypes: {
      text: 0,
      image: 0,
      total: 0,
    },
    recommendations: {
      pageVisits: 0,
      companyInterestClicks: 0,
      companyInterestRate: "0%",
      averageCompaniesPerUser: 0,
    },
    signups: {
      emailSignups: 0,
      googleSignups: 0,
      totalSignups: 0,
    },
    surveySteps: []
  };

  // Use the data if available, otherwise use default values
  const stats = data ? data.stats : defaultStats;

  // Process survey step data for display
  const surveySteps = stats.surveySteps || [];
  const stepsWithLabels = surveySteps.map(step => {
    // Parse the step ID to create a readable label
    // Assuming step IDs are like "work_values", "corporate_culture", etc.
    const stepName = step.id.split('_').map(word => 
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');
    
    return {
      ...step,
      label: stepName
    };
  });

  // Render individual metric cards with conditionally showing skeletons when refreshing
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Analytics Dashboard</h2>

        <div className="flex gap-2 items-center">
          <Button
            variant="outline"
            size="sm"
            className="flex items-center gap-1"
            onClick={refreshAllMetrics}
            disabled={refreshingStates.all}
          >
            <RefreshCw
              className={`h-4 w-4 ${
                refreshingStates.all ? "animate-spin" : ""
              }`}
            />
            Refresh All
          </Button>

          <Tabs defaultValue="all">
            <TabsList>
              {(Object.keys(timeRangeLabels) as TimeRange[]).map((range) => (
                <TabsTrigger
                  key={range}
                  value={range}
                  onClick={() => changeTimeRange(range)}
                  data-state={timeRange === range ? "active" : ""}
                >
                  {timeRangeLabels[range]}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Visitors */}
        {refreshingStates.visitors ? (
          <MetricCardSkeleton />
        ) : (
          <MetricCard
            title="Unique Visitors"
            value={stats.totalEvents}
            description="Total unique visitors"
            onRefresh={() => refreshMetric("visitors")}
          />
        )}

        {/* Survey Started */}
        {refreshingStates.surveyStarted ? (
          <MetricCardSkeleton />
        ) : (
          <MetricCard
            title="Survey Started"
            value={stats.surveyFunnel.started}
            description="Users who started the questionnaire"
            onRefresh={() => refreshMetric("surveyStarted")}
          />
        )}

        {/* Survey Completed */}
        {refreshingStates.surveyCompleted ? (
          <MetricCardSkeleton />
        ) : (
          <MetricCard
            title="Survey Completed"
            value={stats.surveyFunnel.completed}
            description="Users who completed the questionnaire"
            onRefresh={() => refreshMetric("surveyCompleted")}
          />
        )}

        {/* Signups */}
        {refreshingStates.signups ? (
          <MetricCardSkeleton />
        ) : (
          <MetricCard
            title="Signups"
            value={stats.signups.totalSignups}
            description="Total account signups"
            onRefresh={() => refreshMetric("signups")}
          />
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Conversion Funnel */}
        {refreshingStates.surveyFunnel ? (
          <ConversionFunnelSkeleton />
        ) : (
          <ConversionFunnel
            title="Questionnaire Funnel"
            steps={[
              {name: "Visits", value: stats.surveyFunnel.visits},
              {name: "Started", value: stats.surveyFunnel.started},
              {name: "Completed", value: stats.surveyFunnel.completed},
            ]}
            rates={[
              {name: "Start Rate", value: stats.surveyFunnel.startRate},
              {
                name: "Completion Rate",
                value: stats.surveyFunnel.completionRate,
              },
              {
                name: "Overall",
                value: stats.surveyFunnel.overallConversionRate,
              },
            ]}
            onRefresh={() => refreshMetric("surveyFunnel")}
          />
        )}

        {/* Survey Types */}
        {refreshingStates.surveyTypes ? (
          <MetricCardSkeleton />
        ) : (
          <SplitMetric
            title="Questionnaire Types"
            metrics={[
              {name: "Text Based", value: stats.surveyTypes.text},
              {name: "Image Based", value: stats.surveyTypes.image},
            ]}
            total={stats.surveyTypes.total}
            onRefresh={() => refreshMetric("surveyTypes")}
          />
        )}

        {/* Signup Methods */}
        {refreshingStates.signupMethods ? (
          <MetricCardSkeleton />
        ) : (
          <SplitMetric
            title="Signup Methods"
            metrics={[
              {name: "Email Signups", value: stats.signups.emailSignups},
              {name: "Google Signups", value: stats.signups.googleSignups},
            ]}
            total={stats.signups.totalSignups}
            onRefresh={() => refreshMetric("signupMethods")}
          />
        )}
      </div>

      {/* Survey Steps Funnel */}
      {refreshingStates.surveySteps ? (
        <SurveyStepsFunnelSkeleton />
      ) : (
        <SurveyStepsFunnel
          title="Survey Step Completion"
          steps={stepsWithLabels}
          totalStarts={stats.surveyFunnel.started}
          onRefresh={() => refreshMetric("surveySteps")}
        />
      )}

      {/* Recommendations Metrics */}
      {refreshingStates.recommendations ? (
        <MetricCardSkeleton />
      ) : (
        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <CardTitle className="text-sm font-medium">
                Recommendations
              </CardTitle>
              <RefreshButton onClick={() => refreshMetric("recommendations")} />
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm">Page Visits</span>
                <span className="font-medium">
                  {stats.recommendations.pageVisits}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm">Interest Clicks</span>
                <span className="font-medium">
                  {stats.recommendations.companyInterestClicks}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm">Interest Rate</span>
                <span className="font-medium">
                  {stats.recommendations.companyInterestRate}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm">Avg. Companies/User</span>
                <span className="font-medium">
                  {stats.recommendations.averageCompaniesPerUser}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// Individual skeleton components for each section

function MetricCardSkeleton() {
  return (
    <Card>
      <CardHeader className="pb-2">
        <Skeleton className="h-5 w-32" />
      </CardHeader>
      <CardContent>
        <Skeleton className="h-8 w-24 mb-2" />
        <Skeleton className="h-4 w-40" />
      </CardContent>
    </Card>
  );
}

function ConversionFunnelSkeleton() {
  return (
    <Card className="col-span-2">
      <CardHeader>
        <Skeleton className="h-6 w-48 mb-2" />
        <Skeleton className="h-4 w-64" />
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            {Array(3)
              .fill(0)
              .map((_, i) => (
                <div key={i} className="text-center">
                  <Skeleton className="h-6 w-16 mx-auto mb-2" />
                  <Skeleton className="h-4 w-24 mx-auto" />
                </div>
              ))}
          </div>
          <Skeleton className="h-4 w-full" />
          <div className="grid grid-cols-3 gap-4">
            {Array(3)
              .fill(0)
              .map((_, i) => (
                <div key={i} className="text-center">
                  <Skeleton className="h-6 w-16 mx-auto mb-2" />
                  <Skeleton className="h-4 w-24 mx-auto" />
                </div>
              ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function SurveyStepsFunnelSkeleton() {
  return (
    <Card className="col-span-3">
      <CardHeader>
        <Skeleton className="h-6 w-60 mb-2" />
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {Array(5)
            .fill(0)
            .map((_, i) => (
              <div key={i} className="space-y-2">
                <div className="flex justify-between">
                  <Skeleton className="h-5 w-40" />
                  <div className="flex gap-2">
                    <Skeleton className="h-5 w-10" />
                    <Skeleton className="h-5 w-16" />
                  </div>
                </div>
                <Skeleton className="h-2 w-full" />
              </div>
            ))}
        </div>
      </CardContent>
    </Card>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-10 w-96" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array(4)
          .fill(0)
          .map((_, i) => (
            <MetricCardSkeleton key={i} />
          ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <ConversionFunnelSkeleton />

        {Array(2)
          .fill(0)
          .map((_, i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-6 w-36 mb-2" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-40 w-full" />
              </CardContent>
            </Card>
          ))}
      </div>
      
      <SurveyStepsFunnelSkeleton />
    </div>
  );
}
