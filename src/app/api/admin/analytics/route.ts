import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin-client';

// Define allowed time ranges
type TimeRange = '24h' | '7d' | '30d' | 'all';

// Define the event count type
interface EventCount {
  event_type: string;
  count: number;
}

// Define survey funnel metrics
interface SurveyFunnelMetrics {
  visits: number;
  started: number;
  completed: number;
  startRate: string;
  completionRate: string;
  overallConversionRate: string;
}

// Define signup metrics
interface SignupMetrics {
  emailSignups: number;
  googleSignups: number;
  totalSignups: number;
}

// Define recommendations metrics
interface RecommendationsMetrics {
  pageVisits: number;
  companyInterestClicks: number;
  companyInterestRate: string;
  averageCompaniesPerUser: number;
}

// Define survey step completion metrics
interface SurveyStepMetrics {
  id: string;
  count: number;
  percentage: string;
}

/**
 * GET handler for fetching analytics data
 */
export async function GET(request: NextRequest) {
  try {
    // Get query parameters
    const searchParams = request.nextUrl.searchParams;
    const timeRange = (searchParams.get('timeRange') || '7d') as TimeRange;
    const eventType = searchParams.get('eventType') || undefined;
    
    // Calculate the start date based on the time range
    let startDate: Date | null = null;
    const now = new Date();
    
    if (timeRange === '24h') {
      startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000); // 24 hours ago
    } else if (timeRange === '7d') {
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000); // 7 days ago
    } else if (timeRange === '30d') {
      startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000); // 30 days ago
    }
    
    // Build the query
    let query = supabaseAdmin
      .from('analytics_events')
      .select('*');
    
    // Apply filters
    if (startDate) {
      query = query.gte('timestamp', startDate.toISOString());
    }
    
    if (eventType) {
      query = query.eq('event_type', eventType);
    }
    
    // Execute the query
    const { data, error } = await query.order('timestamp', { ascending: false });
    
    if (error) {
      console.error('Error fetching analytics data:', error);
      return NextResponse.json(
        { error: 'Failed to fetch analytics data' },
        { status: 500 }
      );
    }
    
    // Get event counts by type using raw SQL
    const { data: eventCounts, error: countError } = await supabaseAdmin
      .rpc('get_event_counts', { 
        start_date: startDate ? startDate.toISOString() : '1970-01-01' 
      });
    
    if (countError) {
      console.error('Error fetching event counts:', countError);
    }
    
    // Cast the event counts to the proper type
    const typedEventCounts = (eventCounts || []) as EventCount[];
    
    // Calculate metrics based on event counts
    const findEventCount = (eventType: string): number => {
      return typedEventCounts.find(item => item.event_type === eventType)?.count || 0;
    };
    
    // Home page and survey funnel metrics
    const homePageVisits = findEventCount('home_page_visit');
    const surveyStartClicks = findEventCount('survey_start_click');
    const surveyCompletions = findEventCount('survey_completed');
    
    const surveyStartRate = homePageVisits > 0 
      ? Math.round((surveyStartClicks / homePageVisits) * 100) 
      : 0;
      
    const surveyCompletionRate = surveyStartClicks > 0 
      ? Math.round((surveyCompletions / surveyStartClicks) * 100) 
      : 0;
      
    const overallConversionRate = homePageVisits > 0 
      ? Math.round((surveyCompletions / homePageVisits) * 100) 
      : 0;
    
    const surveyFunnel: SurveyFunnelMetrics = {
      visits: homePageVisits,
      started: surveyStartClicks,
      completed: surveyCompletions,
      startRate: `${surveyStartRate}%`,
      completionRate: `${surveyCompletionRate}%`,
      overallConversionRate: `${overallConversionRate}%`
    };
    
    // Survey type metrics
    const textSurveys = data.filter(event => 
      event.event_type === 'survey_type_selected' && 
      event.properties?.surveyType === 'text'
    ).length;
    
    const imageSurveys = data.filter(event => 
      event.event_type === 'survey_type_selected' && 
      event.properties?.surveyType === 'image'
    ).length;
    
    // Recommendations metrics
    const recommendationsVisits = findEventCount('recommendations_page_visit');
    const companyInterestClicks = findEventCount('company_interested_click');
    
    // Calculate unique sessions that viewed recommendations page
    const uniqueRecommendationSessions = new Set(
      data.filter(event => event.event_type === 'recommendations_page_visit' && event.session_id)
        .map(event => event.session_id)
    ).size;
    
    // Calculate unique sessions that clicked company interest
    const uniqueCompanyInterestSessions = new Set(
      data.filter(event => event.event_type === 'company_interested_click' && event.session_id)
        .map(event => event.session_id)
    ).size;
    
    const companyInterestRate = uniqueRecommendationSessions > 0
      ? Math.round((uniqueCompanyInterestSessions / uniqueRecommendationSessions) * 100)
      : 0;
      
    const avgCompaniesPerUser = uniqueCompanyInterestSessions > 0
      ? Math.round((companyInterestClicks / uniqueCompanyInterestSessions) * 10) / 10
      : 0;
    
    const recommendationsMetrics: RecommendationsMetrics = {
      pageVisits: recommendationsVisits,
      companyInterestClicks,
      companyInterestRate: `${companyInterestRate}%`,
      averageCompaniesPerUser: avgCompaniesPerUser
    };
    
    // Signup metrics
    const emailSignups = findEventCount('email_signup_click');
    const googleSignups = findEventCount('google_signup_click');
    const totalSignups = emailSignups + googleSignups;
    
    const signupMetrics: SignupMetrics = {
      emailSignups,
      googleSignups,
      totalSignups
    };
    
    // Legacy metrics for backward compatibility
    const signupClicks = findEventCount('signup_click');
    const dialogCloses = findEventCount('dialog_close');
    
    const legacyConversionRate = dialogCloses > 0 
      ? Math.round((signupClicks / (signupClicks + dialogCloses)) * 100) 
      : 0;
    
    // Process survey step completion data
    const surveyStepEvents = data.filter(event => event.event_type === 'survey_step_completed');
    
    // Get all unique step IDs
    const stepIds = [...new Set(
      surveyStepEvents.map(event => event.properties?.stepId as string)
    )].filter(Boolean);
    
    // Count completions for each step
    const surveyStepMetrics: SurveyStepMetrics[] = stepIds.map(stepId => {
      const count = surveyStepEvents.filter(
        event => event.properties?.stepId === stepId
      ).length;
      
      const percentage = surveyStartClicks > 0 
        ? `${Math.round((count / surveyStartClicks) * 100)}%` 
        : '0%';
      
      return {
        id: stepId,
        count,
        percentage
      };
    }).sort((a, b) => {
      // Try to sort by step index if available in the step ID format like "step_1", "step_2"
      const indexA = parseInt(a.id.split('_').pop() || '0');
      const indexB = parseInt(b.id.split('_').pop() || '0');
      
      if (!isNaN(indexA) && !isNaN(indexB)) {
        return indexA - indexB;
      }
      
      // Fall back to alphabetical sorting
      return a.id.localeCompare(b.id);
    });
    
    return NextResponse.json({
      events: data,
      eventCounts: typedEventCounts,
      stats: {
        totalEvents: data.length,
        // Legacy stats
        signupClicks,
        dialogCloses,
        conversionRate: `${legacyConversionRate}%`,
        // New stats
        surveyFunnel,
        surveyTypes: {
          text: textSurveys,
          image: imageSurveys,
          total: textSurveys + imageSurveys
        },
        recommendations: recommendationsMetrics,
        signups: signupMetrics,
        // Survey step metrics
        surveySteps: surveyStepMetrics
      }
    });
  } catch (error) {
    console.error('Error in analytics API:', error);
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    );
  }
} 